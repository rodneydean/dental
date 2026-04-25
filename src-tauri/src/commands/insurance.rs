use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InsuranceProvider {
    pub id: String,
    pub name: String,
    pub pays_reception_fee: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn update_insurance_provider(
    app_handle: AppHandle,
    id: String,
    name: String,
    pays_reception_fee: bool,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE insurance_providers SET name = ?1, pays_reception_fee = ?2, updated_at = ?3, sync_status = 'pending' WHERE id = ?4",
        rusqlite::params![name, pays_reception_fee, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn list_insurance_providers(app_handle: AppHandle) -> Result<Vec<InsuranceProvider>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, pays_reception_fee, created_at, updated_at FROM insurance_providers").map_err(|e| e.to_string())?;

    let provider_iter = stmt.query_map([], |row| {
        Ok(InsuranceProvider {
            id: row.get(0)?,
            name: row.get(1)?,
            pays_reception_fee: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut providers = Vec::new();
    for provider in provider_iter {
        providers.push(provider.map_err(|e| e.to_string())?);
    }
    Ok(providers)
}

#[command]
pub fn create_insurance_provider(
    app_handle: AppHandle,
    name: String,
    pays_reception_fee: bool,
) -> Result<InsuranceProvider, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO insurance_providers (id, name, pays_reception_fee, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')",
        rusqlite::params![id, name, pays_reception_fee, now, now],
    ).map_err(|e| {
        log::error!("Failed to create insurance provider: {}", e);
        e.to_string()
    })?;

    Ok(InsuranceProvider {
        id,
        name,
        pays_reception_fee,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn delete_insurance_provider(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM insurance_providers WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let deletion_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'insurance_providers', ?2, ?3, 'pending')",
        [deletion_id, id, now],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
