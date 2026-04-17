use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub treatment_id: Option<String>,
    pub amount: f64,
    pub date: String,
    pub method: String,
    pub status: String,
    pub notes: Option<String>,
    pub insurance_provider_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_payments(app_handle: AppHandle) -> Result<Vec<Payment>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, insurance_provider_id FROM payments").map_err(|e| e.to_string())?;

    let payment_iter = stmt.query_map([], |row| {
        Ok(Payment {
            id: row.get(0)?,
            patient_id: row.get(1)?,
            patient_name: row.get(2)?,
            treatment_id: row.get(3)?,
            amount: row.get(4)?,
            date: row.get(5)?,
            method: row.get(6)?,
            status: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            insurance_provider_id: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for payment in payment_iter {
        payments.push(payment.map_err(|e| e.to_string())?);
    }
    Ok(payments)
}

#[command]
pub fn create_payment(
    app_handle: AppHandle,
    patient_id: String,
    patient_name: String,
    treatment_id: Option<String>,
    amount: f64,
    date: String,
    method: String,
    status: String,
    notes: Option<String>,
    insurance_provider_id: Option<String>,
) -> Result<Payment, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO payments (id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, insurance_provider_id, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending')",
        rusqlite::params![
            id,
            patient_id,
            patient_name,
            treatment_id,
            amount,
            date,
            method,
            status,
            notes,
            now,
            now,
            insurance_provider_id
        ],
    ).map_err(|e| e.to_string())?;

    Ok(Payment {
        id,
        patient_id,
        patient_name,
        treatment_id,
        amount,
        date,
        method,
        status,
        notes,
        created_at: now.clone(),
        updated_at: now,
        insurance_provider_id,
    })
}
