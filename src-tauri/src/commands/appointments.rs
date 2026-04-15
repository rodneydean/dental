use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Emitter};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Appointment {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub doctor_id: Option<String>,
    pub doctor_name: Option<String>,
    pub date: String,
    pub time: String,
    pub status: String, // 'scheduled', 'admitted', 'in_consultation', 'completed', 'cancelled'
    pub appointment_type: Option<String>,
    pub notes: Option<String>,
    pub duration: Option<i32>,
    pub reception_fee_paid: bool,
    pub reception_fee_waived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_appointments(app_handle: AppHandle) -> Result<Vec<Appointment>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, date, time, status, type, notes, duration, reception_fee_paid, reception_fee_waived, created_at, updated_at FROM appointments").map_err(|e| e.to_string())?;

    let appointment_iter = stmt.query_map([], |row| {
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
    doctor_id: Option<String>,
    doctor_name: Option<String>,
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

    let actual_duration = duration.unwrap_or(30);
    conn.execute(
        "INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, date, time, status, type, notes, duration, reception_fee_paid, reception_fee_waived, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, 0, ?12, ?13, 'pending')",
        rusqlite::params![
            id,
            patient_id,
            patient_name,
            doctor_id,
            doctor_name,
            date,
            time,
            status,
            appointment_type,
            notes,
            actual_duration,
            now,
            now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(Appointment {
        id,
        patient_id,
        patient_name,
        doctor_id,
        doctor_name,
        date,
        time,
        status,
        appointment_type,
        notes,
        duration,
        reception_fee_paid: false,
        reception_fee_waived: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn update_appointment(
    app_handle: AppHandle,
    id: String,
    doctor_id: Option<String>,
    doctor_name: Option<String>,
    date: String,
    time: String,
    status: String,
    appointment_type: Option<String>,
    notes: Option<String>,
    duration: Option<i32>,
    reception_fee_paid: Option<bool>,
    reception_fee_waived: Option<bool>,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let actual_duration = duration.unwrap_or(30);

    // We fetch current values if not provided for boolean fields
    let (current_paid, current_waived): (bool, bool) = conn.query_row(
        "SELECT reception_fee_paid, reception_fee_waived FROM appointments WHERE id = ?1",
        [&id],
        |row| Ok((row.get::<_, bool>(0)?, row.get::<_, bool>(1)?))
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE appointments SET doctor_id = ?1, doctor_name = ?2, date = ?3, time = ?4, status = ?5, type = ?6, notes = ?7, duration = ?8, reception_fee_paid = ?9, reception_fee_waived = ?10, updated_at = ?11, sync_status = 'pending' WHERE id = ?12",
        rusqlite::params![
            doctor_id.clone(),
            doctor_name,
            date,
            time,
            status.clone(),
            appointment_type,
            notes,
            actual_duration,
            reception_fee_paid.unwrap_or(current_paid),
            reception_fee_waived.unwrap_or(current_waived),
            now,
            id
        ],
    ).map_err(|e| e.to_string())?;

    if status == "admitted" {
        let patient_name: String = conn.query_row(
            "SELECT patient_name FROM appointments WHERE id = ?1",
            [&id],
            |row| row.get(0)
        ).unwrap_or_else(|_| "Unknown".to_string());

        let _ = app_handle.emit("sync-event", serde_json::json!({
            "type": "patient_admitted",
            "patient_name": patient_name,
            "doctor_id": doctor_id
        }));
    }

    Ok(())
}

#[command]
pub fn delete_appointment(app_handle: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM appointments WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;
    Ok(())
}
