//! 中文注释：第十版——系统会话解锁时向主窗口 emit `session-unlocked`，供前端可选视为「记录活动」。

use tauri::{AppHandle, Manager};

/// 中文注释：与前端 `listen` 事件名一致。
pub const EVENT_SESSION_UNLOCKED: &str = "session-unlocked";

/// 中文注释：在 Windows / macOS 上注册；其他平台为空操作。
pub fn install_session_unlock_listener(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::install(app)
    }
    #[cfg(all(target_os = "macos", not(windows)))]
    {
        mac::install(app)
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = app;
        Ok(())
    }
}

#[cfg(windows)]
mod win {
    use super::{AppHandle, Manager};
    use std::sync::OnceLock;
    use tauri::Emitter;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, WTSUnRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::WM_WTSSESSION_CHANGE;

    /// 中文注释：与 WinUser.h 中 WTS_SESSION_* 一致；解锁时 wParam == 8。
    const WTS_SESSION_UNLOCK: usize = 0x8;
    /// 中文注释：与企业强控子类 ID 不同，避免冲突。
    const SUBCLASS_UID_SESSION: usize = 0x53455355;

    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

    unsafe extern "system" fn session_subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uid: usize,
        _dw_ref_data: usize,
    ) -> LRESULT {
        if msg == WM_WTSSESSION_CHANGE && wparam.0 == WTS_SESSION_UNLOCK {
            if let Some(app) = APP_HANDLE.get() {
                let _ = app.emit(super::EVENT_SESSION_UNLOCKED, serde_json::json!({}));
            }
        }
        unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
    }

    pub fn install(app: &AppHandle) -> Result<(), String> {
        let _ = APP_HANDLE.set(app.clone());
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "未找到 label=main 的主窗口".to_string())?;
        let raw = window
            .hwnd()
            .map_err(|e| format!("获取主窗口 HWND 失败: {e}"))?;
        let hwnd = HWND(raw.0);

        unsafe {
            if WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION).is_err() {
                return Err("WTSRegisterSessionNotification 失败".to_string());
            }
            if !SetWindowSubclass(hwnd, Some(session_subclass_proc), SUBCLASS_UID_SESSION, 0).as_bool() {
                let _ = WTSUnRegisterSessionNotification(hwnd);
                return Err("SetWindowSubclass(会话解锁) 失败".to_string());
            }
        }
        Ok(())
    }
}

#[cfg(all(target_os = "macos", not(windows)))]
mod mac {
    use super::AppHandle;
    use std::ffi::c_void;
    use std::sync::OnceLock;

    use tauri::Emitter;
    use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease, CFTypeRef};
    use core_foundation_sys::dictionary::CFDictionaryRef;
    use core_foundation_sys::notification_center::{
        CFNotificationCenterAddObserver, CFNotificationCenterGetDarwinNotifyCenter,
        CFNotificationCenterRef, CFNotificationSuspensionBehaviorDeliverImmediately,
    };
    use core_foundation_sys::string::{kCFStringEncodingUTF8, CFStringCreateWithBytes, CFStringRef};

    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

    /// 中文注释：Darwin 通知名（与系统解锁约定一致）。
    static UNLOCK_NAME: &[u8] = b"com.apple.screenIsUnlocked";

    extern "C" fn on_darwin_unlock(
        _center: CFNotificationCenterRef,
        _observer: *mut c_void,
        _name: CFStringRef,
        _object: *const c_void,
        _user_info: CFDictionaryRef,
    ) {
        if let Some(app) = APP_HANDLE.get() {
            let _ = app.emit(super::EVENT_SESSION_UNLOCKED, serde_json::json!({}));
        }
    }

    pub fn install(app: &AppHandle) -> Result<(), String> {
        let _ = APP_HANDLE.set(app.clone());
        unsafe {
            let center = CFNotificationCenterGetDarwinNotifyCenter();
            let name = CFStringCreateWithBytes(
                kCFAllocatorDefault,
                UNLOCK_NAME.as_ptr(),
                UNLOCK_NAME.len() as isize,
                kCFStringEncodingUTF8,
                0,
            );
            if name.is_null() {
                return Err("CFStringCreateWithBytes(screenIsUnlocked) 失败".to_string());
            }
            CFNotificationCenterAddObserver(
                center,
                std::ptr::null(),
                on_darwin_unlock,
                name,
                std::ptr::null(),
                CFNotificationSuspensionBehaviorDeliverImmediately,
            );
            CFRelease(name as CFTypeRef);
        }
        Ok(())
    }
}
