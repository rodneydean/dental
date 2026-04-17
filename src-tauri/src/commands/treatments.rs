use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Medication {
    pub id: String,
    pub name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub duration: Option<String>,
    pub instructions: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Treatment {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub appointment_id: Option<String>,
    pub date: String,
    pub diagnosis: Option<String>,
    pub treatment: Option<String>,
    pub medications: Vec<Medication>,
    pub notes: Option<String>,
    pub follow_up_date: Option<String>,
    pub cost: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_treatments(app_handle: AppHandle) -> Result<Vec<Treatment>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at FROM treatments").map_err(|e| e.to_string())?;

    let treatment_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, f64>(9)?,
            row.get::<_, String>(10)?,
            row.get::<_, String>(11)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut treatments = Vec::new();
    for row_result in treatment_rows {
        let (id, p_id, p_name, a_id, date, diag, treat, notes, f_up, cost, c_at, u_at) = row_result.map_err(|e| e.to_string())?;

        let mut med_stmt = conn.prepare("SELECT id, name, dosage, frequency, duration, instructions FROM medications WHERE treatment_id = ?1").map_err(|e| e.to_string())?;
        let medications = med_stmt.query_map([&id], |med_row| {
            Ok(Medication {
                id: med_row.get(0)?,
                name: med_row.get(1)?,
                dosage: med_row.get(2)?,
                frequency: med_row.get(3)?,
                duration: med_row.get(4)?,
                instructions: med_row.get(5)?,
            })
        }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        treatments.push(Treatment {
            id,
            patient_id: p_id,
            patient_name: p_name,
            appointment_id: a_id,
            date,
            diagnosis: diag,
            treatment: treat,
            medications,
            notes,
            follow_up_date: f_up,
            cost,
            created_at: c_at,
            updated_at: u_at,
        });
    }
    Ok(treatments)
}

#[command]
pub fn create_treatment(
    app_handle: AppHandle,
    patient_id: String,
    patient_name: String,
    appointment_id: Option<String>,
    date: String,
    diagnosis: Option<String>,
    treatment_desc: Option<String>,
    medications: Vec<Medication>,
    notes: Option<String>,
    follow_up_date: Option<String>,
    cost: f64,
) -> Result<Treatment, String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO treatments (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending')",
        rusqlite::params![
            id,
            patient_id,
            patient_name,
            appointment_id,
            date,
            diagnosis,
            treatment_desc,
            notes,
            follow_up_date,
            cost,
            now,
            now
        ],
    ).map_err(|e| e.to_string())?;

    for med in &medications {
        tx.execute(
            "INSERT INTO medications (id, treatment_id, name, dosage, frequency, duration, instructions, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')",
            rusqlite::params![
                med.id,
                id,
                med.name,
                med.dosage,
                med.frequency,
                med.duration,
                med.instructions
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Treatment {
        id,
        patient_id,
        patient_name,
        appointment_id,
        date,
        diagnosis,
        treatment: treatment_desc,
        medications,
        notes,
        follow_up_date,
        cost,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn update_treatment(
    app_handle: AppHandle,
    id: String,
    patient_id: String,
    patient_name: String,
    appointment_id: Option<String>,
    date: String,
    diagnosis: Option<String>,
    treatment_desc: Option<String>,
    medications: Vec<Medication>,
    notes: Option<String>,
    follow_up_date: Option<String>,
    cost: f64,
) -> Result<(), String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE treatments SET patient_id = ?1, patient_name = ?2, appointment_id = ?3, date = ?4, diagnosis = ?5, treatment = ?6, notes = ?7, follow_up_date = ?8, cost = ?9, updated_at = ?10, sync_status = 'pending' WHERE id = ?11",
        rusqlite::params![
            patient_id,
            patient_name,
            appointment_id,
            date,
            diagnosis,
            treatment_desc,
            notes,
            follow_up_date,
            cost,
            now,
            id
        ],
    ).map_err(|e| e.to_string())?;

    // Simplest way to update medications is to delete and re-insert
    tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&id]).map_err(|e| e.to_string())?;

    for med in &medications {
        tx.execute(
            "INSERT INTO medications (id, treatment_id, name, dosage, frequency, duration, instructions, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')",
            rusqlite::params![
                med.id,
                id,
                med.name,
                med.dosage,
                med.frequency,
                med.duration,
                med.instructions
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn delete_treatment(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM treatments WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
