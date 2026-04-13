pub mod db;
pub mod models;
pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    ])
    .setup(|app| {
      db::init_db(app.handle())?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
