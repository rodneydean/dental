use rusqlite::Connection;
use std::fs;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| {
        let msg = format!("Failed to get app data directory: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    if !app_dir.exists() {
        log::info!("Creating app data directory: {:?}", app_dir);
        fs::create_dir_all(&app_dir).map_err(|e| {
            let msg = format!("Failed to create app data directory at {:?}: {}", app_dir, e);
            log::error!("{}", msg);
            msg
        })?;
    }

    let db_path = app_dir.join("dentist.db");
    log::info!("Opening database at: {:?}", db_path);

    let mut conn = Connection::open(&db_path).map_err(|e| {
        let msg = format!("Failed to open database at {:?}: {}", db_path, e);
        log::error!("{}", msg);
        msg
    })?;

    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| {
            log::error!("Failed to set busy_timeout: {}", e);
            e
        })?;

    log::info!("Initializing database schema...");
    init_schema(&mut conn).map_err(|e| {
        log::error!("Failed to initialize schema: {}", e);
        e
    })?;

    log::info!("Database initialization complete.");
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
            updated_at TEXT NOT NULL,
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
            doctor_id TEXT,
            doctor_name TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            type TEXT,
            notes TEXT,
            duration INTEGER,
            reception_fee_paid BOOLEAN DEFAULT 0,
            reception_fee_waived BOOLEAN DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (doctor_id) REFERENCES users (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS treatments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            doctor_id TEXT,
            doctor_name TEXT,
            appointment_id TEXT,
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
            FOREIGN KEY (appointment_id) REFERENCES appointments (id),
            FOREIGN KEY (doctor_id) REFERENCES users (id)
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS waiver_requests (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            requested_by TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (appointment_id) REFERENCES appointments (id),
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (doctor_id) REFERENCES users (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS doctor_status (
            doctor_id TEXT PRIMARY KEY,
            current_appointment_id TEXT,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (doctor_id) REFERENCES users (id),
            FOREIGN KEY (current_appointment_id) REFERENCES appointments (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS patient_notes (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            doctor_name TEXT NOT NULL,
            note_type TEXT NOT NULL DEFAULT 'General',
            note TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (doctor_id) REFERENCES users (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sick_sheets (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            doctor_name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (doctor_id) REFERENCES users (id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            standard_fee REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced'
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS insurance_providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            pays_reception_fee BOOLEAN DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced'
        )",
        [],
    )?;

    // Add columns to existing tables if they don't have them
    {
        let mut stmt = conn.prepare("PRAGMA table_info(appointments)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"doctor_id".to_string()) {
            let _ = conn.execute("ALTER TABLE appointments ADD COLUMN doctor_id TEXT", []);
        }
        if !columns.contains(&"doctor_name".to_string()) {
            let _ = conn.execute("ALTER TABLE appointments ADD COLUMN doctor_name TEXT", []);
        }
        if !columns.contains(&"reception_fee_paid".to_string()) {
            let _ = conn.execute("ALTER TABLE appointments ADD COLUMN reception_fee_paid BOOLEAN DEFAULT 0", []);
        }
        if !columns.contains(&"reception_fee_waived".to_string()) {
            let _ = conn.execute("ALTER TABLE appointments ADD COLUMN reception_fee_waived BOOLEAN DEFAULT 0", []);
        }
    }

    {
        let mut stmt = conn.prepare("PRAGMA table_info(payments)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"insurance_provider_id".to_string()) {
            let _ = conn.execute("ALTER TABLE payments ADD COLUMN insurance_provider_id TEXT", []);
        }
    }

    // Migration for treatments appointment_id to be nullable
    {
        let table_info: Vec<(i64, String, String, i64, Option<String>, i64)> = {
            let mut stmt = conn.prepare("PRAGMA table_info(treatments)")?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
            })?;
            let mut res = Vec::new();
            for r in rows {
                res.push(r?);
            }
            res
        };

        // Check if appointment_id is NOT NULL (notnull column is index 3, 1 means NOT NULL)
        if let Some((_, _, _, notnull, _, _)) = table_info.iter().find(|(_, name, _, _, _, _)| name == "appointment_id") {
            if *notnull == 1 {
                log::info!("Migrating treatments table to make appointment_id nullable...");

                let tx = conn.transaction()?;

                // Check if sync_status exists in the current table
                let current_columns: Vec<String> = {
                    let mut stmt = tx.prepare("PRAGMA table_info(treatments)")?;
                    let rows = stmt.query_map([], |row| Ok(row.get::<_, String>(1)?))?;
                    rows.filter_map(|r| r.ok()).collect()
                };

                let has_sync_status = current_columns.contains(&"sync_status".to_string());

                tx.execute("CREATE TABLE treatments_new (
                    id TEXT PRIMARY KEY,
                    patient_id TEXT NOT NULL,
                    patient_name TEXT NOT NULL,
                    doctor_id TEXT,
                    doctor_name TEXT,
                    appointment_id TEXT,
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
                    FOREIGN KEY (appointment_id) REFERENCES appointments (id),
                    FOREIGN KEY (doctor_id) REFERENCES users (id)
                )", [])?;

                if has_sync_status {
                    tx.execute("INSERT INTO treatments_new (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
                               SELECT id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status FROM treatments", [])?;
                } else {
                    tx.execute("INSERT INTO treatments_new (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at)
                               SELECT id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at FROM treatments", [])?;
                }

                tx.execute("DROP TABLE treatments", [])?;
                tx.execute("ALTER TABLE treatments_new RENAME TO treatments", [])?;

                tx.commit()?;
                log::info!("Treatments table migration completed successfully.");
            }
        }
    }

    // Migration for treatments doctor_id and doctor_name
    {
        let mut stmt = conn.prepare("PRAGMA table_info(treatments)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"doctor_id".to_string()) {
            let _ = conn.execute("ALTER TABLE treatments ADD COLUMN doctor_id TEXT", []);
        }
        if !columns.contains(&"doctor_name".to_string()) {
            let _ = conn.execute("ALTER TABLE treatments ADD COLUMN doctor_name TEXT", []);
        }
    }

    // Migration for patient_notes note_type
    {
        let mut stmt = conn.prepare("PRAGMA table_info(patient_notes)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"note_type".to_string()) {
            let _ = conn.execute("ALTER TABLE patient_notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'General'", []);
        }
    }

    // Add sync_status to existing tables if they don't have it (for existing DBs)
    let tables = vec!["users", "patients", "appointments", "treatments", "payments", "waiver_requests", "doctor_status", "patient_notes", "sick_sheets", "services", "insurance_providers"];
    for table in tables {
        // First check if column exists to avoid errors
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
        let rows = stmt.query_map([], |row| Ok(row.get::<_, String>(1)?))?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"sync_status".to_string()) {
            let _ = conn.execute(&format!("ALTER TABLE {} ADD COLUMN sync_status TEXT DEFAULT 'synced'", table), []);
        }
    }

    // Migration for users updated_at
    {
        let mut stmt = conn.prepare("PRAGMA table_info(users)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?;
        let columns: Vec<String> = rows.filter_map(|r| r.ok()).collect();

        if !columns.contains(&"updated_at".to_string()) {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = conn.execute(&format!("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT '{}'", now), []);
        }
    }

    Ok(())
}

pub fn get_db_conn(app_handle: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    let db_path = app_dir.join("dentist.db");
    let conn = Connection::open(db_path)?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))?;
    Ok(conn)
}