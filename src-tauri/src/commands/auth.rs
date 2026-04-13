use crate::db::get_db_conn;
use crate::models::User;
use bcrypt::{hash, verify, DEFAULT_COST};
use tauri::{AppHandle, command};
use uuid::Uuid;
use chrono::Utc;

#[command]
pub fn check_has_admin(app_handle: AppHandle) -> Result<bool, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
        .map_err(|e| e.to_string())?;
    let count: i64 = stmt.query_row([], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[command]
pub fn initial_setup(
    app_handle: AppHandle,
    username: String,
    password: String,
    full_name: String,
) -> Result<User, String> {
    let has_admin = check_has_admin(app_handle.clone())?;
    if has_admin {
        return Err("Admin already exists".to_string());
    }

    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let created_at = Utc::now().to_rfc3339();
    let role = "ADMIN".to_string();

    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, full_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
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
pub fn login(
    app_handle: AppHandle,
    username: String,
    password: String,
) -> Result<User, String> {
    let conn = get_db_conn(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, username, password_hash, role, full_name, created_at FROM users WHERE username = ?1")
        .map_err(|e| e.to_string())?;

    let (id, db_username, password_hash, role, full_name, created_at): (String, String, String, String, String, String) = stmt.query_row([&username], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    }).map_err(|_| "Invalid username or password".to_string())?;

    if verify(password, &password_hash).map_err(|e| e.to_string())? {
        Ok(User {
            id,
            username: db_username,
            role,
            full_name,
            created_at,
        })
    } else {
        Err("Invalid username or password".to_string())
    }
}
