use tauri::{AppHandle, command, State};
use std::sync::Mutex;
use rand::{thread_rng, Rng};
use rand::distributions::Alphanumeric;
use crate::hub::start_hub_server;
use crate::spoke::start_spoke_client;
use crate::commands::settings::set_setting;
use serde::{Deserialize, Serialize};
use local_ip_address::list_afinet_netifas;

pub struct GlobalState {
    pub mode: Mutex<String>, // "none", "hub", "spoke"
    pub pairing_code: Mutex<Option<String>>,
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
    let mode_guard = state.mode.lock().map_err(|e| e.to_string())?;
    let mode = &*mode_guard;
    if mode == "hub" {
        return Ok("Server Online".to_string());
    }
    if *mode == "spoke" {
        // In a real app, you'd check actual connectivity
        return Ok("Connected".to_string());
    }
    Ok("Standalone".to_string())
}
