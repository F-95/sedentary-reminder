//! 中文注释：系统托盘（System Tray）创建与菜单事件，与前端 `ReminderConfig` 通过事件 + `sync_tray_menu` 命令同步。

use std::sync::Mutex;

use crate::core::app_state::AppState;
use serde::Serialize;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, Wry};

/// 中文注释：前端监听的托盘字段切换事件名（与 `src/utils/tauri.ts` 常量一致）。
pub const EVENT_TRAY_FIELD_TOGGLE: &str = "tray-field-toggle";

/// 中文注释：主窗口关闭拦截后通知前端弹出选择框。
pub const EVENT_MAIN_CLOSE_REQUESTED: &str = "main-close-requested";

/// 中文注释：托盘菜单项 ID，与前端 `TrayToggleField` 对应。
const MENU_ID_AUTO_START: &str = "tray_auto_start";
const MENU_ID_REMINDER_ENABLED: &str = "tray_reminder_enabled";
const MENU_ID_LOCK_ON_FINISH: &str = "tray_lock_on_finish";
const MENU_ID_QUIT: &str = "tray_quit";

/// 中文注释：根据提醒运行态构建托盘悬停提示文案。
fn build_tray_tooltip(app: &AppHandle) -> String {
    let state = app.state::<AppState>();
    let runtime = match state.reminder_runtime.lock() {
        Ok(guard) => guard,
        Err(_) => return "久坐提醒\n提醒状态获取失败".to_string(),
    };
    if !runtime.reminder_enabled {
        return "久坐提醒\n提醒未启用".to_string();
    }
    let label = runtime
        .next_trigger_label
        .clone()
        .or_else(|| runtime.next_trigger_at_ms.map(|ms| format!("{ms}")))
        .unwrap_or_else(|| "计算中".to_string());
    format!("久坐提醒\n下次提醒时间：{label}")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayFieldTogglePayload {
    pub field: String,
}

/// 中文注释：保存三个勾选菜单项句柄，供 `sync_tray_menu` 更新勾选状态。
pub struct TrayCheckHandles {
    pub auto_start: tauri::menu::CheckMenuItem<Wry>,
    pub reminder_enabled: tauri::menu::CheckMenuItem<Wry>,
    pub lock_on_finish: tauri::menu::CheckMenuItem<Wry>,
}

/// 中文注释：由 `tauri::Builder::manage` 注入，供命令层更新托盘勾选。
pub struct TrayMenuState {
    pub inner: Mutex<Option<TrayCheckHandles>>,
}

impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

/// 中文注释：创建托盘图标、右键菜单，并注册菜单/双击事件。
pub fn setup_tray(app: &App) -> Result<(), String> {
    let tray_state = app.state::<TrayMenuState>();

    let auto_start = CheckMenuItemBuilder::with_id(MENU_ID_AUTO_START, "开机启动")
        .checked(false)
        .build(app)
        .map_err(|e| e.to_string())?;

    let reminder_enabled = CheckMenuItemBuilder::with_id(MENU_ID_REMINDER_ENABLED, "启动提醒")
        .checked(false)
        .build(app)
        .map_err(|e| e.to_string())?;

    let lock_on_finish = CheckMenuItemBuilder::with_id(MENU_ID_LOCK_ON_FINISH, "提醒结束后锁屏")
        .checked(false)
        .build(app)
        .map_err(|e| e.to_string())?;

    let quit = MenuItemBuilder::with_id(MENU_ID_QUIT, "退出")
        .build(app)
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .items(&[&auto_start, &reminder_enabled, &lock_on_finish, &quit])
        .build()
        .map_err(|e| e.to_string())?;

    {
        // 中文注释：托盘仅在 setup 单线程初始化，此处用 expect 避免 poison 分支污染错误类型。
        let mut guard = tray_state.inner.lock().expect("托盘状态 Mutex");
        *guard = Some(TrayCheckHandles {
            auto_start: auto_start.clone(),
            reminder_enabled: reminder_enabled.clone(),
            lock_on_finish: lock_on_finish.clone(),
        });
    }

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "未找到应用窗口图标（default_window_icon），无法创建托盘".to_string())?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("久坐提醒")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app_handle, event| {
            let id = event.id();
            if id == MENU_ID_QUIT {
                app_handle.exit(0);
                return;
            }
            let field = if id == MENU_ID_AUTO_START {
                "autoStart"
            } else if id == MENU_ID_REMINDER_ENABLED {
                "enabled"
            } else if id == MENU_ID_LOCK_ON_FINISH {
                "lockOnFinish"
            } else {
                return;
            };
            let payload = TrayFieldTogglePayload {
                field: field.to_string(),
            };
            let _ = app_handle.emit_to("main", EVENT_TRAY_FIELD_TOGGLE, payload);
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Enter { .. } = event {
                let tooltip = build_tray_tooltip(&tray.app_handle());
                let _ = tray.set_tooltip(Some(tooltip));
            }
            if let TrayIconEvent::DoubleClick { button, .. } = event {
                if button == MouseButton::Left {
                    if let Some(w) = tray.app_handle().get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    Ok(())
}
