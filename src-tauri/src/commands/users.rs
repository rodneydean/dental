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
    {
        let mut stmt = conn.prepare("SELECT role FROM users WHERE id = ?1").map_err(|e| e.to_string())?;
        let admin_role: String = stmt.query_row([&admin_id], |row| row.get(0)).map_err(|_| "Admin not found".to_string())?;
        if admin_role != "ADMIN" {
            return Err("Unauthorized".to_string());
        }
    }

    let id = Uuid::new_v4().to_string();
    let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, full_name, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')",
        [&id, &username, &password_hash, &role, &full_name, &now, &now],
    ).map_err(|e| e.to_string())?;

    Ok(User {
        id,
        username,
        role,
        full_name,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[command]
pub fn list_users(app_handle: AppHandle) -> Result<Vec<User>, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, username, role, full_name, created_at, updated_at FROM users").map_err(|e| e.to_string())?;
    let user_iter = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            role: row.get(2)?,
            full_name: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
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
    let mut conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    // Verify requester is admin
    {
        let mut stmt = conn.prepare("SELECT role FROM users WHERE id = ?1").map_err(|e| e.to_string())?;
        let admin_role: String = stmt.query_row([&admin_id], |row| row.get(0)).map_err(|_| "Admin not found".to_string())?;
        if admin_role != "ADMIN" {
            return Err("Unauthorized".to_string());
        }
    }

    if admin_id == user_id {
        return Err("Cannot delete yourself".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM users WHERE id = ?1", [&user_id]).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let deletion_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO deleted_records (id, table_name, record_id, deleted_at, sync_status) VALUES (?1, 'users', ?2, ?3, 'pending')",
        [deletion_id, user_id, now],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn update_user(
    app_handle: AppHandle,
    requester_id: String,
    user_id: String,
    username: Option<String>,
    password: Option<String>,
    role: Option<String>,
    full_name: Option<String>,
) -> Result<(), String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;

    // Get requester info
    let mut stmt = conn.prepare("SELECT role FROM users WHERE id = ?1").map_err(|e| e.to_string())?;
    let requester_role: String = stmt.query_row([&requester_id], |row| row.get(0)).map_err(|_| "Requester not found".to_string())?;

    // Authorization: Must be admin or updating yourself
    if requester_id != user_id && requester_role != "ADMIN" {
        return Err("Unauthorized".to_string());
    }

    // If changing role, check for last admin
    if let Some(new_role) = &role {
        if requester_role != "ADMIN" {
            return Err("Only admins can change roles".to_string());
        }

        // Get current role of the user being updated
        let current_role: String = conn.query_row("SELECT role FROM users WHERE id = ?1", [&user_id], |row| row.get(0)).map_err(|e| e.to_string())?;

        if current_role == "ADMIN" && new_role != "ADMIN" {
            let admin_count: i64 = conn.query_row("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'", [], |row| row.get(0)).map_err(|e| e.to_string())?;
            if admin_count <= 1 {
                return Err("Cannot demote the last administrator".to_string());
            }
        }
    }

    // Update fields
    let now = Utc::now().to_rfc3339();
    if let Some(uname) = username {
        conn.execute("UPDATE users SET username = ?1, updated_at = ?2, sync_status = 'pending' WHERE id = ?3", [&uname, &now, &user_id]).map_err(|e| e.to_string())?;
    }
    if let Some(pass) = password {
        let password_hash = hash(pass, DEFAULT_COST).map_err(|e| e.to_string())?;
        conn.execute("UPDATE users SET password_hash = ?1, updated_at = ?2, sync_status = 'pending' WHERE id = ?3", [&password_hash, &now, &user_id]).map_err(|e| e.to_string())?;
    }
    if let Some(r) = role {
        conn.execute("UPDATE users SET role = ?1, updated_at = ?2, sync_status = 'pending' WHERE id = ?3", [&r, &now, &user_id]).map_err(|e| e.to_string())?;
    }
    if let Some(name) = full_name {
        conn.execute("UPDATE users SET full_name = ?1, updated_at = ?2, sync_status = 'pending' WHERE id = ?3", [&name, &now, &user_id]).map_err(|e| e.to_string())?;
    }

    Ok(())
}
