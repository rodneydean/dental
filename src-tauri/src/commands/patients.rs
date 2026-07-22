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

pub fn merge_field<T: Clone>(val_a: Option<T>, val_b: Option<T>, a_is_newer: bool) -> Option<T> {
    match (val_a, val_b) {
        (Some(a), Some(b)) => {
            if a_is_newer {
                Some(a)
            } else {
                Some(b)
            }
        }
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

pub fn merge_patients_internal(
    conn: &mut rusqlite::Connection,
    keep_id: &str,
    delete_id: &str,
) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;

    // Retrieve keep patient
    let mut stmt = tx.prepare(
        "SELECT id, name, phone, email, date_of_birth, address, medical_history, allergies, \
         emergency_contact, emergency_phone, preferred_payment_method, preferred_insurance_provider_id, \
         created_at, updated_at FROM patients WHERE id = ?1"
    )?;

    let keep_pat = stmt.query_row([keep_id], |row| {
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
    });

    let delete_pat = stmt.query_row([delete_id], |row| {
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
    });

    // If either patient is missing, nothing to merge.
    let (keep_p, delete_p) = match (keep_pat, delete_pat) {
        (Ok(k), Ok(d)) => (k, d),
        _ => return Ok(()),
    };

    // Determine which is newer based on updated_at
    let a_is_newer = keep_p.updated_at >= delete_p.updated_at;

    // Merge fields
    let merged_name = if a_is_newer { keep_p.name.clone() } else { delete_p.name.clone() };

    let merged_phone = merge_field(keep_p.phone.clone(), delete_p.phone.clone(), a_is_newer);
    let merged_email = merge_field(keep_p.email.clone(), delete_p.email.clone(), a_is_newer);
    let merged_dob = merge_field(keep_p.date_of_birth.clone(), delete_p.date_of_birth.clone(), a_is_newer);
    let merged_address = merge_field(keep_p.address.clone(), delete_p.address.clone(), a_is_newer);
    let merged_med_hist = merge_field(keep_p.medical_history.clone(), delete_p.medical_history.clone(), a_is_newer);
    let merged_allergies = merge_field(keep_p.allergies.clone(), delete_p.allergies.clone(), a_is_newer);
    let merged_em_contact = merge_field(keep_p.emergency_contact.clone(), delete_p.emergency_contact.clone(), a_is_newer);
    let merged_em_phone = merge_field(keep_p.emergency_phone.clone(), delete_p.emergency_phone.clone(), a_is_newer);
    let merged_pref_payment = merge_field(keep_p.preferred_payment_method.clone(), delete_p.preferred_payment_method.clone(), a_is_newer);
    let merged_pref_ins = merge_field(keep_p.preferred_insurance_provider_id.clone(), delete_p.preferred_insurance_provider_id.clone(), a_is_newer);

    let now = chrono::Utc::now().to_rfc3339();

    // Drop stmt to release borrow on tx
    drop(stmt);

    // Temporarily clear the unique constraint of the delete patient to allow update of keep patient
    tx.execute(
        "UPDATE patients SET phone = NULL WHERE id = ?1",
        [delete_id],
    )?;

    // Update survivor patient fields
    tx.execute(
        "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, \
         medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, \
         preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, \
         sync_status = 'pending' WHERE id = ?13",
        rusqlite::params![
            merged_name,
            merged_phone,
            merged_email,
            merged_dob,
            merged_address,
            merged_med_hist,
            merged_allergies,
            merged_em_contact,
            merged_em_phone,
            merged_pref_payment,
            merged_pref_ins,
            now,
            keep_id,
        ],
    )?;

    // Update associated tables
    tx.execute(
        "UPDATE appointments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
        rusqlite::params![keep_id, merged_name, now, delete_id],
    )?;

    tx.execute(
        "UPDATE treatments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
        rusqlite::params![keep_id, merged_name, now, delete_id],
    )?;

    tx.execute(
        "UPDATE payments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
        rusqlite::params![keep_id, merged_name, now, delete_id],
    )?;

    tx.execute(
        "UPDATE patient_notes SET patient_id = ?1, updated_at = ?2, sync_status = 'pending' WHERE patient_id = ?3",
        rusqlite::params![keep_id, now, delete_id],
    )?;

    tx.execute(
        "UPDATE sick_sheets SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
        rusqlite::params![keep_id, merged_name, now, delete_id],
    )?;

    tx.execute(
        "UPDATE waiver_requests SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
        rusqlite::params![keep_id, merged_name, now, delete_id],
    )?;

    // Finally delete duplicate patient safely (no foreign keys are broken because children now point to keep_id)
    tx.execute("DELETE FROM patients WHERE id = ?1", [delete_id])?;

    // Record the deletion of duplicate patient B in deleted_records
    let deletion_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'patients', ?2, ?3, 'pending')",
        [deletion_id, delete_id.to_string(), now],
    )?;

    tx.commit()?;
    Ok(())
}

fn normalize_phone(phone: Option<String>) -> Option<String> {
    phone.map(|p| {
        let normalized: String = p.chars()
            .filter(|c| c.is_ascii_digit() || *c == '+')
            .collect();
        if normalized.is_empty() {
            "".to_string()
        } else {
            normalized
        }
    }).and_then(|s| if s.is_empty() { None } else { Some(s) })
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

    let phone = normalize_phone(phone);
    let email = empty_to_none(email);
    let date_of_birth = empty_to_none(date_of_birth);
    let address = empty_to_none(address);
    let medical_history = empty_to_none(medical_history);
    let allergies = empty_to_none(allergies);
    let emergency_contact = empty_to_none(emergency_contact);
    let emergency_phone = normalize_phone(emergency_phone);
    let preferred_payment_method = empty_to_none(preferred_payment_method);
    let preferred_insurance_provider_id = empty_to_none(preferred_insurance_provider_id);

    // Check if a patient with the same name and phone already exists
    let existing_patient_id: Option<String> = if phone.is_some() {
        let stmt = conn.prepare("SELECT id FROM patients WHERE name = ?1 AND phone = ?2").ok();
        if let Some(mut s) = stmt {
            s.query_row(rusqlite::params![name, phone], |row| row.get(0)).ok()
        } else {
            None
        }
    } else {
        None
    };

    if let Some(keep_id) = existing_patient_id {
        let keep_p = get_patient(app_handle.clone(), keep_id.clone())?;

        let a_is_newer = false; // Incoming parameters are newer, so incoming wins
        let merged_name = name;
        let merged_phone = phone;
        let merged_email = merge_field(keep_p.email, email, a_is_newer);
        let merged_dob = merge_field(keep_p.date_of_birth, date_of_birth, a_is_newer);
        let merged_address = merge_field(keep_p.address, address, a_is_newer);
        let merged_med_hist = merge_field(keep_p.medical_history, medical_history, a_is_newer);
        let merged_allergies = merge_field(keep_p.allergies, allergies, a_is_newer);
        let merged_em_contact = merge_field(keep_p.emergency_contact, emergency_contact, a_is_newer);
        let merged_em_phone = merge_field(keep_p.emergency_phone, emergency_phone, a_is_newer);
        let merged_pref_payment = merge_field(keep_p.preferred_payment_method, preferred_payment_method, a_is_newer);
        let merged_pref_ins = merge_field(keep_p.preferred_insurance_provider_id, preferred_insurance_provider_id, a_is_newer);

        // Update the survivor patient with the merged fields directly
        conn.execute(
            "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, \
             medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, \
             preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, \
             sync_status = 'pending' WHERE id = ?13",
            rusqlite::params![
                merged_name,
                merged_phone,
                merged_email,
                merged_dob,
                merged_address,
                merged_med_hist,
                merged_allergies,
                merged_em_contact,
                merged_em_phone,
                merged_pref_payment,
                merged_pref_ins,
                now,
                keep_id,
            ],
        ).map_err(|e| e.to_string())?;

        // Retrieve and return the updated patient
        let merged_patient = get_patient(app_handle.clone(), keep_id)?;
        let _ = app_handle.emit("sync-event", serde_json::json!({ "type": "patient_registered", "name": merged_patient.name }));
        return Ok(merged_patient);
    }

    let res = conn.execute(
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
    );

    match res {
        Ok(_) => {
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
        },
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == rusqlite::ErrorCode::ConstraintViolation => {
            // Dual safety fallback: try to find duplicate again and merge
            let mut stmt = conn.prepare("SELECT id FROM patients WHERE name = ?1 AND phone = ?2").map_err(|e| e.to_string())?;
            let keep_id = stmt.query_row(rusqlite::params![name, phone], |row| row.get::<_, String>(0));
            drop(stmt);

            if let Ok(k_id) = keep_id {
                let keep_p = get_patient(app_handle.clone(), k_id.clone())?;
                let a_is_newer = false;
                let merged_name = name;
                let merged_phone = phone;
                let merged_email = merge_field(keep_p.email, email, a_is_newer);
                let merged_dob = merge_field(keep_p.date_of_birth, date_of_birth, a_is_newer);
                let merged_address = merge_field(keep_p.address, address, a_is_newer);
                let merged_med_hist = merge_field(keep_p.medical_history, medical_history, a_is_newer);
                let merged_allergies = merge_field(keep_p.allergies, allergies, a_is_newer);
                let merged_em_contact = merge_field(keep_p.emergency_contact, emergency_contact, a_is_newer);
                let merged_em_phone = merge_field(keep_p.emergency_phone, emergency_phone, a_is_newer);
                let merged_pref_payment = merge_field(keep_p.preferred_payment_method, preferred_payment_method, a_is_newer);
                let merged_pref_ins = merge_field(keep_p.preferred_insurance_provider_id, preferred_insurance_provider_id, a_is_newer);

                conn.execute(
                    "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, \
                     medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, \
                     preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, \
                     sync_status = 'pending' WHERE id = ?13",
                    rusqlite::params![
                        merged_name,
                        merged_phone,
                        merged_email,
                        merged_dob,
                        merged_address,
                        merged_med_hist,
                        merged_allergies,
                        merged_em_contact,
                        merged_em_phone,
                        merged_pref_payment,
                        merged_pref_ins,
                        now,
                        k_id,
                    ],
                ).map_err(|e| e.to_string())?;

                let merged_patient = get_patient(app_handle.clone(), k_id)?;
                let _ = app_handle.emit("sync-event", serde_json::json!({ "type": "patient_registered", "name": merged_patient.name }));
                Ok(merged_patient)
            } else {
                Err("A patient with this name and phone number already exists".to_string())
            }
        },
        Err(e) => Err(e.to_string()),
    }
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
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let phone = normalize_phone(phone);
    let email = empty_to_none(email);
    let date_of_birth = empty_to_none(date_of_birth);
    let address = empty_to_none(address);
    let medical_history = empty_to_none(medical_history);
    let allergies = empty_to_none(allergies);
    let emergency_contact = empty_to_none(emergency_contact);
    let emergency_phone = normalize_phone(emergency_phone);
    let preferred_payment_method = empty_to_none(preferred_payment_method);
    let preferred_insurance_provider_id = empty_to_none(preferred_insurance_provider_id);

    // If updating a patient to have name and phone identical to another patient, we merge them
    let target_patient_id: Option<String> = if phone.is_some() {
        let mut stmt = conn.prepare("SELECT id FROM patients WHERE name = ?1 AND phone = ?2 AND id != ?3").map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![name, phone, id], |row| row.get(0)).ok()
    } else {
        None
    };

    if let Some(keep_id) = target_patient_id {
        let keep_p = get_patient(app_handle.clone(), keep_id.clone())?;

        let a_is_newer = false; // B's edited values are newer, so B wins
        let merged_name = name;
        let merged_phone = phone;
        let merged_email = merge_field(keep_p.email, email, a_is_newer);
        let merged_dob = merge_field(keep_p.date_of_birth, date_of_birth, a_is_newer);
        let merged_address = merge_field(keep_p.address, address, a_is_newer);
        let merged_med_hist = merge_field(keep_p.medical_history, medical_history, a_is_newer);
        let merged_allergies = merge_field(keep_p.allergies, allergies, a_is_newer);
        let merged_em_contact = merge_field(keep_p.emergency_contact, emergency_contact, a_is_newer);
        let merged_em_phone = merge_field(keep_p.emergency_phone, emergency_phone, a_is_newer);
        let merged_pref_payment = merge_field(keep_p.preferred_payment_method, preferred_payment_method, a_is_newer);
        let merged_pref_ins = merge_field(keep_p.preferred_insurance_provider_id, preferred_insurance_provider_id, a_is_newer);

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // 1. Temporarily clear the unique constraint on B (id) to allow updating A
        tx.execute(
            "UPDATE patients SET phone = NULL WHERE id = ?1",
            [&id],
        ).map_err(|e| e.to_string())?;

        // 2. Update A with merged fields
        tx.execute(
            "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, \
             medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, \
             preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, \
             sync_status = 'pending' WHERE id = ?13",
            rusqlite::params![
                merged_name,
                merged_phone,
                merged_email,
                merged_dob,
                merged_address,
                merged_med_hist,
                merged_allergies,
                merged_em_contact,
                merged_em_phone,
                merged_pref_payment,
                merged_pref_ins,
                now,
                keep_id,
            ],
        ).map_err(|e| e.to_string())?;

        // 3. Update associated tables to point from B (id) to A (keep_id)
        tx.execute(
            "UPDATE appointments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
            rusqlite::params![&keep_id, &merged_name, &now, &id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE treatments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
            rusqlite::params![&keep_id, &merged_name, &now, &id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE payments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
            rusqlite::params![&keep_id, &merged_name, &now, &id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE patient_notes SET patient_id = ?1, updated_at = ?2, sync_status = 'pending' WHERE patient_id = ?3",
            rusqlite::params![&keep_id, &now, &id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE sick_sheets SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
            rusqlite::params![&keep_id, &merged_name, &now, &id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE waiver_requests SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
            rusqlite::params![&keep_id, &merged_name, &now, &id],
        ).map_err(|e| e.to_string())?;

        // 4. Delete B (id) safely
        tx.execute("DELETE FROM patients WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

        // 5. Record deletion in deleted_records
        let deletion_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'patients', ?2, ?3, 'pending')",
            [deletion_id, id, now],
        ).map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let res = conn.execute(
        "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, sync_status = 'pending' WHERE id = ?13",
        [
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
            Some(id.clone()),
        ],
    );

    match res {
        Ok(_) => Ok(()),
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == rusqlite::ErrorCode::ConstraintViolation => {
            // Dual safety fallback: try to find duplicate again and merge
            let mut stmt = conn.prepare("SELECT id FROM patients WHERE name = ?1 AND phone = ?2 AND id != ?3").map_err(|e| e.to_string())?;
            let keep_id = stmt.query_row(rusqlite::params![name, phone, id], |row| row.get::<_, String>(0));
            drop(stmt);

            if let Ok(k_id) = keep_id {
                let keep_p = get_patient(app_handle.clone(), k_id.clone())?;

                let a_is_newer = false; // B's edited values are newer, so B wins
                let merged_name = name;
                let merged_phone = phone;
                let merged_email = merge_field(keep_p.email, email, a_is_newer);
                let merged_dob = merge_field(keep_p.date_of_birth, date_of_birth, a_is_newer);
                let merged_address = merge_field(keep_p.address, address, a_is_newer);
                let merged_med_hist = merge_field(keep_p.medical_history, medical_history, a_is_newer);
                let merged_allergies = merge_field(keep_p.allergies, allergies, a_is_newer);
                let merged_em_contact = merge_field(keep_p.emergency_contact, emergency_contact, a_is_newer);
                let merged_em_phone = merge_field(keep_p.emergency_phone, emergency_phone, a_is_newer);
                let merged_pref_payment = merge_field(keep_p.preferred_payment_method, preferred_payment_method, a_is_newer);
                let merged_pref_ins = merge_field(keep_p.preferred_insurance_provider_id, preferred_insurance_provider_id, a_is_newer);

                let tx = conn.transaction().map_err(|e| e.to_string())?;

                // 1. Temporarily clear the unique constraint on B (id) to allow updating A
                tx.execute(
                    "UPDATE patients SET phone = NULL WHERE id = ?1",
                    [&id],
                ).map_err(|e| e.to_string())?;

                // 2. Update A with merged fields
                tx.execute(
                    "UPDATE patients SET name = ?1, phone = ?2, email = ?3, date_of_birth = ?4, address = ?5, \
                     medical_history = ?6, allergies = ?7, emergency_contact = ?8, emergency_phone = ?9, \
                     preferred_payment_method = ?10, preferred_insurance_provider_id = ?11, updated_at = ?12, \
                     sync_status = 'pending' WHERE id = ?13",
                    rusqlite::params![
                        merged_name,
                        merged_phone,
                        merged_email,
                        merged_dob,
                        merged_address,
                        merged_med_hist,
                        merged_allergies,
                        merged_em_contact,
                        merged_em_phone,
                        merged_pref_payment,
                        merged_pref_ins,
                        now,
                        k_id,
                    ],
                ).map_err(|e| e.to_string())?;

                // 3. Update associated tables to point from B (id) to A (k_id)
                tx.execute(
                    "UPDATE appointments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
                    rusqlite::params![&k_id, &merged_name, &now, &id],
                ).map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE treatments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
                    rusqlite::params![&k_id, &merged_name, &now, &id],
                ).map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE payments SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
                    rusqlite::params![&k_id, &merged_name, &now, &id],
                ).map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE patient_notes SET patient_id = ?1, updated_at = ?2, sync_status = 'pending' WHERE patient_id = ?3",
                    rusqlite::params![&k_id, &now, &id],
                ).map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE sick_sheets SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
                    rusqlite::params![&k_id, &merged_name, &now, &id],
                ).map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE waiver_requests SET patient_id = ?1, patient_name = ?2, updated_at = ?3, sync_status = 'pending' WHERE patient_id = ?4",
                    rusqlite::params![&k_id, &merged_name, &now, &id],
                ).map_err(|e| e.to_string())?;

                // 4. Delete B (id) safely
                tx.execute("DELETE FROM patients WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

                // 5. Record deletion in deleted_records
                let deletion_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'patients', ?2, ?3, 'pending')",
                    [deletion_id, id, now],
                ).map_err(|e| e.to_string())?;

                tx.commit().map_err(|e| e.to_string())?;
                Ok(())
            } else {
                Err("A patient with this name and phone number already exists".to_string())
            }
        },
        Err(e) => Err(e.to_string()),
    }
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
pub fn delete_patient(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Get all associated record IDs for synchronization
    let appointment_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM appointments WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let treatment_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM treatments WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let payment_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM payments WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let note_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM patient_notes WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let sheet_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM sick_sheets WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let waiver_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM waiver_requests WHERE patient_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&id], |row| row.get(0)).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let now = Utc::now().to_rfc3339();

    // 2. Record deletions in deleted_records
    let tables_and_ids = vec![
        ("patients", vec![id.clone()]),
        ("appointments", appointment_ids.clone()),
        ("treatments", treatment_ids.clone()),
        ("payments", payment_ids),
        ("patient_notes", note_ids),
        ("sick_sheets", sheet_ids),
        ("waiver_requests", waiver_ids),
    ];

    for (table, ids) in tables_and_ids {
        for record_id in ids {
            let deletion_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, ?2, ?3, ?4, 'pending')",
                [deletion_id, table.to_string(), record_id, now.clone()],
            ).map_err(|e| e.to_string())?;
        }
    }

    // 3. Clear doctor_status references
    for appt_id in &appointment_ids {
        tx.execute(
            "UPDATE doctor_status SET current_appointment_id = NULL WHERE current_appointment_id = ?1",
            [appt_id],
        ).map_err(|e| e.to_string())?;
    }

    // 4. Cascading delete from all tables
    tx.execute("DELETE FROM medications WHERE treatment_id IN (SELECT id FROM treatments WHERE patient_id = ?1)", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM treatments WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM appointments WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM payments WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM patient_notes WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM sick_sheets WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM waiver_requests WHERE patient_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM patients WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn delete_patient_note(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM patient_notes WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let deletion_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'patient_notes', ?2, ?3, 'pending')",
        [deletion_id, id, now],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
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
