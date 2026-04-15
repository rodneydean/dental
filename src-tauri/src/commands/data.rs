use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Manager};
use std::fs;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct DbStats {
    pub total_patients: i64,
    pub total_appointments: i64,
    pub total_treatments: i64,
    pub storage_used: String,
    pub last_backup: Option<String>,
}

#[command]
pub fn get_db_stats(app_handle: AppHandle) -> Result<DbStats, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    let total_patients: i64 = conn.query_row("SELECT COUNT(*) FROM patients", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let total_appointments: i64 = conn.query_row("SELECT COUNT(*) FROM appointments", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let total_treatments: i64 = conn.query_row("SELECT COUNT(*) FROM treatments", [], |row| row.get(0)).map_err(|e| e.to_string())?;

    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("dentist.db");

    let metadata = fs::metadata(db_path).map_err(|e| e.to_string())?;
    let size_kb = metadata.len() / 1024;
    let storage_used = if size_kb > 1024 {
        format!("{:.2} MB", (size_kb as f64) / 1024.0)
    } else {
        format!("{} KB", size_kb)
    };

    let last_backup: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'last_backup_at'",
        [],
        |row| row.get(0)
    ).ok();

    Ok(DbStats {
        total_patients,
        total_appointments,
        total_treatments,
        storage_used,
        last_backup,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResults {
    pub orphaned_appointments: i64,
    pub orphaned_treatments: i64,
    pub duplicate_patients: i64,
}

#[command]
pub fn validate_db_data(app_handle: AppHandle) -> Result<ValidationResults, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    let orphaned_appointments: i64 = conn.query_row(
        "SELECT COUNT(*) FROM appointments WHERE patient_id NOT IN (SELECT id FROM patients)",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let orphaned_treatments: i64 = conn.query_row(
        "SELECT COUNT(*) FROM treatments WHERE patient_id NOT IN (SELECT id FROM patients) OR appointment_id NOT IN (SELECT id FROM appointments)",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let duplicate_patients: i64 = conn.query_row(
        "SELECT COUNT(*) FROM (SELECT name, phone FROM patients GROUP BY name, phone HAVING COUNT(*) > 1)",
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    Ok(ValidationResults {
        orphaned_appointments,
        orphaned_treatments,
        duplicate_patients,
    })
}

#[command]
pub fn cleanup_db_data(app_handle: AppHandle) -> Result<i64, String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let deleted_appointments = tx.execute(
        "DELETE FROM appointments WHERE patient_id NOT IN (SELECT id FROM patients)",
        []
    ).map_err(|e| e.to_string())?;

    let deleted_treatments = tx.execute(
        "DELETE FROM treatments WHERE patient_id NOT IN (SELECT id FROM patients) OR appointment_id NOT IN (SELECT id FROM appointments)",
        []
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok((deleted_appointments + deleted_treatments) as i64)
}

#[command]
pub fn backup_db(app_handle: AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("dentist.db");

    let backup_dir = app_dir.join("backups");
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    }

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_path = backup_dir.join(format!("dentist_backup_{}.db", timestamp));

    fs::copy(db_path, &backup_path).map_err(|e| e.to_string())?;

    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('last_backup_at', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [now],
    ).map_err(|e| e.to_string())?;

    Ok(backup_path.to_string_lossy().to_string())
}
