use tauri::{AppHandle, command, State};
use std::sync::Mutex;
use rand::{thread_rng, Rng};
use rand::distributions::Alphanumeric;
use crate::hub::start_hub_server;
use crate::spoke::start_spoke_client;
use crate::commands::settings::set_setting;
use serde::{Deserialize, Serialize};
use local_ip_address::list_afinet_netifas;
use mdns_sd::{ServiceDaemon, ServiceEvent};

pub struct GlobalState {
    pub mode: Mutex<String>, // "none", "hub", "spoke"
    pub pairing_code: Mutex<Option<String>>,
    pub is_connected: Mutex<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkInfo {
    pub mode: String,
    pub pairing_code: Option<String>,
    pub local_ips: Vec<String>,
}

#[command]
pub fn get_local_ips() -> Vec<String> {
    let mut ips = Vec::new();
    if let Ok(network_interfaces) = list_afinet_netifas() {
        for (_name, ip) in network_interfaces {
            if ip.is_ipv4() && !ip.is_loopback() {
                ips.push(ip.to_string());
            }
        }
    }
    ips
}

#[command]
pub fn get_network_info(state: State<'_, GlobalState>) -> NetworkInfo {
    let mode = state.mode.lock().map(|m| m.clone()).unwrap_or_else(|_| "none".to_string());
    let pairing_code = state.pairing_code.lock().map(|c| c.clone()).unwrap_or(None);
    let local_ips = get_local_ips();

NetworkInfo {
        mode,
        pairing_code,
        local_ips,
    }
}

#[command]
pub fn start_as_hub(app_handle: AppHandle, state: State<'_, GlobalState>) -> Result<String, String> {
    let code: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(6)
        .map(char::from)
        .collect();

    let code_upper = code.to_uppercase();

    {
        if let Ok(mut g_mode) = state.mode.lock() {
            *g_mode = "hub".to_string();
        }
        if let Ok(mut g_code) = state.pairing_code.lock() {
            *g_code = Some(code_upper.clone());
        }
    }

    // Persist settings
    let _ = set_setting(app_handle.clone(), "network_mode".to_string(), "hub".to_string());
    let _ = set_setting(app_handle.clone(), "pairing_code".to_string(), code_upper.clone());

    let app_clone = app_handle.clone();
    let code_clone = code_upper.clone();

    // FIX: Use Tauri's async runtime instead of bare tokio::spawn
    tauri::async_runtime::spawn(async move {
        let _ = start_hub_server(app_clone, code_clone).await;
    });

    Ok(code_upper)
}

#[command]
pub fn start_as_spoke(app_handle: AppHandle, state: State<'_, GlobalState>, code: String, manual_addr: Option<String>) -> Result<(), String> {
    {
        if let Ok(mut g_mode) = state.mode.lock() {
            *g_mode = "spoke".to_string();
        }
        if let Ok(mut g_code) = state.pairing_code.lock() {
            *g_code = Some(code.clone());
        }
    }

    // Persist settings
    let _ = set_setting(app_handle.clone(), "network_mode".to_string(), "spoke".to_string());
    let _ = set_setting(app_handle.clone(), "pairing_code".to_string(), code.clone());
    if let Some(ref addr) = manual_addr {
        let _ = set_setting(app_handle.clone(), "hub_address".to_string(), addr.clone());
    }

    let app_clone = app_handle.clone();

    // FIX: Use Tauri's async runtime instead of bare tokio::spawn
    tauri::async_runtime::spawn(async move {
        start_spoke_client(app_clone, code, manual_addr).await;
    });

    Ok(())
}

#[command]
pub fn get_connection_status(state: State<'_, GlobalState>) -> Result<String, String> {
    let mode = state.mode.lock().map(|m| m.clone()).unwrap_or_else(|_| "none".to_string());
    let connected = state.is_connected.lock().map(|c| *c).unwrap_or(false);

    if mode == "hub" {
        return Ok("Server Online".to_string());
    }
    if mode == "spoke" {
        if connected {
            return Ok("Connected".to_string());
        } else {
            return Ok("Reconnecting...".to_string());
        }
    }
    Ok("Standalone".to_string())
}

#[command]
pub async fn verify_hub_connection(code: String, manual_addr: Option<String>) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let addresses_to_try = if let Some(addr) = manual_addr {
        vec![addr]
    } else {
        tokio::task::spawn_blocking(move || {
            let mut addrs = Vec::new();
            let mdns = ServiceDaemon::new().ok()?;
            let service_type = "_dentist-hub._tcp.local.";
            let receiver = mdns.browse(service_type).ok()?;

            let start = std::time::Instant::now();
            while start.elapsed() < std::time::Duration::from_secs(3) {
                if let Ok(event) = receiver.recv_timeout(std::time::Duration::from_millis(500)) {
                    if let ServiceEvent::ServiceResolved(info) = event {
                        let port = info.get_port();
                        for addr in info.get_addresses() {
                            addrs.push(format!("{}:{}", addr, port));
                        }
                    }
                }
            }
            Some(addrs)
        }).await.map_err(|e| e.to_string())?.ok_or("Failed to initialize mDNS discovery")?
    };

    if addresses_to_try.is_empty() {
        return Err("No Hub found on the network. Please ensure the Hub is running and firewall is off.".to_string());
    }

    for addr in addresses_to_try {
        let res = client.post(format!("http://{}/pair", addr))
            .json(&serde_json::json!({ "code": code }))
            .send()
            .await;

        if let Ok(response) = res {
            if response.status().is_success() {
                return Ok(true);
            }
        }
    }

    Err("Found Hub(s) but could not pair. Please check your pairing code.".to_string())
}

#[command]
pub fn restart_app() {
    if let Ok(current_exe) = std::env::current_exe() {
        let _ = std::process::Command::new(current_exe).spawn();
        std::process::exit(0);
    }
}
