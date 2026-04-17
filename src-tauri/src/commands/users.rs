use crate::db::get_db_conn;
use crate::models::User;
use bcrypt::{hash, DEFAULT_COST};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[command]
pub fn create_user(
    app_handle: AppHandle,
    admin_id: String,
    username: String,
    password: String,
    role: String,
    full_name: String,
) -> Result<User, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    // Verify requester is admin
    let mut stmt = conn.prepare("SELECT role FROM users WHERE id = ?1").map_err(|e| e.to_string())?;
    let admin_role: String = stmt.query_row([&admin_id], |row| row.get(0)).map_err(|_| "Admin not found".to_string())?;
    if admin_role != "ADMIN" {
        return Err("Unauthorized".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, full_name, created_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')",
        [&id, &username, &password_hash, &role, &full_name, &created_at],
    ).map_err(|e| e.to_string())?;

    Ok(User {
        id,
        username,
        role,
        full_name,
        created_at,
    })
}

#[command]
pub fn list_users(app_handle: AppHandle) -> Result<Vec<User>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, username, role, full_name, created_at FROM users").map_err(|e| e.to_string())?;
    let user_iter = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            role: row.get(2)?,
            full_name: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    for user in user_iter {
        users.push(user.map_err(|e| e.to_string())?);
    }
    Ok(users)
}

#[command]
pub fn delete_user(app_handle: AppHandle, admin_id: String, user_id: String) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    // Verify requester is admin
    let mut stmt = conn.prepare("SELECT role FROM users WHERE id = ?1").map_err(|e| e.to_string())?;
    let admin_role: String = stmt.query_row([&admin_id], |row| row.get(0)).map_err(|_| "Admin not found".to_string())?;
    if admin_role != "ADMIN" {
        return Err("Unauthorized".to_string());
    }

    if admin_id == user_id {
        return Err("Cannot delete yourself".to_string());
    }

    conn.execute("DELETE FROM users WHERE id = ?1", [&user_id]).map_err(|e| e.to_string())?;
    Ok(())
}
