use serde::Serialize;
use tauri::AppHandle;

use crate::tray::TrayMenuState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub app_id: String,
}

#[cfg(windows)]
fn to_wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "sedentary-reminder".to_string(),
        version: "0.1.2".to_string(),
        app_id: "sedentary-reminder".to_string(),
    }
}

/// 中文注释：启用/禁用开机自启（AutoStart），写入当前用户（HKCU）的注册表 Run 键。
#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::WIN32_ERROR;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
            KEY_SET_VALUE, REG_SZ,
        };

        const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
        const VALUE_NAME: &str = "sedentary-reminder";

        fn win_err_to_string(e: WIN32_ERROR) -> String {
            format!("windows error={} ", e.0)
        }

        let exe = std::env::current_exe().map_err(|e| format!("获取当前 exe 路径失败: {e}"))?;
        let exe_str = exe
            .to_str()
            .ok_or_else(|| "当前 exe 路径不是有效 UTF-8".to_string())?;

        let run_key_w = to_wide_null(RUN_KEY);
        let value_name_w = to_wide_null(VALUE_NAME);
        let exe_w = to_wide_null(exe_str);

        // UTF-16 WCHAR 数组转为 bytes（每个 u16 两字节）
        let exe_bytes: &[u8] =
            unsafe { std::slice::from_raw_parts(exe_w.as_ptr() as *const u8, exe_w.len() * 2) };

        let mut hkey = HKEY::default();
        let status_open = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(run_key_w.as_ptr()),
                None,
                KEY_SET_VALUE,
                &mut hkey,
            )
        };
        if status_open.0 != 0 {
            return Err(format!(
                "打开 Run 键失败: {}",
                win_err_to_string(status_open)
            ));
        }

        let result = if enabled {
            let status_set = unsafe {
                RegSetValueExW(
                    hkey,
                    PCWSTR(value_name_w.as_ptr()),
                    None,
                    REG_SZ,
                    Some(exe_bytes),
                )
            };
            status_set
        } else {
            let status_del = unsafe { RegDeleteValueW(hkey, PCWSTR(value_name_w.as_ptr())) };
            status_del
        };

        let _ = unsafe { RegCloseKey(hkey) };

        // 中文注释：enabled=false 时删除不存在的 Run 值（ERROR_FILE_NOT_FOUND=2）应视为成功。
        if result.0 != 0 && (!enabled && result.0 == 2) {
            // continue to handle below
        }

        if result.0 != 0 && !(!enabled && result.0 == 2) {
            return Err(format!(
                "设置开机自启失败（enabled={}）: {}",
                enabled,
                win_err_to_string(result)
            ));
        }

        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("当前平台暂不支持开机自启设置".to_string())
    }
}

/// 中文注释：将前端 `ReminderConfig` 中的三个布尔同步到托盘勾选菜单，避免 Rust 读取 localStorage。
#[tauri::command]
pub fn sync_tray_menu(
    tray: tauri::State<'_, TrayMenuState>,
    app_state: tauri::State<'_, crate::core::app_state::AppState>,
    auto_start: bool,
    reminder_enabled: bool,
    lock_on_finish: bool,
) -> Result<(), String> {
    {
        // 中文注释：缓存提醒启用状态，供托盘悬停提示文案实时读取。
        let mut runtime = app_state
            .reminder_runtime
            .lock()
            .map_err(|_| "提醒运行态加锁失败".to_string())?;
        runtime.reminder_enabled = reminder_enabled;
    }

    let guard = tray
        .inner
        .lock()
        .map_err(|_| "托盘状态加锁失败".to_string())?;
    let Some(handles) = guard.as_ref() else {
        return Ok(());
    };
    handles
        .auto_start
        .set_checked(auto_start)
        .map_err(|e| format!("同步托盘「开机启动」勾选失败: {e}"))?;
    handles
        .reminder_enabled
        .set_checked(reminder_enabled)
        .map_err(|e| format!("同步托盘「启动提醒」勾选失败: {e}"))?;
    handles
        .lock_on_finish
        .set_checked(lock_on_finish)
        .map_err(|e| format!("同步托盘「提醒结束后锁屏」勾选失败: {e}"))?;
    Ok(())
}

/// 中文注释：退出进程（供前端「退出程序」或记忆为退出时使用）。
#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}
