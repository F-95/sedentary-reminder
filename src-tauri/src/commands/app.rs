use serde::Serialize;
use tauri::Manager;

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

#[cfg(windows)]
fn copy_to_u16_array(dst: &mut [u16], s: &str) {
    let wide: Vec<u16> = s.encode_utf16().collect();
    let cap = dst.len();
    if cap == 0 {
        return;
    }
    let n = wide.len().min(cap.saturating_sub(1));
    dst[..n].copy_from_slice(&wide[..n]);
    // 保持末尾为 0（默认填充 0），确保 Windows 侧按 WCHAR 字符串读取正常。
    if n < cap {
        dst[n] = 0;
    }
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "sedentary-reminder".to_string(),
        version: "0.1.0".to_string(),
        app_id: "sedentary-reminder".to_string(),
    }
}

/// 中文注释：启用/禁用开机自启（AutoStart），写入当前用户（HKCU）的注册表 Run 键。
#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::WIN32_ERROR;
        use windows::Win32::System::Registry::{
            HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, RegCloseKey, RegDeleteValueW, RegOpenKeyExW,
            RegSetValueExW, REG_SZ,
        };
        use windows::core::PCWSTR;

        const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
        const VALUE_NAME: &str = "sedentary-reminder";

        fn win_err_to_string(e: WIN32_ERROR) -> String {
            format!("windows error={} ", e.0)
        }

        let exe = std::env::current_exe()
            .map_err(|e| format!("获取当前 exe 路径失败: {e}"))?;
        let exe_str = exe
            .to_str()
            .ok_or_else(|| "当前 exe 路径不是有效 UTF-8".to_string())?;

        let run_key_w = to_wide_null(RUN_KEY);
        let value_name_w = to_wide_null(VALUE_NAME);
        let exe_w = to_wide_null(exe_str);

        // UTF-16 WCHAR 数组转为 bytes（每个 u16 两字节）
        let exe_bytes: &[u8] = unsafe {
            std::slice::from_raw_parts(exe_w.as_ptr() as *const u8, exe_w.len() * 2)
        };

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
            return Err(format!("打开 Run 键失败: {}", win_err_to_string(status_open)));
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

        if result.0 != 0 && !( !enabled && result.0 == 2) {
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

/// 中文注释：推送系统通知（Windows），用于提醒“距离下一次触发还有 1 分钟”。
#[tauri::command]
pub fn push_system_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::{
            Shell_NotifyIconW, NOTIFYICONDATAW, NIF_INFO, NIF_TIP, NIIF_INFO, NIM_ADD, NIM_MODIFY,
        };

        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "未找到主窗口用于推送通知".to_string())?;

        let hwnd = window
            .hwnd()
            .map_err(|e| format!("获取窗口句柄失败: {e}"))?;

        let mut nid = NOTIFYICONDATAW::default();
        nid.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
        nid.hWnd = HWND(hwnd.0 as *mut std::ffi::c_void);
        nid.uID = 1;
        nid.uFlags = NIF_INFO | NIF_TIP;
        nid.uCallbackMessage = 0;
        nid.dwInfoFlags = NIIF_INFO;

        copy_to_u16_array(&mut nid.szInfoTitle, &title);
        copy_to_u16_array(&mut nid.szInfo, &body);
        copy_to_u16_array(&mut nid.szTip, &title);

        let ok_add = unsafe { Shell_NotifyIconW(NIM_ADD, &mut nid).as_bool() };
        let _ = unsafe { Shell_NotifyIconW(NIM_MODIFY, &mut nid) };

        if !ok_add {
            return Err("Shell_NotifyIconW(NIM_ADD) 失败".to_string());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = (app, title, body);
        Err("当前平台暂不支持系统通知".to_string())
    }
}
