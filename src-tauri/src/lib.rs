pub mod db;
pub mod models;
pub mod commands;
pub mod hub;
pub mod spoke;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::network::GlobalState {
      mode: std::sync::Mutex::new("none".to_string()),
      pairing_code: std::sync::Mutex::new(None),
    })
    .plugin(tauri_plugin_log::Builder::default().build())
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
    ])
    .setup(|app| {
      db::init_db(app.handle())?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
