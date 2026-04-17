use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tauri::{AppHandle, Emitter};
use crate::db::get_db_conn;
use crate::commands::patients::{Patient, PatientNote, SickSheet};
use crate::commands::appointments::Appointment;
use crate::commands::treatments::Treatment;
use crate::commands::payments::Payment;
use crate::commands::lifecycle::{WaiverRequest, DoctorStatus};
use crate::commands::settings::Setting;
use crate::commands::services::Service;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use log::{info, error, warn};

#[derive(Clone)]
pub struct HubState {
    pub app_handle: AppHandle,
    pub tx: broadcast::Sender<String>,
    pub pairing_code: Arc<Mutex<Option<String>>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SyncResponse<T> {
    pub data: Vec<T>,
    pub timestamp: String,
}

pub async fn start_hub_server(app_handle: AppHandle, code: String) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting Hub server...");
    let (tx, _rx) = broadcast::channel(100);
    let pairing_code = Arc::new(Mutex::new(Some(code)));

    let state = HubState {
        app_handle: app_handle.clone(),
        tx,
        pairing_code,
    };

    let auth_router = Router::new()
        .route("/sync/patients", get(get_patients_handler).post(post_patients_handler))
        .route("/sync/appointments", get(get_appointments_handler).post(post_appointments_handler))
        .route("/sync/treatments", get(get_treatments_handler).post(post_treatments_handler))
        .route("/sync/payments", get(get_payments_handler).post(post_payments_handler))
        .route("/sync/patient_notes", get(get_patient_notes_handler).post(post_patient_notes_handler))
        .route("/sync/sick_sheets", get(get_sick_sheets_handler).post(post_sick_sheets_handler))
        .route("/sync/waivers", get(get_waivers_handler).post(post_waivers_handler))
        .route("/sync/doctor_statuses", get(get_doctor_statuses_handler).post(post_doctor_statuses_handler))
        .route("/sync/settings", get(get_settings_handler).post(post_settings_handler))
        .route("/sync/services", get(get_services_handler).post(post_services_handler))
        .route("/ws", get(ws_handler))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let app = Router::new()
        .route("/pair", post(pair_handler))
        .merge(auth_router)
        .with_state(state);

    let port = 8080;
    info!("Attempting to bind Hub server to 0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await {
        Ok(l) => l,
        Err(e) => {
            error!("Failed to bind Hub server to port {}: {}", port, e);
            return Err(e.into());
        }
    };

    info!("Hub server successfully bound to 0.0.0.0:{}", port);

    // Start mDNS in a separate task so it doesn't block or crash the server
    tauri::async_runtime::spawn(async move {
        info!("Initializing mDNS discovery...");
        match start_mdns_discovery(port).await {
            Ok(_mdns) => {
                info!("mDNS discovery started successfully");
                // Keep the daemon alive as long as the hub is running
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
                }
            },
            Err(e) => warn!("mDNS discovery failed to start: {}. Hub will still be accessible via manual IP.", e),
        }
    });

    info!("Starting Axum server...");
    if let Err(e) = axum::serve(listener, app).await {
        error!("Axum server error: {}", e);
        return Err(e.into());
    }

    Ok(())
}

async fn start_mdns_discovery(port: u16) -> Result<ServiceDaemon, Box<dyn std::error::Error + Send + Sync>> {
    let mdns = ServiceDaemon::new()?;
    let service_type = "_dentist-hub._tcp.local.";
    let properties: HashMap<String, String> = HashMap::new();

    let ips = crate::commands::network::get_local_ips();
    if ips.is_empty() {
        return Err("No local IP addresses found for mDNS".into());
    }

    for (i, ip_str) in ips.iter().enumerate() {
        let instance_name = if i == 0 {
            "dentist_hub".to_string()
        } else {
            format!("dentist_hub_{}", i)
        };
        let host_name = format!("{}.local.", instance_name);

        match ServiceInfo::new(
            service_type,
            &instance_name,
            &host_name,
            ip_str.clone(),
            port,
            properties.clone(),
        ) {
            Ok(service_info) => {
                let service_info = service_info.enable_addr_auto();
                if let Err(e) = mdns.register(service_info) {
                    error!("Failed to register mDNS service for IP {}: {}", ip_str, e);
                } else {
                    info!("Registered mDNS service for IP: {} as {}", ip_str, instance_name);
                }
            },
            Err(e) => error!("Failed to create mDNS service info for IP {}: {}", ip_str, e),
        }
    }

    Ok(mdns)
}

#[derive(Deserialize)]
struct PairRequest {
    code: String,
}

#[derive(Serialize, Deserialize)]
pub struct PairResponse {
    pub token: String,
    pub success: bool,
}

async fn auth_middleware(
    State(state): State<HubState>,
    req: axum::extract::Request,
    next: Next,
) -> Response {
    let auth_header = req.headers().get("Authorization").and_then(|h| h.to_str().ok()).map(|s| s.to_string());

    let authenticated = if let Some(token) = auth_header {
        let res = tokio::task::block_in_place(|| {
            let conn = get_db_conn(&state.app_handle).ok()?;
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM pairing_tokens WHERE token = ?1").ok()?;
            stmt.query_row([token], |row| row.get::<_, i64>(0)).ok()
        });
        res.unwrap_or(0) > 0
    } else {
        false
    };

    if authenticated {
        next.run(req).await
    } else {
        axum::http::StatusCode::UNAUTHORIZED.into_response()
    }
}

async fn pair_handler(
    State(state): State<HubState>,
    Json(payload): Json<PairRequest>,
) -> impl IntoResponse {
    let code_guard = match state.pairing_code.lock() {
        Ok(guard) => guard,
        Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Lock poisoned").into_response(),
    };
    if let Some(ref code) = *code_guard {
        if code == &payload.code {
            let token = uuid::Uuid::new_v4().to_string();
            let conn = match get_db_conn(&state.app_handle) {
                Ok(c) => c,
                Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
            };

            let now = chrono::Utc::now().to_rfc3339();
            if let Err(e) = conn.execute(
                "INSERT INTO pairing_tokens (token, created_at) VALUES (?1, ?2)",
                [&token, &now],
            ) {
                return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
            }

            info!("Successful pairing with code: {}. Generated token: {}", code, token);
            let _ = state.app_handle.emit("sync-event", serde_json::json!({ "type": "spoke_connected" }));
            return (axum::http::StatusCode::OK, Json(PairResponse {
                token,
                success: true,
            })).into_response();
        }
    }
    (axum::http::StatusCode::UNAUTHORIZED, Json(PairResponse {
        token: "".to_string(),
        success: false,
    })).into_response()
}

async fn get_patients_handler(State(state): State<HubState>) -> impl IntoResponse {
    // Basic implementation: return all patients
    // In a real app, use timestamps to only return new/updated ones
    match crate::commands::patients::list_patients(state.app_handle) {
        Ok(patients) => Json(SyncResponse {
            data: patients,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_patients_handler(
    State(state): State<HubState>,
    Json(patients): Json<Vec<Patient>>,
) -> impl IntoResponse {
    // Basic implementation: upsert patients
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for p in patients {
        let _ = conn.execute(
            "INSERT INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                phone = excluded.phone,
                email = excluded.email,
                date_of_birth = excluded.date_of_birth,
                address = excluded.address,
                medical_history = excluded.medical_history,
                allergies = excluded.allergies,
                emergency_contact = excluded.emergency_contact,
                emergency_phone = excluded.emergency_phone,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > patients.updated_at",
            rusqlite::params![
                p.id, p.name, p.phone, p.email, p.date_of_birth, p.address,
                p.medical_history, p.allergies, p.emergency_contact, p.emergency_phone,
                p.created_at, p.updated_at
            ],
        );
    }
    let _ = state.tx.send("patient".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_treatments_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::treatments::list_treatments(state.app_handle) {
        Ok(treatments) => Json(SyncResponse {
            data: treatments,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_treatments_handler(
    State(state): State<HubState>,
    Json(treatments): Json<Vec<Treatment>>,
) -> impl IntoResponse {
    let mut conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let tx = match conn.transaction() {
        Ok(t) => t,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for t in treatments {
        let res = tx.execute(
            "INSERT INTO treatments (id, patient_id, patient_name, doctor_id, doctor_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                doctor_id = excluded.doctor_id,
                doctor_name = excluded.doctor_name,
                appointment_id = excluded.appointment_id,
                diagnosis = excluded.diagnosis,
                treatment = excluded.treatment,
                notes = excluded.notes,
                follow_up_date = excluded.follow_up_date,
                cost = excluded.cost,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > treatments.updated_at",
            rusqlite::params![
                t.id, t.patient_id, t.patient_name, t.doctor_id, t.doctor_name, t.appointment_id, t.date,
                t.diagnosis, t.treatment, t.notes, t.follow_up_date, t.cost,
                t.created_at, t.updated_at
            ],
        );

        if let Ok(rows_affected) = res {
            if rows_affected > 0 {
                let _ = tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&t.id]);
                for med in t.medications {
                    let _ = tx.execute(
                        "INSERT INTO medications (id, treatment_id, name, dosage, frequency, duration, instructions, sync_status)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'synced')",
                        rusqlite::params![
                            med.id, t.id, med.name, med.dosage, med.frequency,
                            med.duration, med.instructions
                        ],
                    );
                }
            }
        }
    }

    match tx.commit() {
        Ok(_) => {
            let _ = state.tx.send("treatment".to_string());
            axum::http::StatusCode::OK.into_response()
        },
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_payments_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::payments::list_payments(state.app_handle) {
        Ok(payments) => Json(SyncResponse {
            data: payments,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_payments_handler(
    State(state): State<HubState>,
    Json(payments): Json<Vec<Payment>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for p in payments {
        let _ = conn.execute(
            "INSERT INTO payments (id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                amount = excluded.amount,
                status = excluded.status,
                notes = excluded.notes,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > payments.updated_at",
            rusqlite::params![
                p.id, p.patient_id, p.patient_name, p.treatment_id, p.amount,
                p.date, p.method, p.status, p.notes, p.created_at, p.updated_at
            ],
        );
    }
    let _ = state.tx.send("payment".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_appointments_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::appointments::list_appointments(state.app_handle) {
        Ok(appointments) => Json(SyncResponse {
            data: appointments,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_appointments_handler(
    State(state): State<HubState>,
    Json(appointments): Json<Vec<Appointment>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for a in appointments {
        let _ = conn.execute(
            "INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, date, time, status, type, notes, duration, reception_fee_paid, reception_fee_waived, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                doctor_id = excluded.doctor_id,
                doctor_name = excluded.doctor_name,
                date = excluded.date,
                time = excluded.time,
                status = excluded.status,
                type = excluded.type,
                notes = excluded.notes,
                duration = excluded.duration,
                reception_fee_paid = excluded.reception_fee_paid,
                reception_fee_waived = excluded.reception_fee_waived,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > appointments.updated_at",
            rusqlite::params![
                a.id, a.patient_id, a.patient_name, a.doctor_id, a.doctor_name, a.date, a.time, a.status,
                a.appointment_type, a.notes, a.duration, a.reception_fee_paid, a.reception_fee_waived, a.created_at, a.updated_at
            ],
        );
    }
    let _ = state.tx.send("appointment".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_waivers_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::lifecycle::list_waiver_requests(state.app_handle) {
        Ok(waivers) => Json(SyncResponse {
            data: waivers,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_waivers_handler(
    State(state): State<HubState>,
    Json(waivers): Json<Vec<WaiverRequest>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for w in waivers {
        let _ = conn.execute(
            "INSERT INTO waiver_requests (id, appointment_id, patient_id, patient_name, doctor_id, requested_by, status, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > waiver_requests.updated_at",
            rusqlite::params![
                w.id, w.appointment_id, w.patient_id, w.patient_name, w.doctor_id, w.requested_by, w.status, w.created_at, w.updated_at
            ],
        );
    }
    let _ = state.tx.send("waiver_request".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_doctor_statuses_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::lifecycle::list_doctor_statuses(state.app_handle) {
        Ok(statuses) => Json(SyncResponse {
            data: statuses,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_doctor_statuses_handler(
    State(state): State<HubState>,
    Json(statuses): Json<Vec<DoctorStatus>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for s in statuses {
        let _ = conn.execute(
            "INSERT INTO doctor_status (doctor_id, current_appointment_id, updated_at, sync_status)
             VALUES (?1, ?2, ?3, 'synced')
             ON CONFLICT(doctor_id) DO UPDATE SET
                current_appointment_id = excluded.current_appointment_id,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > doctor_status.updated_at",
            rusqlite::params![
                s.doctor_id, s.current_appointment_id, s.updated_at
            ],
        );
    }
    let _ = state.tx.send("doctor_status_updated".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_patient_notes_handler(State(state): State<HubState>) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut stmt = match conn.prepare("SELECT id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at FROM patient_notes") {
        Ok(s) => s,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let note_iter = stmt.query_map([], |row| {
        Ok(PatientNote {
            id: row.get(0)?,
            patient_id: row.get(1)?,
            doctor_id: row.get(2)?,
            doctor_name: row.get(3)?,
            note_type: row.get(4)?,
            note: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    });

    match note_iter {
        Ok(iter) => {
            let notes: Vec<PatientNote> = iter.filter_map(|r| r.ok()).collect();
            Json(SyncResponse {
                data: notes,
                timestamp: chrono::Utc::now().to_rfc3339(),
            }).into_response()
        },
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn post_patient_notes_handler(
    State(state): State<HubState>,
    Json(notes): Json<Vec<PatientNote>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for n in notes {
        let _ = conn.execute(
            "INSERT INTO patient_notes (id, patient_id, doctor_id, doctor_name, note_type, note, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                note_type = excluded.note_type,
                note = excluded.note,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > patient_notes.updated_at",
            rusqlite::params![
                n.id, n.patient_id, n.doctor_id, n.doctor_name, n.note_type, n.note,
                n.created_at, n.updated_at
            ],
        );
    }
    let _ = state.tx.send("patient_note".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_sick_sheets_handler(State(state): State<HubState>) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut stmt = match conn.prepare("SELECT id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at FROM sick_sheets") {
        Ok(s) => s,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let sheet_iter = stmt.query_map([], |row| {
        Ok(SickSheet {
            id: row.get(0)?,
            patient_id: row.get(1)?,
            patient_name: row.get(2)?,
            doctor_id: row.get(3)?,
            doctor_name: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
            reason: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match sheet_iter {
        Ok(iter) => {
            let sheets: Vec<SickSheet> = iter.filter_map(|r| r.ok()).collect();
            Json(SyncResponse {
                data: sheets,
                timestamp: chrono::Utc::now().to_rfc3339(),
            }).into_response()
        },
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn post_sick_sheets_handler(
    State(state): State<HubState>,
    Json(sheets): Json<Vec<SickSheet>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for s in sheets {
        let _ = conn.execute(
            "INSERT INTO sick_sheets (id, patient_id, patient_name, doctor_id, doctor_name, start_date, end_date, reason, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                reason = excluded.reason,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > sick_sheets.updated_at",
            rusqlite::params![
                s.id, s.patient_id, s.patient_name, s.doctor_id, s.doctor_name,
                s.start_date, s.end_date, s.reason, s.created_at, s.updated_at
            ],
        );
    }
    let _ = state.tx.send("sick_sheet".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_settings_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::settings::list_settings(state.app_handle) {
        Ok(settings) => Json(SyncResponse {
            data: settings,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_settings_handler(
    State(state): State<HubState>,
    Json(settings): Json<Vec<Setting>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for s in settings {
        let _ = conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![s.key, s.value],
        );
    }
    let _ = state.tx.send("settings_updated".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn get_services_handler(State(state): State<HubState>) -> impl IntoResponse {
    match crate::commands::services::list_services(state.app_handle) {
        Ok(services) => Json(SyncResponse {
            data: services,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn post_services_handler(
    State(state): State<HubState>,
    Json(services): Json<Vec<Service>>,
) -> impl IntoResponse {
    let conn = match get_db_conn(&state.app_handle) {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    for s in services {
        let _ = conn.execute(
            "INSERT INTO services (id, name, standard_fee, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                standard_fee = excluded.standard_fee,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > services.updated_at",
            rusqlite::params![s.id, s.name, s.standard_fee, s.created_at, s.updated_at],
        );
    }
    let _ = state.tx.send("services_updated".to_string());
    axum::http::StatusCode::OK.into_response()
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<HubState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: HubState) {
    let mut rx = state.tx.subscribe();

    loop {
        tokio::select! {
            msg = rx.recv() => {
                if let Ok(msg) = msg {
                    if socket.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
            }
            result = socket.recv() => {
                if result.is_none() {
                    break;
                }
            }
        }
    }
}
