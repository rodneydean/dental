use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use crate::db::get_db_conn;
use crate::commands::patients::Patient;
use crate::commands::appointments::Appointment;
use crate::commands::treatments::Treatment;
use crate::commands::payments::Payment;
use crate::hub::SyncResponse;
use reqwest::Client;

pub async fn start_spoke_client(app_handle: AppHandle, pairing_code: String, manual_addr: Option<String>) {
    let hub_address = Arc::new(Mutex::new(manual_addr));

    let hub_addr_clone = hub_address.clone();

    // Background mDNS discovery
    tokio::spawn(async move {
        let mdns = ServiceDaemon::new().expect("Failed to create mdns daemon");
        let service_type = "_dentist-hub._tcp.local.";
        let receiver = mdns.browse(service_type).expect("Failed to browse");

        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let addr = info.get_addresses().iter().next();
                if let Some(addr) = addr {
                    let mut current_hub = hub_addr_clone.lock().unwrap();
                    if current_hub.is_none() {
                        *current_hub = Some(format!("{}:{}", addr, info.get_port()));
                        println!("Discovered Hub at: {}", current_hub.as_ref().unwrap());
                    }
                }
            }
        }
    });

    // Background Sync Loop
    let hub_addr_sync = hub_address.clone();
    let app_handle_sync = app_handle.clone();
    let pairing_code_clone = pairing_code.clone();
    tokio::spawn(async move {
        let client = Client::new();
        let mut is_paired = false;

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

            let addr = {
                let lock = hub_addr_sync.lock().unwrap();
                lock.clone()
            };

            if let Some(addr) = addr {
                if !is_paired {
                    // Try to pair
                    let res = client.post(format!("http://{}/pair", addr))
                        .json(&serde_json::json!({ "code": pairing_code_clone }))
                        .send()
                        .await;

                    if let Ok(response) = res {
                        if response.status().is_success() {
                            is_paired = true;
                            println!("Paired successfully with Hub at {}", addr);
                        }
                    }
                }

                if is_paired {
                    let _ = sync_with_hub(&client, &addr, &app_handle_sync).await;
                }
            }
        }
    });

    // WebSocket connection for real-time updates
    let hub_addr_ws = hub_address.clone();
    let app_handle_ws = app_handle.clone();
    tokio::spawn(async move {
        loop {
            let addr = {
                let lock = hub_addr_ws.lock().unwrap();
                lock.clone()
            };

            if let Some(addr) = addr {
                if let Ok((mut socket, _)) = tokio_tungstenite::connect_async(format!("ws://{}/ws", addr)).await {
                    use futures_util::StreamExt;
                    while let Some(Ok(msg)) = socket.next().await {
                        if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                            let _ = app_handle_ws.emit("sync-event", serde_json::json!({ "type": text }));
                        }
                    }
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    });
}

async fn sync_with_hub(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Push local changes
    push_local_changes(client, hub_addr, app_handle).await?;

    // 2. Pull remote changes
    pull_remote_changes(client, hub_addr, app_handle).await?;

    Ok(())
}

async fn push_local_changes(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    push_patients(client, hub_addr, app_handle).await?;
    push_appointments(client, hub_addr, app_handle).await?;
    push_treatments(client, hub_addr, app_handle).await?;
    push_payments(client, hub_addr, app_handle).await?;
    Ok(())
}

async fn push_patients(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let patients: Vec<Patient> = {
        let conn = get_db_conn(app_handle)?;
        // Push Patients
        let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at FROM patients WHERE sync_status = 'pending'")?;
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
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
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

async fn push_appointments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let appointments: Vec<Appointment> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at FROM appointments WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok(Appointment {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                patient_name: row.get(2)?,
                date: row.get(3)?,
                time: row.get(4)?,
                status: row.get(5)?,
                appointment_type: row.get(6)?,
                notes: row.get(7)?,
                duration: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
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

async fn push_treatments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let treatments = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at FROM treatments WHERE sync_status = 'pending'")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, f64>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
            ))
        })?;

        let mut result = Vec::new();
        for r in rows {
            if let Ok((id, p_id, p_name, a_id, date, diag, treat, notes, f_up, cost, c_at, u_at)) = r {
                let mut med_stmt = conn.prepare("SELECT name, dosage, frequency, duration, instructions FROM medications WHERE treatment_id = ?1")?;
                let medications = med_stmt.query_map([&id], |med_row| {
                    Ok(crate::commands::treatments::Medication {
                        name: med_row.get(0)?,
                        dosage: med_row.get(1)?,
                        frequency: med_row.get(2)?,
                        duration: med_row.get(3)?,
                        instructions: med_row.get(4)?,
                    })
                })?.filter_map(|m| m.ok()).collect();

                result.push(Treatment {
                    id, patient_id: p_id, patient_name: p_name, appointment_id: a_id, date, diagnosis: diag, treatment: treat, medications, notes, follow_up_date: f_up, cost, created_at: c_at, updated_at: u_at,
                });
            }
        }
        result
    };

    if !treatments.is_empty() {
        let res = client.post(format!("http://{}/sync/treatments", hub_addr))
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

async fn push_payments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let payments: Vec<Payment> = {
        let conn = get_db_conn(app_handle)?;
        let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at FROM payments WHERE sync_status = 'pending'")?;
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
            })
        })?;
        rows.filter_map(|p| p.ok()).collect()
    };

    if !payments.is_empty() {
        let res = client.post(format!("http://{}/sync/payments", hub_addr))
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

async fn pull_remote_changes(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    pull_patients(client, hub_addr, app_handle).await?;
    pull_appointments(client, hub_addr, app_handle).await?;
    pull_treatments(client, hub_addr, app_handle).await?;
    pull_payments(client, hub_addr, app_handle).await?;
    Ok(())
}

async fn pull_patients(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;

    // Pull Patients
    let res = client.get(format!("http://{}/sync/patients", hub_addr)).send().await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Patient> = res.json().await?;
        for p in sync_res.data {
             let _ = conn.execute(
                "INSERT OR REPLACE INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')",
                [
                    p.id.as_str(), p.name.as_str(), p.phone.as_deref().unwrap_or_default(), p.email.as_deref().unwrap_or_default(),
                    p.date_of_birth.as_deref().unwrap_or_default(), p.address.as_deref().unwrap_or_default(),
                    p.medical_history.as_deref().unwrap_or_default(), p.allergies.as_deref().unwrap_or_default(),
                    p.emergency_contact.as_deref().unwrap_or_default(), p.emergency_phone.as_deref().unwrap_or_default(),
                    p.created_at.as_str(), p.updated_at.as_str()
                ],
            );
        }
    }

    Ok(())
}

async fn pull_appointments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/appointments", hub_addr)).send().await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Appointment> = res.json().await?;
        for a in sync_res.data {
            let duration_str = a.duration.unwrap_or(30).to_string();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO appointments (id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')",
                [
                    a.id.as_str(), a.patient_id.as_str(), a.patient_name.as_str(), a.date.as_str(), a.time.as_str(), a.status.as_str(),
                    a.appointment_type.as_deref().unwrap_or_default(), a.notes.as_deref().unwrap_or_default(),
                    duration_str.as_str(), a.created_at.as_str(), a.updated_at.as_str()
                ],
            );
        }
    }
    Ok(())
}

async fn pull_treatments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/treatments", hub_addr)).send().await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Treatment> = res.json().await?;
        let tx = conn.transaction()?;
        for t in sync_res.data {
            let _ = tx.execute(
                "INSERT OR REPLACE INTO treatments (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')",
                [
                    t.id.as_str(), t.patient_id.as_str(), t.patient_name.as_str(), t.appointment_id.as_str(), t.date.as_str(),
                    t.diagnosis.as_deref().unwrap_or_default(), t.treatment.as_deref().unwrap_or_default(),
                    t.notes.as_deref().unwrap_or_default(), t.follow_up_date.as_deref().unwrap_or_default(),
                    &t.cost.to_string(), t.created_at.as_str(), t.updated_at.as_str()
                ],
            );

            let _ = tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&t.id]);
            for med in t.medications {
                let _ = tx.execute(
                    "INSERT INTO medications (treatment_id, name, dosage, frequency, duration, instructions, sync_status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'synced')",
                    [
                        &t.id, &med.name, med.dosage.as_deref().unwrap_or_default(), med.frequency.as_deref().unwrap_or_default(),
                        med.duration.as_deref().unwrap_or_default(), med.instructions.as_deref().unwrap_or_default()
                    ],
                );
            }
        }
        tx.commit()?;
    }
    Ok(())
}

async fn pull_payments(client: &Client, hub_addr: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let conn = get_db_conn(app_handle)?;
    let res = client.get(format!("http://{}/sync/payments", hub_addr)).send().await?;
    if res.status().is_success() {
        let sync_res: SyncResponse<Payment> = res.json().await?;
        for p in sync_res.data {
            let _ = conn.execute(
                "INSERT OR REPLACE INTO payments (id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')",
                [
                    p.id.as_str(), p.patient_id.as_str(), p.patient_name.as_str(), p.treatment_id.as_deref().unwrap_or_default(),
                    &p.amount.to_string(), p.date.as_str(), p.method.as_str(), p.status.as_str(),
                    p.notes.as_deref().unwrap_or_default(), p.created_at.as_str(), p.updated_at.as_str()
                ],
            );
        }
    }
    Ok(())
}
