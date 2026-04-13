use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Medication {
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
    pub appointment_id: String,
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
            row.get::<_, String>(3)?,
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

        let mut med_stmt = conn.prepare("SELECT name, dosage, frequency, duration, instructions FROM medications WHERE treatment_id = ?1").map_err(|e| e.to_string())?;
        let medications = med_stmt.query_map([&id], |med_row| {
            Ok(Medication {
                name: med_row.get(0)?,
                dosage: med_row.get(1)?,
                frequency: med_row.get(2)?,
                duration: med_row.get(3)?,
                instructions: med_row.get(4)?,
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
    appointment_id: String,
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
        "INSERT INTO treatments (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        [
            &id,
            &patient_id,
            &patient_name,
            &appointment_id,
            &date,
            &diagnosis.clone().unwrap_or_default(),
            &treatment_desc.clone().unwrap_or_default(),
            &notes.clone().unwrap_or_default(),
            &follow_up_date.clone().unwrap_or_default(),
            &cost.to_string(),
            &now,
            &now
        ],
    ).map_err(|e| e.to_string())?;

    for med in &medications {
        tx.execute(
            "INSERT INTO medications (treatment_id, name, dosage, frequency, duration, instructions) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            [
                &id,
                &med.name,
                &med.dosage.clone().unwrap_or_default(),
                &med.frequency.clone().unwrap_or_default(),
                &med.duration.clone().unwrap_or_default(),
                &med.instructions.clone().unwrap_or_default()
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
