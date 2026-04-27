use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use crate::db::get_db_conn;
use crate::commands::patients::{Patient, PatientNote, SickSheet};
use crate::commands::appointments::Appointment;
use crate::commands::treatments::Treatment;
use crate::commands::payments::Payment;
use crate::hub::SyncResponse;
use reqwest::Client;
use log::{info, error};
use std::time::{SystemTime, Duration};

use tauri::Manager;

#[derive(Clone, Debug)]
struct HubAddress {
    addr: String,
    last_seen: SystemTime,
    is_manual: bool,
}

fn update_status(app_handle: &AppHandle, status: &str, is_connected: bool) {
    if let Some(state) = app_handle.try_state::<crate::commands::network::GlobalState>() {
        if let Ok(mut status_lock) = state.connection_status.lock() {
            *status_lock = status.to_string();
        }
        if let Ok(mut connected_lock) = state.is_connected.lock() {
            *connected_lock = is_connected;
        }
    }
    let _ = app_handle.emit("connection-status-changed", status);
}

pub async fn start_spoke_client(app_handle: AppHandle, pairing_code: String, manual_addr: Option<String>) {
    update_status(&app_handle, "Searching for Hub...", false);

    // hub_addresses stores a list of potential addresses to try
    let initial_addrs = if let Some(addr) = manual_addr.clone() {
        vec![HubAddress { addr, last_seen: SystemTime::now(), is_manual: true }]
    } else {
        Vec::new()
    };
    let hub_addresses = Arc::new(Mutex::new(initial_addrs));
    let current_hub_index = Arc::new(Mutex::new(0));
    let pairing_token = Arc::new(Mutex::new(None));
    let sync_notifier = Arc::new(tokio::sync::Notify::new());

    // Update global state if available
    if let Some(state) = app_handle.try_state::<crate::commands::network::GlobalState>() {
        if let Ok(mut g_mode) = state.mode.lock() {
            *g_mode = "spoke".to_string();
        }
        if let Ok(mut g_code) = state.pairing_code.lock() {
            *g_code = Some(pairing_code.clone());
        }
    }

    let hub_addrs_clone = hub_addresses.clone();
    let notifier_mdns = sync_notifier.clone();

    // Background mDNS discovery
    tauri::async_runtime::spawn(async move {
        info!("Starting spoke mDNS discovery...");
        let mdns = match ServiceDaemon::new() {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to create mDNS daemon for spoke: {}", e);
                return;
            }
        };
        let service_type = "_dentist-hub._tcp.local.";
        let receiver = match mdns.browse(service_type) {
            Ok(r) => r,
            Err(e) => {
                error!("Failed to browse mDNS for spoke: {}", e);
                return;
            }
        };

        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let port = info.get_port();
                for addr in info.get_addresses() {
                    let addr_str = format!("{}:{}", addr, port);
                    if let Ok(mut current_hub_list) = hub_addrs_clone.lock() {
                        if let Some(existing) = current_hub_list.iter_mut().find(|h| h.addr == addr_str) {
                            existing.last_seen = SystemTime::now();
                        } else {
                            info!("Discovered new Hub address (mDNS): {}", addr_str);
                            current_hub_list.push(HubAddress { addr: addr_str, last_seen: SystemTime::now(), is_manual: false });
                            notifier_mdns.notify_one();
                        }
                    }
                }
            }
        }
    });

    // UDP Presence Discovery
    let hub_addrs_udp = hub_addresses.clone();
    let notifier_udp = sync_notifier.clone();
    tauri::async_runtime::spawn(async move {
        info!("Starting spoke UDP presence listener...");
        let socket = match tokio::net::UdpSocket::bind("0.0.0.0:5005").await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to bind UDP socket for discovery: {}", e);
                return;
            }
        };

        let mut buf = [0u8; 1024];
        loop {
            if let Ok((len, src)) = socket.recv_from(&mut buf).await {
                let msg = String::from_utf8_lossy(&buf[..len]);
                if msg.starts_with("DENTIST_HUB_ALIVE:") {
                    if let Some(port_str) = msg.split(':').nth(1) {
                        let addr_str = format!("{}:{}", src.ip(), port_str);
                        if let Ok(mut current_hub_list) = hub_addrs_udp.lock() {
                            if let Some(existing) = current_hub_list.iter_mut().find(|h| h.addr == addr_str) {
                                existing.last_seen = SystemTime::now();
                            } else {
                                info!("Discovered new Hub address (UDP): {}", addr_str);
                            current_hub_list.push(HubAddress { addr: addr_str, last_seen: SystemTime::now(), is_manual: false });
                                notifier_udp.notify_one();
                            }
                        }
                    }
                }
            }
        }
    });

    // Background Sync Loop
    let hub_addrs_sync = hub_addresses.clone();
    let current_idx_sync = current_hub_index.clone();
    let pairing_token_sync = pairing_token.clone();
    let app_handle_sync = app_handle.clone();
    let pairing_code_clone = pairing_code.clone();
    let notifier_sync = sync_notifier.clone();
    tauri::async_runtime::spawn(async move {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());

        let mut force_sync = false;
        let mut was_connected = false;
        loop {
            // Cleanup stale addresses
            if let Ok(mut addrs_lock) = hub_addrs_sync.lock() {
                let now = SystemTime::now();
                addrs_lock.retain(|h| {
                    if h.is_manual { return true; }
                    if let Ok(elapsed) = now.duration_since(h.last_seen) {
                        elapsed < Duration::from_secs(120) // 2 minutes
                    } else {
                        true
                    }
                });
            }

            let (addr, idx, total) = {
                let addrs_lock = hub_addrs_sync.lock().ok();
                let idx_lock = current_idx_sync.lock().ok();

                let addrs = addrs_lock.map(|l| l.clone()).unwrap_or_default();
                let idx = idx_lock.map(|l| *l).unwrap_or(0);

                if addrs.is_empty() {
                    (None, 0, 0)
                } else {
                    let safe_idx = if idx >= addrs.len() { 0 } else { idx };
                    (Some(addrs[safe_idx].addr.clone()), safe_idx, addrs.len())
                }
            };

            let mut sync_success = false;
            if let Some(addr) = addr {
                let current_token = {
                    let lock = pairing_token_sync.lock().ok();
                    lock.and_then(|l| l.clone())
                };

                if current_token.is_none() {
                    update_status(&app_handle_sync, &format!("Pairing with {}...", addr), false);
                    // Try to pair
                    let res = client.post(format!("http://{}/pair", addr))
                        .json(&serde_json::json!({ "code": pairing_code_clone }))
                        .send()
                        .await;

                    match res {
                        Ok(response) if response.status().is_success() => {
                            if let Ok(pair_res) = response.json::<crate::hub::PairResponse>().await {
                                if let Ok(mut lock) = pairing_token_sync.lock() {
                                    *lock = Some(pair_res.token.clone());
                                    info!("Paired successfully with Hub at {}", addr);
                                    force_sync = true;
                                    was_connected = true;
                                }
                            }
                        },
                        _ => {
                            update_status(&app_handle_sync, &format!("Pairing failed with {}. Retrying...", addr), false);
                            // If failed to pair, try next address next time
                            if let Ok(mut idx_lock) = current_idx_sync.lock() {
                                if total > 0 {
                                    *idx_lock = (idx + 1) % total;
                                }
                                info!("Connection failed to {}. Trying next address.", addr);
                            }
                        }
                    }
                }

                let token_to_use = {
                    let lock = pairing_token_sync.lock().ok();
                    lock.and_then(|l| l.clone())
                };

                if let Some(token) = token_to_use {
                    if force_sync {
                        update_status(&app_handle_sync, "Initial Syncing...", true);
                    } else {
                        update_status(&app_handle_sync, "Syncing...", true);
                    }

                    match sync_with_hub(&client, &addr, &token, &app_handle_sync).await {
                        Ok(_) => {
                            sync_success = true;
                            update_status(&app_handle_sync, "Connected", true);
                            if force_sync {
                                info!("Full sync completed successfully for Spoke");
                                let _ = app_handle_sync.emit("sync-event", serde_json::json!({ "type": "initial_sync_complete" }));
                                force_sync = false;
                            }
                        }
                        Err(e) => {
                            error!("Sync failed with {}: {}", addr, e);
                            was_connected = false;
                            update_status(&app_handle_sync, "Reconnecting...", false);

                            // If it's a 401, clear the token so we re-pair
                            if e.to_string().contains("401") || e.to_string().contains("Unauthorized") {
                                if let Ok(mut lock) = pairing_token_sync.lock() {
                                    *lock = None;
                                }
                            }

                            // If sync fails, rotate to next address
                            if let Ok(mut idx_lock) = current_idx_sync.lock() {
                                if total > 0 {
                                    *idx_lock = (idx + 1) % total;
                                    info!("Rotating to next Hub address index: {}", *idx_lock);
                                }
                            }
                        }
                    }
                }
            }

            let sleep_duration = if sync_success {
                Duration::from_secs(30)
            } else {
                Duration::from_secs(1) // More aggressive reconnection
            };

            tokio::select! {
                _ = tokio::time::sleep(sleep_duration) => {},
                _ = notifier_sync.notified() => {
                    info!("Sync loop woken up by notification");
                }
            }
        }
    });

    // Listen for local changes to trigger immediate sync push
    let notifier_local = sync_notifier.clone();
    let app_handle_local = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        use tauri::Listener;
        app_handle_local.listen("sync-event", move |event| {
            // Avoid re-triggering sync if the event was just received from the Hub via WebSocket
            // We can check if the payload contains "type" which we use for remote events
            let should_trigger = if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                // If it has a type (like treatment_updated) and it's NOT from spoke, it must be local
                // OR if it explicitly says source: local
                let is_from_spoke = payload.get("source").and_then(|s| s.as_str()) == Some("spoke");
                let is_explicit_local = payload.get("source").and_then(|s| s.as_str()) == Some("local");

                !is_from_spoke || is_explicit_local
            } else {
                true
            };

            if should_trigger {
                info!("Local sync-event detected, triggering immediate spoke sync push");
                notifier_local.notify_one();
            }
        });
    });

    // Heartbeat Task
    let hub_addrs_hb = hub_addresses.clone();
    let current_idx_hb = current_hub_index.clone();
    let pairing_token_hb = pairing_token.clone();
    let app_handle_hb = app_handle.clone();
    let notifier_hb = sync_notifier.clone();
    tauri::async_runtime::spawn(async move {
        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_else(|_| Client::new());

        loop {
            let addr = {
                let addrs_lock = hub_addrs_hb.lock().ok();
                let idx_lock = current_idx_hb.lock().ok();
                let addrs = addrs_lock.map(|l| l.clone()).unwrap_or_default();
                let idx = idx_lock.map(|l| *l).unwrap_or(0);

                if addrs.is_empty() {
                    None
                } else {
                    let safe_idx = if idx >= addrs.len() { 0 } else { idx };
                    Some(addrs[safe_idx].addr.clone())
                }
            };

            if let Some(addr) = addr {
                let res = client.get(format!("http://{}/ping", &addr)).send().await;
                let is_alive = match res {
                    Ok(resp) => resp.status().is_success(),
                    Err(_) => false,
                };

                if is_alive {
                    if let Ok(mut addrs_lock) = hub_addrs_hb.lock() {
                        if let Some(h) = addrs_lock.iter_mut().find(|h| h.addr == addr) {
                            h.last_seen = SystemTime::now();
                        }
                    }
                } else {
                    // Heartbeat lost. We don't clear the pairing token here to allow "instant" reconnection
                    // when the hub comes back online. Re-pairing is handled by the sync loop if needed.
                    update_status(&app_handle_hb, "Reconnecting...", false);
                }

                let mut should_notify = false;
                if let Some(state) = app_handle_hb.try_state::<crate::commands::network::GlobalState>() {
                    if let Ok(conn_lock) = state.is_connected.lock() {
                        if *conn_lock != is_alive && is_alive {
                            should_notify = true;
                        }
                    }
                }

                if should_notify {
                    notifier_hb.notify_one(); // Wake up sync loop immediately
                }
            } else {
                update_status(&app_handle_hb, "Searching for Hub...", false);
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });

    // WebSocket connection for real-time updates
    let hub_addrs_ws = hub_addresses.clone();
    let current_idx_ws = current_hub_index.clone();
    let pairing_token_ws = pairing_token.clone();
    let app_handle_ws = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let (addr, token) = {
                let addrs_lock = hub_addrs_ws.lock().ok();
                let idx_lock = current_idx_ws.lock().ok();
                let token_lock = pairing_token_ws.lock().ok();

                let addrs = addrs_lock.map(|l| l.clone()).unwrap_or_default();
                let idx = idx_lock.map(|l| *l).unwrap_or(0);
                let token = token_lock.and_then(|l| l.clone());

                if addrs.is_empty() {
                    (None, token)
                } else {
                    let safe_idx = if idx >= addrs.len() { 0 } else { idx };
                    (Some(addrs[safe_idx].clone()), token)
                }
            };

            if let (Some(addr), Some(token)) = (addr.map(|h| h.addr), token) {
                let url = format!("ws://{}/ws", addr);
                let request_res = http::Request::builder()
                    .uri(url)
                    .header("Authorization", token)
                    .body(());

                if let Ok(request) = request_res {
                    if let Ok((mut socket, _)) = tokio_tungstenite::connect_async(request).await {
                    use futures_util::StreamExt;
                        while let Some(msg_res) = socket.next().await {
                            if let Ok(tokio_tungstenite::tungstenite::Message::Text(text)) = msg_res {
                                let _ = app_handle_ws.emit("sync-event", serde_json::json!({ "type": text }));
                            }
                        }
                    }
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    });
}

async fn sync_with_hub(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Push local changes
    push_local_changes(client, hub_addr, token, app_handle).await?;

    // 2. Pull remote changes
    pull_remote_changes(client, hub_addr, token, app_handle).await?;

    Ok(())
}

async fn push_waivers(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let waivers: Vec<crate::commands::lifecycle::WaiverRequest> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, appointment_id, patient_id, patient_name, doctor_id, requested_by, status, created_at, updated_at FROM waiver_requests WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::commands::lifecycle::WaiverRequest {
                id: row.get(0)?,
                appointment_id: row.get(1)?,
                patient_id: row.get(2)?,
                patient_name: row.get(3)?,
                doctor_id: row.get(4)?,
                requested_by: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !waivers.is_empty() {
        let res = client.post(format!("http://{}/sync/waivers", hub_addr))
            .header("Authorization", token)
            .json(&waivers)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE waiver_requests SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_doctor_statuses(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let statuses: Vec<crate::commands::lifecycle::DoctorStatus> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT doctor_id, current_appointment_id, updated_at FROM doctor_status WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::commands::lifecycle::DoctorStatus {
                doctor_id: row.get(0)?,
                current_appointment_id: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !statuses.is_empty() {
        let res = client.post(format!("http://{}/sync/doctor_statuses", hub_addr))
            .header("Authorization", token)
            .json(&statuses)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE doctor_status SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_settings(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings: Vec<crate::commands::settings::Setting> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT key, value, updated_at FROM settings WHERE sync_status = 'pending' AND key NOT IN ('network_mode', 'pairing_code', 'hub_address')")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::commands::settings::Setting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !settings.is_empty() {
        let res = client.post(format!("http://{}/sync/settings", hub_addr))
            .header("Authorization", token)
            .json(&settings)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE settings SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_local_changes(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    push_patients(client, hub_addr, token, app_handle).await?;
    push_appointments(client, hub_addr, token, app_handle).await?;
    push_treatments(client, hub_addr, token, app_handle).await?;
    push_payments(client, hub_addr, token, app_handle).await?;
    push_patient_notes(client, hub_addr, token, app_handle).await?;
    push_sick_sheets(client, hub_addr, token, app_handle).await?;
    push_waivers(client, hub_addr, token, app_handle).await?;
    push_doctor_statuses(client, hub_addr, token, app_handle).await?;
    push_settings(client, hub_addr, token, app_handle).await?;
    push_services(client, hub_addr, token, app_handle).await?;
    push_insurance_providers(client, hub_addr, token, app_handle).await?;
    push_users(client, hub_addr, token, app_handle).await?;
    push_deletions(client, hub_addr, token, app_handle).await?;
    Ok(())
}

async fn push_deletions(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let deletions: Vec<crate::hub::DeletedRecord> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, table_name, record_id, deleted_at FROM deleted_records WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::hub::DeletedRecord {
                id: row.get(0)?,
                table_name: row.get(1)?,
                record_id: row.get(2)?,
                deleted_at: row.get(3)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !deletions.is_empty() {
        let res = client.post(format!("http://{}/sync/deletions", hub_addr))
            .header("Authorization", token)
            .json(&deletions)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE deleted_records SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_insurance_providers(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let providers: Vec<crate::commands::insurance::InsuranceProvider> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, name, pays_reception_fee, created_at, updated_at FROM insurance_providers WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::commands::insurance::InsuranceProvider {
                id: row.get(0)?,
                name: row.get(1)?,
                pays_reception_fee: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !providers.is_empty() {
        let res = client.post(format!("http://{}/sync/insurance_providers", hub_addr))
            .header("Authorization", token)
            .json(&providers)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE insurance_providers SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_patients(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let patients: Vec<Patient> = {
        let conn = get_db_conn(app_handle)?;
        // Push Patients
        let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, created_at, updated_at FROM patients WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                date_of_birth: row.get(4)?,
                address: row.get(5)?,
                medical_history: row.get(6)?,
                allergies: row.get(7)?,
                emergency_contact: row.get(8)?,
                emergency_phone: row.get(9)?,
                preferred_payment_method: row.get(10)?,
                preferred_insurance_provider_id: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?;
        let mut result = Vec::new();
        for r in rows {
            if let Ok(p) = r {
                result.push(p);
            }
        }
        result
    };

    if !patients.is_empty() {
        let res = client.post(format!("http://{}/sync/patients", hub_addr))
            .header("Authorization", token)
            .json(&patients)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE patients SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }

    Ok(())
}

async fn push_appointments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let appointments: Vec<Appointment> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, date, time, status, type, notes, duration, reception_fee_paid, reception_fee_waived, created_at, updated_at FROM appointments WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(Appointment {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                patient_name: row.get(2)?,
                doctor_id: row.get(3)?,
                doctor_name: row.get(4)?,
                date: row.get(5)?,
                time: row.get(6)?,
                status: row.get(7)?,
                appointment_type: row.get(8)?,
                notes: row.get(9)?,
                duration: row.get(10)?,
                reception_fee_paid: row.get(11)?,
                reception_fee_waived: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for r in rows {
            if let Ok(a) = r {
                result.push(a);
            }
        }
        result
    };

    if !appointments.is_empty() {
        let res = client.post(format!("http://{}/sync/appointments", hub_addr))
            .header("Authorization", token)
            .json(&appointments)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE appointments SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }

    Ok(())
}

async fn push_treatments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let treatments = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at FROM treatments WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, f64>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, String>(13)?,
            ))
        })?;

        let mut result = Vec::new();
        for r in rows {
            if let Ok((id, p_id, p_name, d_id, d_name, a_id, date, diag, treat, notes, f_up, cost, c_at, u_at)) = r {
                let mut med_stmt = conn.prepare("SELECT id, name, dosage, frequency, duration, instructions FROM medications WHERE treatment_id = ?1")?;
                let medications = med_stmt.query_map([&id], |med_row| {
                    Ok(crate::commands::treatments::Medication {
                        id: med_row.get(0)?,
                        name: med_row.get(1)?,
                        dosage: med_row.get(2)?,
                        frequency: med_row.get(3)?,
                        duration: med_row.get(4)?,
                        instructions: med_row.get(5)?,
                    })
                })?.filter_map(|m| m.ok()).collect();

                result.push(Treatment {
                    id, patient_id: p_id, patient_name: p_name, doctor_id: d_id, doctor_name: d_name, appointment_id: a_id, date, diagnosis: diag, treatment: treat, medications, notes, follow_up_date: f_up, cost, created_at: c_at, updated_at: u_at,
                });
            }
        }
        result
    };

    if !treatments.is_empty() {
        let res = client.post(format!("http://{}/sync/treatments", hub_addr))
            .header("Authorization", token)
            .json(&treatments)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE treatments SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
            conn.execute("UPDATE medications SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_patient_notes(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let notes: Vec<PatientNote> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at FROM patient_notes WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(PatientNote {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                doctor_name: row.get(3)?,
                note_type: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !notes.is_empty() {
        let res = client.post(format!("http://{}/sync/patient_notes", hub_addr))
            .header("Authorization", token)
            .json(&notes)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE patient_notes SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_sick_sheets(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sheets: Vec<SickSheet> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at FROM sick_sheets WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(SickSheet {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                patient_name: row.get(2)?,
                doctor_id: row.get(3)?,
                doctor_name: row.get(4)?,
                start_date: row.get(5)?,
                end_date: row.get(6)?,
                reason: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !sheets.is_empty() {
        let res = client.post(format!("http://{}/sync/sick_sheets", hub_addr))
            .header("Authorization", token)
            .json(&sheets)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE sick_sheets SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn push_payments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let payments: Vec<Payment> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, insurance_provider_id FROM payments WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(Payment {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                patient_name: row.get(2)?,
                treatment_id: row.get(3)?,
                amount: row.get(4)?,
                date: row.get(5)?,
                method: row.get(6)?,
                status: row.get(7)?,
                notes: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                insurance_provider_id: row.get(11)?,
            })
        })?;
        rows.filter_map(|p| p.ok()).collect()
    };

    if !payments.is_empty() {
        let res = client.post(format!("http://{}/sync/payments", hub_addr))
            .header("Authorization", token)
            .json(&payments)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE payments SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn pull_remote_changes(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Prioritize users for immediate login capability
    pull_users(client, hub_addr, token, app_handle).await?;

    pull_patients(client, hub_addr, token, app_handle).await?;
    pull_appointments(client, hub_addr, token, app_handle).await?;
    pull_treatments(client, hub_addr, token, app_handle).await?;
    pull_payments(client, hub_addr, token, app_handle).await?;
    pull_patient_notes(client, hub_addr, token, app_handle).await?;
    pull_sick_sheets(client, hub_addr, token, app_handle).await?;
    pull_waivers(client, hub_addr, token, app_handle).await?;
    pull_doctor_statuses(client, hub_addr, token, app_handle).await?;
    pull_settings(client, hub_addr, token, app_handle).await?;
    pull_services(client, hub_addr, token, app_handle).await?;
    pull_insurance_providers(client, hub_addr, token, app_handle).await?;
    pull_deletions(client, hub_addr, token, app_handle).await?;
    Ok(())
}

async fn pull_deletions(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/deletions", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;

    if res.status().is_success() {
        let sync_res: SyncResponse<crate::hub::DeletedRecord> = res.json().await?;
        let tx = conn.transaction()?;
        for d in sync_res.data {
            let _ = tx.execute(
                "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, 'synced')
                 ON CONFLICT(id) DO NOTHING",
                rusqlite::params![d.id, d.table_name, d.record_id, d.deleted_at],
            );

            let allowed_tables = vec!["patients", "appointments", "treatments", "payments", "patient_notes", "sick_sheets", "services", "insurance_providers", "users"];
            if allowed_tables.contains(&d.table_name.as_str()) {
                let query = format!("DELETE FROM {} WHERE id = ?1", d.table_name);
                let _ = tx.execute(&query, [&d.record_id]);

                if d.table_name == "treatments" {
                    let _ = tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&d.record_id]);
                }
            }
        }
        tx.commit()?;
    }
    Ok(())
}

async fn pull_patients(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;

    // Pull Patients
    let res = client.get(format!("http://{}/sync/patients", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Patient> = res.json().await?;
        for p in sync_res.data {
             let _ = conn.execute(
                "INSERT INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    phone = excluded.phone,
                    email = excluded.email,
                    date_of_birth = excluded.date_of_birth,
                    address = excluded.address,
                    medical_history = excluded.medical_history,
                    allergies = excluded.allergies,
                    emergency_contact = excluded.emergency_contact,
                    emergency_phone = excluded.emergency_phone,
                    preferred_payment_method = excluded.preferred_payment_method,
                    preferred_insurance_provider_id = excluded.preferred_insurance_provider_id,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > patients.updated_at",
                rusqlite::params![
                    p.id, p.name, p.phone, p.email, p.date_of_birth, p.address,
                    p.medical_history, p.allergies, p.emergency_contact, p.emergency_phone,
                    p.preferred_payment_method, p.preferred_insurance_provider_id,
                    p.created_at, p.updated_at
                ],
            );
        }
    }

    Ok(())
}

async fn pull_appointments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/appointments", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Appointment> = res.json().await?;
        for a in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, date, time, status, type, notes, duration, reception_fee_paid, reception_fee_waived, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    doctor_id = excluded.doctor_id,
                    doctor_name = excluded.doctor_name,
                    date = excluded.date,
                    time = excluded.time,
                    status = excluded.status,
                    type = excluded.type,
                    notes = excluded.notes,
                    duration = excluded.duration,
                    reception_fee_paid = excluded.reception_fee_paid,
                    reception_fee_waived = excluded.reception_fee_waived,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > appointments.updated_at",
                rusqlite::params![
                    a.id, a.patient_id, a.patient_name, a.doctor_id, a.doctor_name, a.date, a.time, a.status,
                    a.appointment_type, a.notes, a.duration, a.reception_fee_paid, a.reception_fee_waived, a.created_at, a.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn push_users(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let users: Vec<crate::hub::UserSync> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, username, password_hash, role, full_name, created_at, updated_at FROM users WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::hub::UserSync {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: row.get(3)?,
                full_name: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !users.is_empty() {
        let res = client.post(format!("http://{}/sync/users", hub_addr))
            .header("Authorization", token)
            .json(&users)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE users SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn pull_users(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/users", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::hub::UserSync> = res.json().await?;
        for u in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO users (id, username, password_hash, role, full_name, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    username = excluded.username,
                    password_hash = excluded.password_hash,
                    role = excluded.role,
                    full_name = excluded.full_name,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > users.updated_at",
                rusqlite::params![u.id, u.username, u.password_hash, u.role, u.full_name, u.created_at, u.updated_at],
            );
        }
    }
    Ok(())
}

async fn pull_treatments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/treatments", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Treatment> = res.json().await?;
        let tx = conn.transaction()?;
        for t in sync_res.data {
            let rows_affected = tx.execute(
                "INSERT INTO treatments (id, patient_id, patient_name, doctor_id, doctor_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    doctor_id = excluded.doctor_id,
                    doctor_name = excluded.doctor_name,
                    appointment_id = excluded.appointment_id,
                    diagnosis = excluded.diagnosis,
                    treatment = excluded.treatment,
                    notes = excluded.notes,
                    follow_up_date = excluded.follow_up_date,
                    cost = excluded.cost,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > treatments.updated_at",
                rusqlite::params![
                    t.id, t.patient_id, t.patient_name, t.doctor_id, t.doctor_name, t.appointment_id, t.date,
                    t.diagnosis, t.treatment, t.notes, t.follow_up_date, t.cost,
                    t.created_at, t.updated_at
                ],
            )?;

            if rows_affected > 0 {
                let _ = tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&t.id]);
                for med in t.medications {
                    let _ = tx.execute(
                        "INSERT INTO medications (id, treatment_id, name, dosage, frequency, duration, instructions, sync_status)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'synced')",
                        rusqlite::params![
                            med.id, t.id, med.name, med.dosage, med.frequency,
                            med.duration, med.instructions
                        ],
                    );
                }
            }
        }
        tx.commit()?;
    }
    Ok(())
}

async fn pull_waivers(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/waivers", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::commands::lifecycle::WaiverRequest> = res.json().await?;
        for w in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO waiver_requests (id, appointment_id, patient_id, patient_name, doctor_id, requested_by, status, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > waiver_requests.updated_at",
                rusqlite::params![
                    w.id, w.appointment_id, w.patient_id, w.patient_name, w.doctor_id, w.requested_by, w.status, w.created_at, w.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn pull_doctor_statuses(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/doctor_statuses", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::commands::lifecycle::DoctorStatus> = res.json().await?;
        for s in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO doctor_status (doctor_id, current_appointment_id, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, 'synced')
                 ON CONFLICT(doctor_id) DO UPDATE SET
                    current_appointment_id = excluded.current_appointment_id,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > doctor_status.updated_at",
                rusqlite::params![
                    s.doctor_id, s.current_appointment_id, s.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn pull_settings(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/settings", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::commands::settings::Setting> = res.json().await?;
        for s in sync_res.data {
            if ["network_mode", "pairing_code", "hub_address"].contains(&s.key.as_str()) {
                continue;
            }
            let _ = conn.execute(
                "INSERT INTO settings (key, value, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, 'synced')
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > settings.updated_at",
                rusqlite::params![s.key, s.value, s.updated_at],
            );
        }
    }
    Ok(())
}

async fn pull_insurance_providers(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/insurance_providers", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::commands::insurance::InsuranceProvider> = res.json().await?;
        for p in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO insurance_providers (id, name, pays_reception_fee, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    pays_reception_fee = excluded.pays_reception_fee,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > insurance_providers.updated_at",
                rusqlite::params![p.id, p.name, p.pays_reception_fee, p.created_at, p.updated_at],
            );
        }
    }
    Ok(())
}

async fn pull_patient_notes(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/patient_notes", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<PatientNote> = res.json().await?;
        for n in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO patient_notes (id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    note_type = excluded.note_type,
                    note = excluded.note,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > patient_notes.updated_at",
                rusqlite::params![
                    n.id, n.patient_id, n.doctor_id, n.doctor_name, n.note_type, n.note,
                    n.created_at, n.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn pull_sick_sheets(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/sick_sheets", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<SickSheet> = res.json().await?;
        for s in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO sick_sheets (id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    start_date = excluded.start_date,
                    end_date = excluded.end_date,
                    reason = excluded.reason,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > sick_sheets.updated_at",
                rusqlite::params![
                    s.id, s.patient_id, s.patient_name, s.doctor_id, s.doctor_name,
                    s.start_date, s.end_date, s.reason, s.created_at, s.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn push_services(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let services: Vec<crate::commands::services::Service> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, name, standard_fee, created_at, updated_at FROM services WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::commands::services::Service {
                id: row.get(0)?,
                name: row.get(1)?,
                standard_fee: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !services.is_empty() {
        let res = client.post(format!("http://{}/sync/services", hub_addr))
            .header("Authorization", token)
            .json(&services)
            .send()
            .await?;

        if res.status().is_success() {
            let conn = get_db_conn(app_handle)?;
            conn.execute("UPDATE services SET sync_status = 'synced' WHERE sync_status = 'pending'", [])?;
        }
    }
    Ok(())
}

async fn pull_services(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/services", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<crate::commands::services::Service> = res.json().await?;
        for s in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO services (id, name, standard_fee, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    standard_fee = excluded.standard_fee,
                    updated_at = excluded.updated_at,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > services.updated_at",
                rusqlite::params![
                    s.id, s.name, s.standard_fee, s.created_at, s.updated_at
                ],
            );
        }
    }
    Ok(())
}

async fn pull_payments(client: &Client, hub_addr: &str, token: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/payments", hub_addr))
        .header("Authorization", token)
        .send()
        .await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Payment> = res.json().await?;
        for p in sync_res.data {
            let _ = conn.execute(
                "INSERT INTO payments (id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, insurance_provider_id, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                    amount = excluded.amount,
                    status = excluded.status,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    insurance_provider_id = excluded.insurance_provider_id,
                    sync_status = 'synced'
                 WHERE excluded.updated_at > payments.updated_at",
                rusqlite::params![
                    p.id, p.patient_id, p.patient_name, p.treatment_id, p.amount,
                    p.date, p.method, p.status, p.notes, p.created_at, p.updated_at,
                    p.insurance_provider_id
                ],
            );
        }
    }
    Ok(())
}
