use tauri::{AppHandle, command, State, Manager};
use std::sync::{Arc, Mutex};
use rand::{thread_rng, Rng};
use rand::distributions::Alphanumeric;
use crate::hub::start_hub_server;
use crate::spoke::start_spoke_client;

pub struct GlobalState {
    pub mode: Mutex<String>, // "none", "hub", "spoke"
    pub pairing_code: Mutex<Option<String>>,
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
        let mut g_mode = state.mode.lock().unwrap();
        *g_mode = "hub".to_string();
        let mut g_code = state.pairing_code.lock().unwrap();
        *g_code = Some(code_upper.clone());
    }

    let app_clone = app_handle.clone();
    let code_clone = code_upper.clone();
    tokio::spawn(async move {
        let _ = start_hub_server(app_clone, code_clone).await;
    });

    Ok(code_upper)
}

#[command]
pub fn start_as_spoke(app_handle: AppHandle, state: State<'_, GlobalState>, code: String, manual_addr: Option<String>) -> Result<(), String> {
    {
        let mut g_mode = state.mode.lock().unwrap();
        *g_mode = "spoke".to_string();
        let mut g_code = state.pairing_code.lock().unwrap();
        *g_code = Some(code.clone());
    }
    let app_clone = app_handle.clone();
    tokio::spawn(async move {
        start_spoke_client(app_clone, code, manual_addr).await;
    });
    Ok(())
}

#[command]
pub fn get_connection_status(state: State<'_, GlobalState>) -> Result<String, String> {
    let mode = state.mode.lock().unwrap();
    if *mode == "hub" {
        return Ok("Server Online".to_string());
    }
    if *mode == "spoke" {
        // In a real app, you'd check actual connectivity
        return Ok("Connected".to_string());
    }
    Ok("Standalone".to_string())
}
