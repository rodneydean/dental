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
use tauri::AppHandle;
use crate::db::get_db_conn;
use crate::commands::patients::Patient;
use crate::commands::appointments::Appointment;
use crate::commands::treatments::Treatment;
use crate::commands::payments::Payment;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use local_ip_address::local_ip;
use std::collections::HashMap;

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
        .route("/ws", get(ws_handler))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let app = Router::new()
        .route("/pair", post(pair_handler))
        .merge(auth_router)
        .with_state(state);

    let port = 8080;
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;

    // Start mDNS
    let my_ip = local_ip()?;
    let mdns = ServiceDaemon::new()?;
    let service_type = "_dentist-hub._tcp.local.";
    let instance_name = "dentist_hub";
    let host_name = format!("{}.local.", instance_name);
    let properties: HashMap<String, String> = HashMap::new();
    let service_info = ServiceInfo::new(
        service_type,
        instance_name,
        &host_name,
        my_ip.to_string(),
        port,
        properties,
    )?.enable_addr_auto();
    mdns.register(service_info)?;

    axum::serve(listener, app).await?;

    Ok(())
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
    let current_code = state.pairing_code.lock().unwrap();
    if let Some(ref code) = *current_code {
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

            println!("Successful pairing with code: {}. Generated token: {}", code, token);
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
            "INSERT INTO treatments (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                diagnosis = excluded.diagnosis,
                treatment = excluded.treatment,
                notes = excluded.notes,
                follow_up_date = excluded.follow_up_date,
                cost = excluded.cost,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > treatments.updated_at",
            rusqlite::params![
                t.id, t.patient_id, t.patient_name, t.appointment_id, t.date,
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
            "INSERT INTO appointments (id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')
             ON CONFLICT(id) DO UPDATE SET
                date = excluded.date,
                time = excluded.time,
                status = excluded.status,
                type = excluded.type,
                notes = excluded.notes,
                duration = excluded.duration,
                updated_at = excluded.updated_at
             WHERE excluded.updated_at > appointments.updated_at",
            rusqlite::params![
                a.id, a.patient_id, a.patient_name, a.date, a.time, a.status,
                a.appointment_type, a.notes, a.duration, a.created_at, a.updated_at
            ],
        );
    }
    let _ = state.tx.send("appointment".to_string());
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
