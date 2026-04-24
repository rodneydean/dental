use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Emitter};
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
    pub preferred_payment_method: Option<String>,
    pub preferred_insurance_provider_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_patients(app_handle: AppHandle) -> Result<Vec<Patient>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, created_at, updated_at FROM patients ORDER BY created_at DESC").map_err(|e| e.to_string())?;

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
            preferred_payment_method: row.get(10)?,
            preferred_insurance_provider_id: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut patients = Vec::new();
    for patient in patient_iter {
        patients.push(patient.map_err(|e| e.to_string())?);
    }
    Ok(patients)
}

fn empty_to_none(s: Option<String>) -> Option<String> {
    match s {
        Some(val) if val.trim().is_empty() => None,
        _ => s,
    }
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
    preferred_payment_method: Option<String>,
    preferred_insurance_provider_id: Option<String>,
) -> Result<Patient, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let phone = empty_to_none(phone);
    let email = empty_to_none(email);
    let date_of_birth = empty_to_none(date_of_birth);
    let address = empty_to_none(address);
    let medical_history = empty_to_none(medical_history);
    let allergies = empty_to_none(allergies);
    let emergency_contact = empty_to_none(emergency_contact);
    let emergency_phone = empty_to_none(emergency_phone);
    let preferred_payment_method = empty_to_none(preferred_payment_method);
    let preferred_insurance_provider_id = empty_to_none(preferred_insurance_provider_id);

    conn.execute(
        "INSERT INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'pending')",
        [
            Some(id.clone()),
            Some(name.clone()),
            phone.clone(),
            email.clone(),
            date_of_birth.clone(),
            address.clone(),
            medical_history.clone(),
            allergies.clone(),
            emergency_contact.clone(),
            emergency_phone.clone(),
            preferred_payment_method.clone(),
            preferred_insurance_provider_id.clone(),
            Some(now.clone()),
            Some(now.clone()),
        ],
    ).map_err(|e| e.to_string())?;

    let _ = app_handle.emit("sync-event", serde_json::json!({ "type": "patient_registered", "name": name }));

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
        preferred_payment_method,
        preferred_insurance_provider_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn get_patient(app_handle: AppHandle, id: String) -> Result<Patient, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, created_at, updated_at FROM patients WHERE id = ?1").map_err(|e| e.to_string())?;

    let patient = stmt.query_row([id], |row| {
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
            preferred_payment_method: row.get(10)?,
            preferred_insurance_provider_id: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }).map_err(|e| e.to_string())?;

    Ok(patient)
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
    preferred_payment_method: Option<String>,
    preferred_insurance_provider_id: Option<String>,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let phone = empty_to_none(phone);
    let email = empty_to_none(email);
    let date_of_birth = empty_to_none(date_of_birth);
    let address = empty_to_none(address);
    let medical_history = empty_to_none(medical_history);
    let allergies = empty_to_none(allergies);
    let emergency_contact = empty_to_none(emergency_contact);
    let emergency_phone = empty_to_none(emergency_phone);
    let preferred_payment_method = empty_to_none(preferred_payment_method);
    let preferred_insurance_provider_id = empty_to_none(preferred_insurance_provider_id);

    conn.execute(
        "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, sync_status = 'pending' WHERE id = ?13",
        [
            Some(name),
            phone,
            email,
            date_of_birth,
            address,
            medical_history,
            allergies,
            emergency_contact,
            emergency_phone,
            preferred_payment_method,
            preferred_insurance_provider_id,
            Some(now),
            Some(id),
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatientNote {
    pub id: String,
    pub patient_id: String,
    pub doctor_id: String,
    pub doctor_name: String,
    pub note_type: String,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_patient_notes(app_handle: AppHandle, patient_id: String) -> Result<Vec<PatientNote>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at FROM patient_notes WHERE patient_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;

    let note_iter = stmt.query_map([patient_id], |row| {
        Ok(PatientNote {
            id: row.get(0)?,
            patient_id: row.get(1)?,
            doctor_id: row.get(2)?,
            doctor_name: row.get(3)?,
            note_type: row.get(4)?,
            note: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[command]
pub fn create_patient_note(
    app_handle: AppHandle,
    patient_id: String,
    doctor_id: String,
    doctor_name: String,
    note_type: String,
    note: String,
) -> Result<PatientNote, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO patient_notes (id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending')",
        [
            Some(id.clone()),
            Some(patient_id.clone()),
            Some(doctor_id.clone()),
            Some(doctor_name.clone()),
            Some(note_type.clone()),
            Some(note.clone()),
            Some(now.clone()),
            Some(now.clone()),
        ],
    ).map_err(|e| e.to_string())?;

    Ok(PatientNote {
        id,
        patient_id,
        doctor_id,
        doctor_name,
        note_type,
        note,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn update_patient_note(
    app_handle: AppHandle,
    id: String,
    note_type: String,
    note: String,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE patient_notes SET note_type = ?1, note = ?2, updated_at = ?3, sync_status = 'pending' WHERE id = ?4",
        [note_type, note, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn delete_patient_note(app_handle: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM patient_notes WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SickSheet {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub doctor_id: String,
    pub doctor_name: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: String,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_sick_sheets(app_handle: AppHandle, patient_id: String) -> Result<Vec<SickSheet>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at FROM sick_sheets WHERE patient_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;

    let sheet_iter = stmt.query_map([patient_id], |row| {
        Ok(SickSheet {
            id: row.get(0)?,
            patient_id: row.get(1)?,
            patient_name: row.get(2)?,
            doctor_id: row.get(3)?,
            doctor_name: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
            reason: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut sheets = Vec::new();
    for sheet in sheet_iter {
        sheets.push(sheet.map_err(|e| e.to_string())?);
    }
    Ok(sheets)
}

#[command]
pub fn create_sick_sheet(
    app_handle: AppHandle,
    patient_id: String,
    patient_name: String,
    doctor_id: String,
    doctor_name: String,
    start_date: String,
    end_date: String,
    reason: String,
) -> Result<SickSheet, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sick_sheets (id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending')",
        [
            Some(id.clone()),
            Some(patient_id.clone()),
            Some(patient_name.clone()),
            Some(doctor_id.clone()),
            Some(doctor_name.clone()),
            Some(start_date.clone()),
            Some(end_date.clone()),
            Some(reason.clone()),
            Some(now.clone()),
            Some(now.clone()),
        ],
    ).map_err(|e| e.to_string())?;

    Ok(SickSheet {
        id,
        patient_id,
        patient_name,
        doctor_id,
        doctor_name,
        start_date,
        end_date,
        reason,
        created_at: now.clone(),
        updated_at: now,
    })
}
