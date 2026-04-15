use crate::db::get_db_conn;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Service {
    pub id: String,
    pub name: String,
    pub standard_fee: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[command]
pub fn list_services(app_handle: AppHandle) -> Result<Vec<Service>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, standard_fee, created_at, updated_at FROM services").map_err(|e| e.to_string())?;

    let service_iter = stmt.query_map([], |row| {
        Ok(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            standard_fee: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut services = Vec::new();
    for service in service_iter {
        services.push(service.map_err(|e| e.to_string())?);
    }
    Ok(services)
}

#[command]
pub fn create_service(
    app_handle: AppHandle,
    name: String,
    standard_fee: f64,
) -> Result<Service, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO services (id, name, standard_fee, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')",
        rusqlite::params![id, name, standard_fee, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Service {
        id,
        name,
        standard_fee,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn delete_service(app_handle: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM services WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
