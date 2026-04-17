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
      commands::patients::get_patient,
      commands::patients::create_patient,
      commands::patients::update_patient,
      commands::patients::list_patient_notes,
      commands::patients::create_patient_note,
      commands::patients::update_patient_note,
      commands::patients::delete_patient_note,
      commands::patients::list_sick_sheets,
      commands::patients::create_sick_sheet,
      commands::appointments::list_appointments,
      commands::appointments::create_appointment,
      commands::appointments::update_appointment,
      commands::appointments::delete_appointment,
      commands::treatments::list_treatments,
      commands::treatments::create_treatment,
      commands::treatments::update_treatment,
      commands::treatments::delete_treatment,
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
      commands::settings::save_logo,
      commands::settings::get_logo,
      commands::lifecycle::list_waiver_requests,
      commands::lifecycle::create_waiver_request,
      commands::lifecycle::update_waiver_status,
      commands::lifecycle::get_doctor_status,
      commands::lifecycle::list_doctor_statuses,
      commands::lifecycle::update_doctor_status,
      commands::services::list_services,
      commands::services::create_service,
      commands::services::update_service,
      commands::services::delete_service,
      commands::insurance::list_insurance_providers,
      commands::insurance::create_insurance_provider,
      commands::insurance::update_insurance_provider,
      commands::insurance::delete_insurance_provider,
      commands::data::get_db_stats,
      commands::data::validate_db_data,
      commands::data::cleanup_db_data,
      commands::data::backup_db,
    ])
    .setup(|app| {
      log::info!("Starting application setup...");

      if let Err(e) = db::init_db(app.handle()) {
          log::error!("CRITICAL: Failed to initialize database: {}", e);

          let handle = app.handle().clone();
          let error_msg = e.to_string();
          tauri::async_runtime::spawn(async move {
              let _ = tauri_plugin_dialog::DialogExt::dialog(&handle)
                  .message(format!("The application failed to initialize the database and must close.\n\nError: {}", error_msg))
                  .title("Critical Error")
                  .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                  .show(|_| {
                      std::process::exit(1);
                  });
          });

          return Ok(()); // Return Ok to allow the dialog to show before the app might close, but the exit(1) above handles termination.
      }

      log::info!("Database initialized successfully.");

      // Auto-start Hub or Spoke based on persisted settings
      let app_handle = app.handle().clone();
      let state = app.state::<commands::network::GlobalState>();

      let mode = commands::settings::get_setting(app_handle.clone(), "network_mode".to_string()).unwrap_or_else(|e| {
          log::error!("Failed to get network_mode setting: {}", e);
          None
      });
      let code = commands::settings::get_setting(app_handle.clone(), "pairing_code".to_string()).unwrap_or_else(|e| {
          log::error!("Failed to get pairing_code setting: {}", e);
          None
      });
      let hub_addr = commands::settings::get_setting(app_handle.clone(), "hub_address".to_string()).unwrap_or_else(|e| {
          log::error!("Failed to get hub_address setting: {}", e);
          None
      });

      if let Some(mode_str) = mode {
          log::info!("Auto-starting in {} mode", mode_str);
          if mode_str == "hub" {
              if let Some(c) = code {
                  if let Ok(mut g_mode) = state.mode.lock() {
                      *g_mode = "hub".to_string();
                  } else {
                      log::error!("Failed to lock network mode state");
                  }
                  if let Ok(mut g_code) = state.pairing_code.lock() {
                      *g_code = Some(c.clone());
                  } else {
                      log::error!("Failed to lock pairing code state");
                  }

                  let app_clone = app_handle.clone();
                  tauri::async_runtime::spawn(async move {
                      if let Err(e) = hub::start_hub_server(app_clone, c).await {
                          log::error!("Failed to start hub server: {}", e);
                      }
                  });
              } else {
                  log::warn!("Hub mode set but no pairing code found");
              }
          } else if mode_str == "spoke" {
              if let Some(c) = code {
                  if let Ok(mut g_mode) = state.mode.lock() {
                      *g_mode = "spoke".to_string();
                  } else {
                      log::error!("Failed to lock network mode state");
                  }
                  if let Ok(mut g_code) = state.pairing_code.lock() {
                      *g_code = Some(c.clone());
                  } else {
                      log::error!("Failed to lock pairing code state");
                  }

                  let app_clone = app_handle.clone();
                  tauri::async_runtime::spawn(async move {
                      spoke::start_spoke_client(app_clone, c, hub_addr).await;
                  });
              } else {
                  log::warn!("Spoke mode set but no pairing code found");
              }
          }
      }

      log::info!("Application setup completed.");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
