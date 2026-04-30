use serde::Serialize;
use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use std::{thread, time::Duration};

use crate::core::{app_state::AppState, reminder_lock};

#[cfg(windows)]
use crate::platform::win_enterprise;

/// 中文注释：计算所有显示器的物理像素外接矩形（虚拟桌面联合区域），坐标系与 Tauri `Monitor::position` / `size` 一致。
/// 若 `available_monitors` 为空则回退为仅主显示器矩形，避免无屏可枚举时崩溃。
fn virtual_desktop_union_phys(window: &WebviewWindow) -> Result<(i32, i32, u32, u32), String> {
    let monitors = window
        .available_monitors()
        .map_err(|e| format!("枚举显示器失败: {e}"))?;

    if !monitors.is_empty() {
        let mut min_left = i32::MAX;
        let mut min_top = i32::MAX;
        let mut max_right = i32::MIN;
        let mut max_bottom = i32::MIN;
        for m in monitors {
            let p = m.position();
            let s = m.size();
            let right = p.x.saturating_add(s.width as i32);
            let bottom = p.y.saturating_add(s.height as i32);
            min_left = min_left.min(p.x);
            min_top = min_top.min(p.y);
            max_right = max_right.max(right);
            max_bottom = max_bottom.max(bottom);
        }
        let w = max_right.saturating_sub(min_left).max(1) as u32;
        let h = max_bottom.saturating_sub(min_top).max(1) as u32;
        return Ok((min_left, min_top, w, h));
    }

    let Some(primary) = window
        .primary_monitor()
        .map_err(|e| format!("读取主显示器失败: {e}"))?
    else {
        return Err("未检测到任何显示器".to_string());
    };
    let p = primary.position();
    let s = primary.size();
    Ok((p.x, p.y, s.width.max(1), s.height.max(1)))
}

/// 中文注释：主显示器中心点的屏幕物理坐标；无主屏时返回联合矩形中心作为兜底。
fn primary_monitor_center_phys(window: &WebviewWindow, union_left: i32, union_top: i32, union_w: u32, union_h: u32) -> (i32, i32) {
    if let Ok(Some(primary)) = window.primary_monitor() {
        let p = primary.position();
        let s = primary.size();
        let cx = p.x.saturating_add(s.width as i32 / 2);
        let cy = p.y.saturating_add(s.height as i32 / 2);
        return (cx, cy);
    }
    let cx = union_left.saturating_add(union_w as i32 / 2);
    let cy = union_top.saturating_add(union_h as i32 / 2);
    (cx, cy)
}

/// 中文注释：Win32 企业强控相关调用必须在 GUI 主线程执行（Win11 上 WH_KEYBOARD_LL 等更稳定）。
#[cfg(windows)]
fn win_dispatch_on_main_thread<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    f: impl FnOnce() -> Result<(), String> + Send + 'static,
) -> Result<(), String> {
    use std::sync::mpsc;
    let (tx, rx) = mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .map_err(|e| format!("主线程调度失败: {e}"))?;
    rx.recv()
        .map_err(|_| "主线程调度结果接收失败".to_string())?
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderRuntime {
    pub mandatory_mode_active: bool,
    pub active_session_id: Option<String>,
    pub next_trigger_at_ms: Option<i64>,
    pub primary_center_x: Option<f64>,
    pub primary_center_y: Option<f64>,
}

fn start_focus_guard_if_needed(app: &tauri::AppHandle) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        let mut runtime = state
            .reminder_runtime
            .lock()
            .map_err(|_| "提醒运行态加锁失败".to_string())?;
        if runtime.focus_guard_running {
            return Ok(());
        }
        runtime.focus_guard_running = true;
    }

    let app_handle = app.clone();
    thread::spawn(move || loop {
        let mandatory_active = {
            let state = app_handle.state::<AppState>();
            let guard = state.reminder_runtime.lock();
            match &guard {
                Ok(runtime) => runtime.mandatory_mode_active,
                Err(_) => false,
            }
        };

        if !mandatory_active {
            let state = app_handle.state::<AppState>();
            if let Ok(mut runtime) = state.reminder_runtime.lock() {
                runtime.focus_guard_running = false;
            }
            break;
        }

        if let Some(window) = app_handle.get_webview_window("main") {
            // 中文注释：二次读取，避免主线程已关闭强制模式后仍使用本轮开头的旧快照把窗口打回全屏。
            let (still_mandatory, rect) = {
                let state = app_handle.state::<AppState>();
                let guard = state.reminder_runtime.lock();
                match &guard {
                    Ok(runtime) => (runtime.mandatory_mode_active, runtime.locked_rect),
                    Err(_) => (false, None),
                }
            };
            if still_mandatory {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_always_on_top(true);
                let _ = window.set_resizable(false);
                let _ = window.set_maximizable(false);
                let _ = window.set_minimizable(false);
                let _ = window.set_closable(false);
                if let Some((x, y, width, height)) = rect {
                    let _ = window.set_position(PhysicalPosition::new(x, y));
                    let _ = window.set_size(PhysicalSize::new(width, height));
                }
                let _ = window.set_focus();
                #[cfg(windows)]
                {
                    let ah_rt = app_handle.clone();
                    let ah_inner = app_handle.clone();
                    let _ = ah_rt.run_on_main_thread(move || {
                        if let Some(w) = ah_inner.get_webview_window("main") {
                            if let Ok(h) = w.hwnd() {
                                let bits = h.0 as usize;
                                let _ = win_enterprise::reinforce_topmost_bits(bits);
                            }
                        }
                    });
                }
            }
        }

        thread::sleep(Duration::from_millis(280));
    });

    Ok(())
}

#[tauri::command]
pub fn set_reminder_window_mode(app: tauri::AppHandle, state: tauri::State<AppState>, active: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "未找到主窗口".to_string())?;

    if active {
        let (union_left, union_top, union_w, union_h) = virtual_desktop_union_phys(&window)?;
        let (cx, cy) = primary_monitor_center_phys(&window, union_left, union_top, union_w, union_h);
        let primary_center = Some((
            (cx - union_left) as f64,
            (cy - union_top) as f64,
        ));
        let locked_rect = Some((union_left, union_top, union_w, union_h));

        window.show().map_err(|error| format!("显示窗口失败: {error}"))?;
        window.unminimize().map_err(|error| format!("恢复窗口失败: {error}"))?;
        window.set_always_on_top(true).map_err(|error| format!("置顶失败: {error}"))?;
        window.set_decorations(false).map_err(|error| format!("隐藏边框失败: {error}"))?;
        window.set_resizable(false).map_err(|error| format!("禁用调整大小失败: {error}"))?;
        window.set_maximizable(false).map_err(|error| format!("禁用最大化失败: {error}"))?;
        window.set_minimizable(false).map_err(|error| format!("禁用最小化失败: {error}"))?;
        window.set_closable(false).map_err(|error| format!("禁用关闭失败: {error}"))?;
        window
            .set_fullscreen(false)
            .map_err(|error| format!("退出系统全屏失败: {error}"))?;

        window
            .set_position(PhysicalPosition::new(union_left, union_top))
            .map_err(|error| format!("窗口位置设置失败: {error}"))?;
        window
            .set_size(PhysicalSize::new(union_w, union_h))
            .map_err(|error| format!("窗口尺寸设置失败: {error}"))?;

        let _ = window.set_focus();

        #[cfg(windows)]
        {
            let hwnd_bits = window
                .hwnd()
                .map_err(|e| format!("获取窗口句柄失败: {e}"))?
                .0 as usize;
            let cover = Some((union_left, union_top, union_w, union_h));
            win_dispatch_on_main_thread(&app, move || {
                win_enterprise::enterprise_layer_activate(hwnd_bits, cover)
                    .map_err(|e| format!("企业强控启用失败: {e}"))
            })?;
        }

        let mut runtime = state
            .reminder_runtime
            .lock()
            .map_err(|_| "提醒运行态加锁失败".to_string())?;
        runtime.locked_rect = locked_rect;
        runtime.primary_center_in_window = primary_center;
        // 中文注释：必须先于 focus_guard 线程置位，否则首轮可能读到 false 直接退出守护。
        runtime.mandatory_mode_active = true;
        drop(runtime);
        start_focus_guard_if_needed(&app)?;
    } else {
        {
            let mut runtime = state
                .reminder_runtime
                .lock()
                .map_err(|_| "提醒运行态加锁失败".to_string())?;
            // 中文注释：先关闭强制态，避免与下方恢复窗口操作竞态（否则 guard 会把窗口再次铺满并禁用调整）。
            runtime.mandatory_mode_active = false;
            runtime.locked_rect = None;
            runtime.primary_center_in_window = None;
        }
        #[cfg(windows)]
        {
            let hwnd_bits = window
                .hwnd()
                .map_err(|e| format!("获取窗口句柄失败: {e}"))?
                .0 as usize;
            win_dispatch_on_main_thread(&app, move || {
                win_enterprise::enterprise_layer_deactivate(hwnd_bits)
                    .map_err(|e| format!("企业强控关闭失败: {e}"))
            })?;
        }

        window
            .set_fullscreen(false)
            .map_err(|error| format!("退出全屏失败: {error}"))?;
        window.set_decorations(true).map_err(|error| format!("恢复边框失败: {error}"))?;
        window.set_resizable(true).map_err(|error| format!("恢复可调整大小失败: {error}"))?;
        window.set_maximizable(true).map_err(|error| format!("恢复最大化失败: {error}"))?;
        window.set_minimizable(true).map_err(|error| format!("恢复最小化失败: {error}"))?;
        window.set_closable(true).map_err(|error| format!("恢复关闭失败: {error}"))?;
        window.set_always_on_top(false).map_err(|error| format!("取消置顶失败: {error}"))?;
        window
            .set_size(LogicalSize::new(520.0, 700.0))
            .map_err(|error| format!("恢复窗口大小失败: {error}"))?;
        window
            .center()
            .map_err(|error| format!("窗口居中失败: {error}"))?;
    }

    let mut runtime = state
        .reminder_runtime
        .lock()
        .map_err(|_| "提醒运行态加锁失败".to_string())?;
    runtime.mandatory_mode_active = active;
    if !active {
        runtime.active_session_id = None;
        runtime.locked_rect = None;
        runtime.primary_center_in_window = None;
    }
    Ok(())
}

#[tauri::command]
pub fn update_next_trigger(state: tauri::State<AppState>, trigger_at_ms: Option<i64>) -> Result<(), String> {
    let mut runtime = state
        .reminder_runtime
        .lock()
        .map_err(|_| "提醒运行态加锁失败".to_string())?;
    runtime.next_trigger_at_ms = trigger_at_ms;
    Ok(())
}

#[tauri::command]
pub fn start_reminder_session(state: tauri::State<AppState>, session_id: String) -> Result<(), String> {
    let mut runtime = state
        .reminder_runtime
        .lock()
        .map_err(|_| "提醒运行态加锁失败".to_string())?;
    runtime.active_session_id = Some(session_id);
    runtime.mandatory_mode_active = true;
    Ok(())
}

#[tauri::command]
pub fn finish_activity_and_lock(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    session_id: String,
    lock_enabled: bool,
) -> Result<(), String> {
    {
        let runtime = state
            .reminder_runtime
            .lock()
            .map_err(|_| "提醒运行态加锁失败".to_string())?;
        if runtime.active_session_id.as_deref() != Some(session_id.as_str()) {
            return Err("提醒会话不匹配，拒绝结束活动".to_string());
        }
    }

    set_reminder_window_mode(app, state, false)?;
    if lock_enabled {
        reminder_lock::lock_screen()?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_reminder_runtime(state: tauri::State<AppState>) -> Result<ReminderRuntime, String> {
    let runtime = state
        .reminder_runtime
        .lock()
        .map_err(|_| "提醒运行态加锁失败".to_string())?;
    Ok(ReminderRuntime {
        mandatory_mode_active: runtime.mandatory_mode_active,
        active_session_id: runtime.active_session_id.clone(),
        next_trigger_at_ms: runtime.next_trigger_at_ms,
        primary_center_x: runtime.primary_center_in_window.map(|it| it.0),
        primary_center_y: runtime.primary_center_in_window.map(|it| it.1),
    })
}

#[tauri::command]
pub fn list_default_slogans() -> Vec<String> {
    vec![
        "该起来活动了，请起身走动并放松肩颈。".to_string(),
        "做几次深呼吸，活动腰背与颈部，让身体更舒展。".to_string(),
        "喝口水、伸伸手脚，给眼睛一点休息时间。".to_string(),
        "调整坐姿、慢慢活动，让专注重新回来。".to_string(),
    ]
}
