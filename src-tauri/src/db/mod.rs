use rusqlite::Connection;
use std::fs;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    let db_path = app_dir.join("dentist.db");
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            full_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced'
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            date_of_birth TEXT,
            address TEXT,
            medical_history TEXT,
            allergies TEXT,
            emergency_contact TEXT,
            emergency_phone TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced'
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            type TEXT,
            notes TEXT,
            duration INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS treatments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            appointment_id TEXT NOT NULL,
            date TEXT NOT NULL,
            diagnosis TEXT,
            treatment TEXT,
            notes TEXT,
            follow_up_date TEXT,
            cost REAL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (appointment_id) REFERENCES appointments (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            treatment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            dosage TEXT,
            frequency TEXT,
            duration TEXT,
            instructions TEXT,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (treatment_id) REFERENCES treatments (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            treatment_id TEXT,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (treatment_id) REFERENCES treatments (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Add sync_status to existing tables if they don't have it (for existing DBs)
    let tables = vec!["users", "patients", "appointments", "treatments", "medications", "payments"];
    for table in tables {
        let _ = conn.execute(&format!("ALTER TABLE {} ADD COLUMN sync_status TEXT DEFAULT 'synced'", table), []);
    }

    Ok(())
}

pub fn get_db_conn(app_handle: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    let db_path = app_dir.join("dentist.db");
    let conn = Connection::open(db_path)?;
    Ok(conn)
}
