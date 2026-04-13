use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
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

    let app = Router::new()
        .route("/pair", post(pair_handler))
        .route("/sync/patients", get(get_patients_handler).post(post_patients_handler))
        .route("/sync/appointments", get(get_appointments_handler).post(post_appointments_handler))
        .route("/sync/treatments", get(get_treatments_handler).post(post_treatments_handler))
        .route("/sync/payments", get(get_payments_handler).post(post_payments_handler))
        .route("/ws", get(ws_handler))
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

#[derive(Serialize)]
struct PairResponse {
    token: String,
    success: bool,
}

async fn pair_handler(
    State(state): State<HubState>,
    Json(payload): Json<PairRequest>,
) -> impl IntoResponse {
    let current_code = state.pairing_code.lock().unwrap();
    if let Some(ref code) = *current_code {
        if code == &payload.code {
            println!("Successful pairing with code: {}", code);
            return (axum::http::StatusCode::OK, Json(PairResponse {
                token: "dummy-token".to_string(),
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
            "INSERT OR REPLACE INTO patients (id, name, phone, email, date_of_birth, address, medical_history, allergies, emergency_contact, emergency_phone, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')",
            [
                p.id.as_str(), p.name.as_str(), p.phone.as_deref().unwrap_or_default(), p.email.as_deref().unwrap_or_default(),
                p.date_of_birth.as_deref().unwrap_or_default(), p.address.as_deref().unwrap_or_default(),
                p.medical_history.as_deref().unwrap_or_default(), p.allergies.as_deref().unwrap_or_default(),
                p.emergency_contact.as_deref().unwrap_or_default(), p.emergency_phone.as_deref().unwrap_or_default(),
                p.created_at.as_str(), p.updated_at.as_str()
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
        let _ = tx.execute(
            "INSERT OR REPLACE INTO treatments (id, patient_id, patient_name, appointment_id, date, diagnosis, treatment, notes, follow_up_date, cost, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')",
            [
                t.id.as_str(), t.patient_id.as_str(), t.patient_name.as_str(), t.appointment_id.as_str(), t.date.as_str(),
                t.diagnosis.as_deref().unwrap_or_default(), t.treatment.as_deref().unwrap_or_default(),
                t.notes.as_deref().unwrap_or_default(), t.follow_up_date.as_deref().unwrap_or_default(),
                &t.cost.to_string(), t.created_at.as_str(), t.updated_at.as_str()
            ],
        );

        let _ = tx.execute("DELETE FROM medications WHERE treatment_id = ?1", [&t.id]);
        for med in t.medications {
            let _ = tx.execute(
                "INSERT INTO medications (treatment_id, name, dosage, frequency, duration, instructions, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'synced')",
                [
                    &t.id, &med.name, med.dosage.as_deref().unwrap_or_default(), med.frequency.as_deref().unwrap_or_default(),
                    med.duration.as_deref().unwrap_or_default(), med.instructions.as_deref().unwrap_or_default()
                ],
            );
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
            "INSERT OR REPLACE INTO payments (id, patient_id, patient_name, treatment_id, amount, date, method, status, notes, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')",
            [
                p.id.as_str(), p.patient_id.as_str(), p.patient_name.as_str(), p.treatment_id.as_deref().unwrap_or_default(),
                &p.amount.to_string(), p.date.as_str(), p.method.as_str(), p.status.as_str(),
                p.notes.as_deref().unwrap_or_default(), p.created_at.as_str(), p.updated_at.as_str()
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
        let duration_str = a.duration.unwrap_or(30).to_string();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO appointments (id, patient_id, patient_name, date, time, status, type, notes, duration, created_at, updated_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')",
            [
                a.id.as_str(), a.patient_id.as_str(), a.patient_name.as_str(), a.date.as_str(), a.time.as_str(), a.status.as_str(),
                a.appointment_type.as_deref().unwrap_or_default(), a.notes.as_deref().unwrap_or_default(),
                duration_str.as_str(), a.created_at.as_str(), a.updated_at.as_str()
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
