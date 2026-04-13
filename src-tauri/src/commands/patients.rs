use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub date_of_birth: Option<String>,
    pub address: Option<String>,
    pub medical_history: Option<String>,
    pub allergies: Option<String>,
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_patients(app_handle: AppHandle) -> Result<Vec<Patient>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at FROM patients").map_err(|e| e.to_string())?;

    let patient_iter = stmt.query_map([], |row| {
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
    }).map_err(|e| e.to_string())?;

    let mut patients = Vec::new();
    for patient in patient_iter {
        patients.push(patient.map_err(|e| e.to_string())?);
    }
    Ok(patients)
}

#[command]
pub fn create_patient(
    app_handle: AppHandle,
    name: String,
    phone: Option<String>,
    email: Option<String>,
    date_of_birth: Option<String>,
    address: Option<String>,
    medical_history: Option<String>,
    allergies: Option<String>,
    emergency_contact: Option<String>,
    emergency_phone: Option<String>,
) -> Result<Patient, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        [&id, &name, &phone.unwrap_or_default(), &email.unwrap_or_default(), &date_of_birth.unwrap_or_default(), &address.unwrap_or_default(), &medical_history.unwrap_or_default(), &allergies.unwrap_or_default(), &emergency_contact.unwrap_or_default(), &emergency_phone.unwrap_or_default(), &now, &now],
    ).map_err(|e| e.to_string())?;

    Ok(Patient {
        id,
        name,
        phone,
        email,
        date_of_birth,
        address,
        medical_history,
        allergies,
        emergency_contact,
        emergency_phone,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn update_patient(
    app_handle: AppHandle,
    id: String,
    name: String,
    phone: Option<String>,
    email: Option<String>,
    date_of_birth: Option<String>,
    address: Option<String>,
    medical_history: Option<String>,
    allergies: Option<String>,
    emergency_contact: Option<String>,
    emergency_phone: Option<String>,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, updated_at = ?10 WHERE id = ?11",
        [&name, &phone.unwrap_or_default(), &email.unwrap_or_default(), &date_of_birth.unwrap_or_default(), &address.unwrap_or_default(), &medical_history.unwrap_or_default(), &allergies.unwrap_or_default(), &emergency_contact.unwrap_or_default(), &emergency_phone.unwrap_or_default(), &now, &id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
