#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod core;
mod extensions;
mod platform;

use core::app_state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::default();

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::set_auto_start,
            commands::app::push_system_notification,
            commands::patch::list_patches,
            commands::plugin::list_plugins,
            commands::reminder::set_reminder_window_mode,
            commands::reminder::update_next_trigger,
            commands::reminder::start_reminder_session,
            commands::reminder::finish_activity_and_lock,
            commands::reminder::get_reminder_runtime,
            commands::reminder::list_default_slogans,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Ok(runtime) = window.state::<AppState>().reminder_runtime.lock() {
                    if runtime.mandatory_mode_active {
                        api.prevent_close();
                    }
                }
            }
        })
        .setup(|_app| {
            // 中文注释：初始化补丁与插件系统，预留加载入口。
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
