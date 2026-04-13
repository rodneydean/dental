use rusqlite::Connection;
use std::fs;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    let db_path = app_dir.join("dentist.db");
    let mut conn = Connection::open(db_path)?;

    init_schema(&mut conn)?;

    Ok(())
}

pub fn init_schema(conn: &mut Connection) -> Result<(), Box<dyn std::error::Error>> {
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

    // Handle medications table migration if necessary
    let table_info: Vec<(i64, String, String, i64, Option<String>, i64)> = {
        let mut stmt = conn.prepare("PRAGMA table_info(medications)")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        })?;
        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        res
    };

    if table_info.is_empty() {
        conn.execute(
            "CREATE TABLE medications (
                id TEXT PRIMARY KEY,
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
    } else {
        let id_type = table_info.iter().find(|(_, name, _, _, _, _)| name == "id").map(|(_, _, t, _, _, _)| t.to_uppercase());
        if id_type == Some("INTEGER".to_string()) {
            // Perform migration
            conn.execute("ALTER TABLE medications RENAME TO medications_old", [])?;
            conn.execute(
                "CREATE TABLE medications (
                    id TEXT PRIMARY KEY,
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
                "INSERT INTO medications (id, treatment_id, name, dosage, frequency, duration, instructions, sync_status)
                 SELECT CAST(id AS TEXT), treatment_id, name, dosage, frequency, duration, instructions, sync_status FROM medications_old",
                [],
            )?;
            conn.execute("DROP TABLE medications_old", [])?;
        }
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS pairing_tokens (
            token TEXT PRIMARY KEY,
            client_name TEXT,
            created_at TEXT NOT NULL
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
    let tables = vec!["users", "patients", "appointments", "treatments", "payments"];
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
