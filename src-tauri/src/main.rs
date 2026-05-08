#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod core;
mod extensions;
mod platform;
mod tray;

use core::app_state::AppState;
use tauri::Emitter;
use tauri::Manager;
use tray::TrayMenuState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::default();
    let tray_menu_state = TrayMenuState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .manage(tray_menu_state)
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::set_auto_start,
            commands::app::sync_tray_menu,
            commands::app::exit_app,
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
                let mandatory =
                    if let Ok(runtime) = window.state::<AppState>().reminder_runtime.lock() {
                        runtime.mandatory_mode_active
                    } else {
                        false
                    };

                if mandatory {
                    api.prevent_close();
                    return;
                }

                // 中文注释：非强制提醒态下拦截关闭，由前端决定最小化到托盘或退出进程。
                api.prevent_close();
                let _ = window.emit(tray::EVENT_MAIN_CLOSE_REQUESTED, ());
            }
        })
        .setup(|app| {
            // 中文注释：初始化补丁与插件系统，预留加载入口。
            tray::setup_tray(app).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
