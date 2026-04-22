use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Manager};
use std::fs;
use std::io::Write;
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};

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

    let backup_dir = app_dir.join("backups");
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    }

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_path = backup_dir.join(format!("dentist_backup_{}.db", timestamp));

    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute(&format!("VACUUM INTO '{}'", backup_path.to_string_lossy()), []).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('last_backup_at', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [now],
    ).map_err(|e| e.to_string())?;

    Ok(backup_path.to_string_lossy().to_string())
}

fn escape_csv(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[command]
pub fn export_to_csv(app_handle: AppHandle, data_type: String) -> Result<String, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let export_dir = app_dir.join("exports");
    if !export_dir.exists() {
        fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;
    }

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let file_path = export_dir.join(format!("{}_{}.csv", data_type, timestamp));
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;

    match data_type.as_str() {
        "patients" => {
            let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth FROM patients").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(format!("{},{},{},{},{}",
                    escape_csv(&row.get::<_, String>(0)?),
                    escape_csv(&row.get::<_, String>(1)?),
                    escape_csv(&row.get::<_, Option<String>>(2).unwrap_or_default().unwrap_or_default()),
                    escape_csv(&row.get::<_, Option<String>>(3).unwrap_or_default().unwrap_or_default()),
                    escape_csv(&row.get::<_, Option<String>>(4).unwrap_or_default().unwrap_or_default())
                ))
            }).map_err(|e| e.to_string())?;

            writeln!(file, "ID,Name,Phone,Email,DOB").map_err(|e| e.to_string())?;
            for row in rows {
                writeln!(file, "{}", row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        },
        "appointments" => {
            let mut stmt = conn.prepare("SELECT id, patient_name, date, time, status, type FROM appointments").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(format!("{},{},{},{},{},{}",
                    escape_csv(&row.get::<_, String>(0)?),
                    escape_csv(&row.get::<_, String>(1)?),
                    escape_csv(&row.get::<_, String>(2)?),
                    escape_csv(&row.get::<_, String>(3)?),
                    escape_csv(&row.get::<_, String>(4)?),
                    escape_csv(&row.get::<_, Option<String>>(5).unwrap_or_default().unwrap_or_default())
                ))
            }).map_err(|e| e.to_string())?;

            writeln!(file, "ID,Patient,Date,Time,Status,Type").map_err(|e| e.to_string())?;
            for row in rows {
                writeln!(file, "{}", row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        },
        "treatments" => {
            let mut stmt = conn.prepare("SELECT id, patient_name, date, diagnosis, cost FROM treatments").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(format!("{},{},{},{},{}",
                    escape_csv(&row.get::<_, String>(0)?),
                    escape_csv(&row.get::<_, String>(1)?),
                    escape_csv(&row.get::<_, String>(2)?),
                    escape_csv(&row.get::<_, Option<String>>(3).unwrap_or_default().unwrap_or_default()),
                    row.get::<_, f64>(4)?
                ))
            }).map_err(|e| e.to_string())?;

            writeln!(file, "ID,Patient,Date,Diagnosis,Cost").map_err(|e| e.to_string())?;
            for row in rows {
                writeln!(file, "{}", row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        },
        _ => return Err("Invalid data type".to_string()),
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupEntry {
    pub id: String,
    pub r#type: String,
    pub date: String,
    pub patient_count: i64,
    pub appointment_count: i64,
    pub treatment_count: i64,
    pub payment_count: i64,
}

#[command]
pub fn get_backup_history(app_handle: AppHandle) -> Result<Vec<BackupEntry>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = app_dir.join("backups");

    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    let dir_entries = fs::read_dir(backup_dir).map_err(|e| e.to_string())?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown_backup".to_string());

            if filename.starts_with("dentist_backup_") && filename.ends_with(".db") {
                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                let modified = metadata.modified().unwrap_or_else(|_| std::time::SystemTime::now());
                let datetime: chrono::DateTime<chrono::Utc> = modified.into();

                entries.push(BackupEntry {
                    id: filename,
                    r#type: "System Backup".to_string(),
                    date: datetime.to_rfc3339(),
                    patient_count: 0,
                    appointment_count: 0,
                    treatment_count: 0,
                    payment_count: 0,
                });
            }
        }
    }

    entries.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(entries)
}

#[command]
pub fn restore_db(app_handle: AppHandle, backup_id: String) -> Result<serde_json::Value, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("dentist.db");
    let backup_path = app_dir.join("backups").join(backup_id);

    if !backup_path.exists() {
        return Err("Backup file not found".to_string());
    }

    fs::copy(backup_path, db_path).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Database restored successfully. Please restart the application for changes to take full effect."
    }))
}

#[command]
pub fn import_db(app_handle: AppHandle, content: String) -> Result<serde_json::Value, String> {
    let decoded = general_purpose::STANDARD.decode(content).map_err(|e| e.to_string())?;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("dentist.db");

    fs::write(db_path, decoded).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Database imported successfully. Please restart the application for changes to take effect."
    }))
}
