use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Manager};
use std::fs;
use std::io::Write;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[command]
pub fn get_setting(app_handle: AppHandle, key: String) -> Result<Option<String>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let val = stmt.query_row([key], |row| row.get(0)).ok();
    Ok(val)
}

#[command]
pub fn set_setting(app_handle: AppHandle, key: String, value: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn list_settings(app_handle: AppHandle) -> Result<Vec<Setting>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM settings").map_err(|e| e.to_string())?;
    let setting_iter = stmt.query_map([], |row| {
        Ok(Setting {
            key: row.get(0)?,
            value: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut settings = Vec::new();
    for setting in setting_iter {
        settings.push(setting.map_err(|e| e.to_string())?);
    }
    Ok(settings)
}

#[command]
pub fn save_logo(app_handle: AppHandle, base64_image: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    let logo_path = app_dir.join("clinic_logo.png");

    // Remove data:image/png;base64, prefix if present
    let base64_data = if base64_image.contains(',') {
        base64_image.split(',').collect::<Vec<&str>>()[1]
    } else {
        &base64_image
    };

    let decoded = general_purpose::STANDARD.decode(base64_data).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(&logo_path).map_err(|e| e.to_string())?;
    file.write_all(&decoded).map_err(|e| e.to_string())?;

    Ok(logo_path.to_string_lossy().to_string())
}

#[command]
pub fn get_logo(app_handle: AppHandle) -> Result<Option<String>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logo_path = app_dir.join("clinic_logo.png");

    if !logo_path.exists() {
        return Ok(None);
    }

    let data = fs::read(logo_path).map_err(|e| e.to_string())?;
    let base64_data = general_purpose::STANDARD.encode(data);
    Ok(Some(format!("data:image/png;base64,{}", base64_data)))
}
