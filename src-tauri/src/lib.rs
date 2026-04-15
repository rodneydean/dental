use tauri::Manager;

pub mod db;
pub mod models;
pub mod commands;
pub mod hub;
pub mod spoke;
#[cfg(test)]
mod db_tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::network::GlobalState {
      mode: std::sync::Mutex::new("none".to_string()),
      pairing_code: std::sync::Mutex::new(None),
    })
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      commands::auth::check_has_admin,
      commands::auth::initial_setup,
      commands::auth::login,
      commands::users::create_user,
      commands::users::list_users,
      commands::users::delete_user,
      commands::patients::list_patients,
      commands::patients::create_patient,
      commands::patients::update_patient,
      commands::patients::list_patient_notes,
      commands::patients::create_patient_note,
      commands::patients::list_sick_sheets,
      commands::patients::create_sick_sheet,
      commands::appointments::list_appointments,
      commands::appointments::create_appointment,
      commands::appointments::update_appointment,
      commands::appointments::delete_appointment,
      commands::treatments::list_treatments,
      commands::treatments::create_treatment,
      commands::payments::list_payments,
      commands::payments::create_payment,
      commands::network::start_as_hub,
      commands::network::start_as_spoke,
      commands::network::get_connection_status,
      commands::network::get_local_ips,
      commands::network::get_network_info,
      commands::settings::get_setting,
      commands::settings::set_setting,
      commands::settings::list_settings,
      commands::lifecycle::list_waiver_requests,
      commands::lifecycle::create_waiver_request,
      commands::lifecycle::update_waiver_status,
      commands::lifecycle::get_doctor_status,
      commands::lifecycle::list_doctor_statuses,
      commands::lifecycle::update_doctor_status,
      commands::services::list_services,
      commands::services::create_service,
      commands::services::delete_service,
    ])
    .setup(|app| {
      db::init_db(app.handle())?;

      // Auto-start Hub or Spoke based on persisted settings
      let app_handle = app.handle().clone();
      let state = app.state::<commands::network::GlobalState>();
      let mode = commands::settings::get_setting(app_handle.clone(), "network_mode".to_string()).ok().flatten();
      let code = commands::settings::get_setting(app_handle.clone(), "pairing_code".to_string()).ok().flatten();
      let hub_addr = commands::settings::get_setting(app_handle.clone(), "hub_address".to_string()).ok().flatten();

      if let Some(mode_str) = mode {
          if mode_str == "hub" {
              if let Some(c) = code {
                  let mut g_mode = state.mode.lock().unwrap();
                  *g_mode = "hub".to_string();
                  let mut g_code = state.pairing_code.lock().unwrap();
                  *g_code = Some(c.clone());

                  let app_clone = app_handle.clone();
                  tokio::spawn(async move {
                      let _ = hub::start_hub_server(app_clone, c).await;
                  });
              }
          } else if mode_str == "spoke" {
              if let Some(c) = code {
                  let mut g_mode = state.mode.lock().unwrap();
                  *g_mode = "spoke".to_string();
                  let mut g_code = state.pairing_code.lock().unwrap();
                  *g_code = Some(c.clone());

                  let app_clone = app_handle.clone();
                  tokio::spawn(async move {
                      spoke::start_spoke_client(app_clone, c, hub_addr).await;
                  });
              }
          }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
