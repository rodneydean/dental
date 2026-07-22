#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use uuid::Uuid;
    use crate::db::init_schema;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).expect("Failed to initialize schema");
        conn
    }

    #[test]
    fn test_create_patient_sets_pending() {
        let conn = setup_test_db();
        let id = Uuid::new_v4().to_string();
        let now = "2023-01-01T00:00:00Z";

        conn.execute(
            "INSERT INTO patients (id, name, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, 'pending')",
            [&id, "Test Patient", now, now],
        ).unwrap();

        let sync_status: String = conn.query_row(
            "SELECT sync_status FROM patients WHERE id = ?1",
            [&id],
            |row| row.get(0),
        ).unwrap();

        assert_eq!(sync_status, "pending");
    }

    #[test]
    fn test_patient_merge_internal_and_cascading_updates() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Since setup_test_db runs init_schema (which triggers migration and uniqueness),
        // we can still test merge_patients_internal directly.
        init_schema(&mut conn).unwrap();

        let id_keep = "keep-id-123".to_string();
        let id_delete = "delete-id-456".to_string();

        // Insert patient to keep (older updated_at, but some fields filled)
        conn.execute(
            "INSERT INTO patients (id, name, phone, email, date_of_birth, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![&id_keep, "John Doe", "123456", "john@example.com", "1990-01-01", "2023-01-01T00:00:00Z", "2023-01-01T00:00:00Z"],
        ).unwrap();

        // Insert patient to delete (newer updated_at, some conflicting/new fields) - use a different phone number to avoid constraint violation during test setup
        conn.execute(
            "INSERT INTO patients (id, name, phone, email, address, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![&id_delete, "John Doe", "654321", "johndoe@example.com", "123 Main St", "2023-01-02T00:00:00Z", "2023-01-02T00:00:00Z"],
        ).unwrap();

        // Add some associated child records to delete_id to verify they transition to keep_id
        conn.execute(
            "INSERT INTO appointments (id, patient_id, patient_name, date, time, status, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params!["appt-1", &id_delete, "John Doe", "2023-05-01", "10:00", "scheduled", "2023-01-01T00:00:00Z", "2023-01-01T00:00:00Z"],
        ).unwrap();

        conn.execute(
            "INSERT INTO treatments (id, patient_id, patient_name, date, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params!["treat-1", &id_delete, "John Doe", "2023-05-01", "2023-01-01T00:00:00Z", "2023-01-01T00:00:00Z"],
        ).unwrap();

        // Perform merge
        crate::commands::patients::merge_patients_internal(&mut conn, &id_keep, &id_delete).unwrap();

        // Verify patient deleted
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM patients WHERE id = ?1", [&id_delete], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);

        // Verify patient keep updated with newer fields (name, email, address) but keeps unique old fields (date_of_birth)
        let name: String = conn.query_row("SELECT name FROM patients WHERE id = ?1", [&id_keep], |r| r.get(0)).unwrap();
        let email: String = conn.query_row("SELECT email FROM patients WHERE id = ?1", [&id_keep], |r| r.get(0)).unwrap();
        let dob: String = conn.query_row("SELECT date_of_birth FROM patients WHERE id = ?1", [&id_keep], |r| r.get(0)).unwrap();
        let address: String = conn.query_row("SELECT address FROM patients WHERE id = ?1", [&id_keep], |r| r.get(0)).unwrap();

        assert_eq!(name, "John Doe");
        assert_eq!(email, "johndoe@example.com"); // newer wins
        assert_eq!(dob, "1990-01-01"); // keep old because newer didn't have it
        assert_eq!(address, "123 Main St"); // keep new because old didn't have it

        // Verify cascading table updates
        let appt_pat_id: String = conn.query_row("SELECT patient_id FROM appointments WHERE id = 'appt-1'", [], |r| r.get(0)).unwrap();
        let treat_pat_id: String = conn.query_row("SELECT patient_id FROM treatments WHERE id = 'treat-1'", [], |r| r.get(0)).unwrap();

        assert_eq!(appt_pat_id, id_keep);
        assert_eq!(treat_pat_id, id_keep);

        // Verify deletion registered in deleted_records
        let del_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM deleted_records WHERE record_id = ?1 AND table_name = 'patients'",
            [&id_delete],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(del_count, 1);
    }

    #[test]
    fn test_deduplicate_patients_migration_runs_automatically() {
        let mut conn = Connection::open_in_memory().unwrap();

        // 1. Manually create pre-migration patients schema without unique constraints
        conn.execute(
            "CREATE TABLE patients (
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
                preferred_payment_method TEXT,
                preferred_insurance_provider_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                sync_status TEXT DEFAULT 'synced'
            )",
            [],
        ).unwrap();

        // Insert duplicate patients
        conn.execute(
            "INSERT INTO patients (id, name, phone, created_at, updated_at) \
             VALUES ('id-1', 'Mary Smith', '987654', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO patients (id, name, phone, created_at, updated_at) \
             VALUES ('id-2', 'Mary Smith', '987654', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')",
            [],
        ).unwrap();

        // 2. Initialize remaining schema (which runs deduplicate_patients_migration and creates unique index)
        init_schema(&mut conn).unwrap();

        // 3. Verify they were merged to 1 patient
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM patients WHERE name = 'Mary Smith' AND phone = '987654'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 1);

        // Verify ID 'id-2' (newer) was merged and deleted
        let count_deleted: i64 = conn.query_row("SELECT COUNT(*) FROM patients WHERE id = 'id-2'", [], |r| r.get(0)).unwrap();
        assert_eq!(count_deleted, 0);

        // Verify index is created and working
        let res = conn.execute(
            "INSERT INTO patients (id, name, phone, created_at, updated_at) \
             VALUES ('id-3', 'Mary Smith', '987654', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')",
            [],
        );
        assert!(res.is_err()); // Constraint violation
    }

    #[test]
    fn test_patient_upsert_newer_wins() {
        let conn = setup_test_db();
        let id = Uuid::new_v4().to_string();
        let old_time = "2023-01-01T00:00:00Z";
        let new_time = "2023-01-02T00:00:00Z";

        // Initial insert
        conn.execute(
            "INSERT INTO patients (id, name, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, 'synced')",
            [&id, "Old Name", old_time, old_time],
        ).unwrap();

        // Upsert with newer data
        conn.execute(
            "INSERT INTO patients (id, name, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > patients.updated_at",
            [&id, "New Name", old_time, new_time],
        ).unwrap();

        let name: String = conn.query_row(
            "SELECT name FROM patients WHERE id = ?1",
            [&id],
            |row| row.get(0),
        ).unwrap();

        assert_eq!(name, "New Name");

        // Upsert with older data
        conn.execute(
            "INSERT INTO patients (id, name, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > patients.updated_at",
            [&id, "Older Name", old_time, old_time],
        ).unwrap();

        let name: String = conn.query_row(
            "SELECT name FROM patients WHERE id = ?1",
            [&id],
            |row| row.get(0),
        ).unwrap();

        assert_eq!(name, "New Name"); // Should still be "New Name"
    }
}
