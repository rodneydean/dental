use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Appointment {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub date: String,
    pub time: String,
    pub status: String,
    pub appointment_type: Option<String>,
    pub notes: Option<String>,
    pub duration: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_appointments(app_handle: AppHandle) -> Result<Vec<Appointment>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at FROM appointments").map_err(|e| e.to_string())?;

    let appointment_iter = stmt.query_map([], |row| {
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
    }).map_err(|e| e.to_string())?;

    let mut appointments = Vec::new();
    for appointment in appointment_iter {
        appointments.push(appointment.map_err(|e| e.to_string())?);
    }
    Ok(appointments)
}

#[command]
pub fn create_appointment(
    app_handle: AppHandle,
    patient_id: String,
    patient_name: String,
    date: String,
    time: String,
    status: String,
    appointment_type: Option<String>,
    notes: Option<String>,
    duration: Option<i32>,
) -> Result<Appointment, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let duration_str = duration.unwrap_or(30).to_string();
    conn.execute(
        "INSERT INTO appointments (id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        [
            id.as_str(),
            patient_id.as_str(),
            patient_name.as_str(),
            date.as_str(),
            time.as_str(),
            status.as_str(),
            appointment_type.as_deref().unwrap_or_default(),
            notes.as_deref().unwrap_or_default(),
            duration_str.as_str(),
            now.as_str(),
            now.as_str()
        ],
    ).map_err(|e| e.to_string())?;

    Ok(Appointment {
        id,
        patient_id,
        patient_name,
        date,
        time,
        status,
        appointment_type,
        notes,
        duration,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn update_appointment(
    app_handle: AppHandle,
    id: String,
    date: String,
    time: String,
    status: String,
    appointment_type: Option<String>,
    notes: Option<String>,
    duration: Option<i32>,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let duration_str = duration.unwrap_or(30).to_string();
    conn.execute(
        "UPDATE appointments SET date = ?1, time = ?2, status = ?3, type = ?4, notes = ?5, duration = ?6, updated_at = ?7 WHERE id = ?8",
        [
            date.as_str(),
            time.as_str(),
            status.as_str(),
            appointment_type.as_deref().unwrap_or_default(),
            notes.as_deref().unwrap_or_default(),
            duration_str.as_str(),
            now.as_str(),
            id.as_str()
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn delete_appointment(app_handle: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM appointments WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;
    Ok(())
}
