//! Windows 企业强控（Enterprise Hardening，企业加固）
//!
//! 能力组合：
//! - `WH_KEYBOARD_LL`（低层键盘钩子）：吞掉 Win / Alt / 常见系统快捷键等。
//! - `WH_MOUSE_LL`（低层鼠标钩子）：吞掉落在「提醒根窗口」之外的点击与滚轮，避免任务栏（Taskbar）/开始菜单被操作。
//! - `HWND_TOPMOST`（置顶 Z 序）：尽量压在壳层窗口之上。
//!
//! 边界：
//! - **无法**拦截 `Ctrl+Alt+Del`（安全注意序列，Secure Attention Sequence）等系统保护输入路径。
//! - 部分系统 UI（例如某些版本的 Alt+Tab 覆盖层）可能由更高权限组件绘制，仍可能出现「看得见但点不到/切不走」的中间态；本模块目标是尽可能接近 Kiosk（信息亭）体验。
//! - Win11 上 `WH_KEYBOARD_LL`（低层键盘钩子）**必须在安装线程具备消息泵**的上下文里更可靠；因此与 `RegisterHotKey`（注册热键）/子类化消费 `WM_HOTKEY` 组合，由主线程统一安装。
//!
//! **调试**：设置环境变量 `DEM_ENTERPRISE_HOTKEY_DEBUG` 为非空且非 `0`/`false`/`off`/`no` 时，`RegisterHotKey`（注册热键）失败会输出到 **stderr**（标准错误输出），便于排查 Win/Alt+Tab 等是否因热键未挂上而漏到系统。

use std::env::VarError;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL,
    MOD_NOREPEAT, MOD_SHIFT, MOD_WIN, VK_A, VK_APPS, VK_CONTROL, VK_D, VK_E, VK_ESCAPE, VK_F4,
    VK_I, VK_LMENU, VK_LWIN, VK_R, VK_RMENU, VK_RWIN, VK_S, VK_SPACE, VK_TAB, VK_Z,
};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, CallNextHookEx, GetAncestor, IsChild, IsWindow, SetForegroundWindow,
    SetWindowPos, SetWindowsHookExW, UnhookWindowsHookEx, WindowFromPoint, GA_ROOT, HHOOK,
    HWND_NOTOPMOST, HWND_TOPMOST, KBDLLHOOKSTRUCT, LLKHF_ALTDOWN, LLKHF_EXTENDED, MSLLHOOKSTRUCT,
    SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_HOTKEY, WM_KEYDOWN,
    WM_KEYUP, WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP,
    WM_MOUSEHWHEEL, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SYSKEYDOWN,
    WM_SYSKEYUP, WM_XBUTTONDOWN, WM_XBUTTONUP,
};

// 中文注释：HHOOK 未实现 Send，仅存指针位模式（bit pattern）。
static KEYBOARD_HOOK: Mutex<Option<usize>> = Mutex::new(None);
static MOUSE_HOOK: Mutex<Option<usize>> = Mutex::new(None);
static BLOCK_SYSTEM_SHORTCUTS: AtomicBool = AtomicBool::new(false);
static OVERLAY_ROOT_HWND: Mutex<Option<usize>> = Mutex::new(None);
static SUBCLASS_INSTALLED: AtomicBool = AtomicBool::new(false);
/// 中文注释：为 UnregisterHotKey 预留的连续 ID 区间上限（含），与注册表长度一致即可。
const HOTKEY_ID_BASE: i32 = 0x7100;
const HOTKEY_SLOT_COUNT: i32 = 48;

fn is_key_down(vk: u16) -> bool {
    unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
}

fn any_win_down() -> bool {
    is_key_down(VK_LWIN.0) || is_key_down(VK_RWIN.0)
}

fn any_alt_down() -> bool {
    is_key_down(VK_LMENU.0) || is_key_down(VK_RMENU.0)
}

fn overlay_root_hwnd() -> Option<HWND> {
    OVERLAY_ROOT_HWND
        .lock()
        .ok()
        .and_then(|guard| (*guard).map(|raw| HWND(raw as *mut std::ffi::c_void)))
}

/// 命中窗口是否属于提醒根窗口树（含 WebView2 子 HWND）。
fn hit_is_inside_overlay(hit: HWND, root: HWND) -> bool {
    if hit.0.is_null() || root.0.is_null() {
        return false;
    }
    unsafe {
        if !IsWindow(Some(hit)).as_bool() || !IsWindow(Some(root)).as_bool() {
            return false;
        }
        if hit == root {
            return true;
        }
        if IsChild(root, hit).as_bool() {
            return true;
        }
        let hit_root = GetAncestor(hit, GA_ROOT);
        hit_root == root
    }
}

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code < 0 {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }
    if !BLOCK_SYSTEM_SHORTCUTS.load(Ordering::SeqCst) {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }

    let msg = wparam.0 as u32;
    let is_key_event = matches!(msg, WM_KEYDOWN | WM_KEYUP | WM_SYSKEYDOWN | WM_SYSKEYUP);

    if !is_key_event {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }

    let info = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
    let vk = info.vkCode as u16;

    // 中文注释：企业模式下直接禁止 Alt 修饰键本身，避免 Alt+Tab 切换器 UI 先出现。
    if vk == VK_LMENU.0 || vk == VK_RMENU.0 {
        return LRESULT(1);
    }

    // 中文注释：Win 键与菜单键（开始菜单相关）。
    if vk == VK_LWIN.0 || vk == VK_RWIN.0 || vk == VK_APPS.0 {
        return LRESULT(1);
    }

    // 中文注释：扩展键扫描码兜底（部分键盘/输入法路径 vk 不稳定）。
    if info.flags.contains(LLKHF_EXTENDED) {
        let sc = info.scanCode;
        if sc == 0x5B || sc == 0x5C {
            return LRESULT(1);
        }
    }

    // 中文注释：Win + Tab / Win + Space / Win + D 等组合（在 Win 按下时拦截常见壳层快捷键）。
    if any_win_down() && vk != VK_LWIN.0 && vk != VK_RWIN.0 {
        if vk == VK_TAB.0 || vk == VK_SPACE.0 || vk == VK_D.0 {
            return LRESULT(1);
        }
    }

    // 中文注释：Alt+Tab / Alt+Esc / Alt+F4（双保险：异步 Alt 状态 + LLKHF_ALTDOWN）。
    if vk == VK_TAB.0 && any_alt_down() {
        return LRESULT(1);
    }
    if vk == VK_ESCAPE.0 && any_alt_down() {
        return LRESULT(1);
    }
    if vk == VK_F4.0 && (any_alt_down() || info.flags.contains(LLKHF_ALTDOWN)) {
        return LRESULT(1);
    }
    if info.flags.contains(LLKHF_ALTDOWN) && (vk == VK_TAB.0 || vk == VK_ESCAPE.0 || vk == VK_F4.0)
    {
        return LRESULT(1);
    }

    // 中文注释：Ctrl+Esc / Ctrl+Shift+Esc（任务管理器常见入口之一）。
    if vk == VK_ESCAPE.0 && is_key_down(VK_CONTROL.0) {
        return LRESULT(1);
    }

    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn is_swallowed_mouse_message(msg: u32) -> bool {
    matches!(
        msg,
        WM_LBUTTONDOWN
            | WM_LBUTTONUP
            | WM_LBUTTONDBLCLK
            | WM_RBUTTONDOWN
            | WM_RBUTTONUP
            | WM_MBUTTONDOWN
            | WM_MBUTTONUP
            | WM_XBUTTONDOWN
            | WM_XBUTTONUP
            | WM_MOUSEWHEEL
            | WM_MOUSEHWHEEL
    )
}

unsafe extern "system" fn low_level_mouse_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code < 0 {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }
    if !BLOCK_SYSTEM_SHORTCUTS.load(Ordering::SeqCst) {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }

    let msg = wparam.0 as u32;
    if msg == WM_MOUSEMOVE || !is_swallowed_mouse_message(msg) {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }

    let Some(root) = overlay_root_hwnd() else {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    };

    let info = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };
    let hit = unsafe { WindowFromPoint(info.pt) };

    if hit_is_inside_overlay(hit, root) {
        return unsafe { CallNextHookEx(None, code, wparam, lparam) };
    }

    LRESULT(1)
}

/// 安装企业强控钩子（键盘 + 鼠标）。`root` 为提醒顶层 HWND（通常为 Tauri 主窗口）。
pub fn enterprise_hooks_install(root: HWND) -> Result<(), String> {
    let mut kb_guard = KEYBOARD_HOOK
        .lock()
        .map_err(|_| "键盘钩子互斥锁失败".to_string())?;
    let mut mouse_guard = MOUSE_HOOK
        .lock()
        .map_err(|_| "鼠标钩子互斥锁失败".to_string())?;
    if kb_guard.is_some() || mouse_guard.is_some() {
        return Ok(());
    }

    let hmod =
        unsafe { GetModuleHandleW(None) }.map_err(|e| format!("GetModuleHandleW 失败: {e:?}"))?;
    let hinstance = windows::Win32::Foundation::HINSTANCE::from(hmod);

    let kb_hook = unsafe {
        SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            Some(hinstance),
            0,
        )
    }
    .map_err(|e| format!("SetWindowsHookExW(KEYBOARD_LL) 失败: {e:?}"))?;

    {
        let mut overlay = OVERLAY_ROOT_HWND.lock().map_err(|_| {
            let _ = unsafe { UnhookWindowsHookEx(HHOOK(kb_hook.0 as *mut std::ffi::c_void)) };
            "覆盖窗口句柄互斥锁失败".to_string()
        })?;
        *overlay = Some(root.0 as usize);
    }

    let mouse_hook = match unsafe {
        SetWindowsHookExW(WH_MOUSE_LL, Some(low_level_mouse_proc), Some(hinstance), 0)
    } {
        Ok(h) => h,
        Err(e) => {
            let _ = unsafe { UnhookWindowsHookEx(HHOOK(kb_hook.0 as *mut std::ffi::c_void)) };
            if let Ok(mut overlay) = OVERLAY_ROOT_HWND.lock() {
                *overlay = None;
            }
            return Err(format!("SetWindowsHookExW(MOUSE_LL) 失败: {e:?}"));
        }
    };

    *kb_guard = Some(kb_hook.0 as usize);
    *mouse_guard = Some(mouse_hook.0 as usize);
    BLOCK_SYSTEM_SHORTCUTS.store(true, Ordering::SeqCst);
    Ok(())
}

/// 卸载企业强控钩子（幂等）。
pub fn enterprise_hooks_uninstall() -> Result<(), String> {
    BLOCK_SYSTEM_SHORTCUTS.store(false, Ordering::SeqCst);

    {
        let mut overlay = OVERLAY_ROOT_HWND
            .lock()
            .map_err(|_| "覆盖窗口句柄互斥锁失败".to_string())?;
        *overlay = None;
    }

    let mut kb_guard = KEYBOARD_HOOK
        .lock()
        .map_err(|_| "键盘钩子互斥锁失败".to_string())?;
    if let Some(raw) = kb_guard.take() {
        let hook = HHOOK(raw as *mut std::ffi::c_void);
        unsafe { UnhookWindowsHookEx(hook) }
            .map_err(|e| format!("UnhookWindowsHookEx(KEYBOARD) 失败: {e:?}"))?;
    }

    let mut mouse_guard = MOUSE_HOOK
        .lock()
        .map_err(|_| "鼠标钩子互斥锁失败".to_string())?;
    if let Some(raw) = mouse_guard.take() {
        let hook = HHOOK(raw as *mut std::ffi::c_void);
        unsafe { UnhookWindowsHookEx(hook) }
            .map_err(|e| format!("UnhookWindowsHookEx(MOUSE) 失败: {e:?}"))?;
    }

    Ok(())
}

/// 将窗口置于 HWND_TOPMOST，并铺满给定物理矩形，尽量压在任务栏与其他壳层窗口之上。
pub fn apply_topmost_cover(
    hwnd: HWND,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let flags = SWP_SHOWWINDOW;
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            x,
            y,
            width as i32,
            height as i32,
            flags,
        )
        .map_err(|e| format!("SetWindowPos TOPMOST 失败: {e:?}"))?;
        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);
    }
    Ok(())
}

/// 维持 HWND_TOPMOST（不改变位置与尺寸），供焦点守护线程调用。
pub fn reinforce_topmost(hwnd: HWND) -> Result<(), String> {
    let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW;
    unsafe {
        SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags)
            .map_err(|e| format!("SetWindowPos 维持置顶失败: {e:?}"))?;
        let _ = SetForegroundWindow(hwnd);
    }
    Ok(())
}

/// 中文注释：`HWND` 非 `Send` 时从后台线程投递主线程使用指针位模式。
pub fn reinforce_topmost_bits(hwnd_bits: usize) -> Result<(), String> {
    reinforce_topmost(HWND(hwnd_bits as *mut std::ffi::c_void))
}

/// 取消 HWND_TOPMOST，恢复普通 Z 序（不改变当前位置与尺寸）。
pub fn clear_topmost(hwnd: HWND) -> Result<(), String> {
    let flags = SWP_NOMOVE | SWP_NOSIZE;
    unsafe {
        SetWindowPos(hwnd, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags)
            .map_err(|e| format!("SetWindowPos NOTOPMOST 失败: {e:?}"))?;
    }
    Ok(())
}

const SUBCLASS_UID: usize = 0x4D524544u64 as usize;

unsafe extern "system" fn enterprise_subclass_proc(
    hwnd: HWND,
    umsg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _uidsubclass: usize,
    _dwrefdata: usize,
) -> LRESULT {
    if umsg == WM_HOTKEY {
        // 中文注释：消费系统投递的热键消息，避免默认处理链再次触发壳层行为。
        return LRESULT(0);
    }
    unsafe { DefSubclassProc(hwnd, umsg, wparam, lparam) }
}

fn subclass_install(hwnd: HWND) -> Result<(), String> {
    if SUBCLASS_INSTALLED.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let ok = unsafe {
        SetWindowSubclass(hwnd, Some(enterprise_subclass_proc), SUBCLASS_UID, 0).as_bool()
    };
    if !ok {
        SUBCLASS_INSTALLED.store(false, Ordering::SeqCst);
        return Err("SetWindowSubclass 失败".to_string());
    }
    Ok(())
}

fn subclass_remove(hwnd: HWND) -> Result<(), String> {
    if SUBCLASS_INSTALLED.swap(false, Ordering::SeqCst) {
        let _ = unsafe { RemoveWindowSubclass(hwnd, Some(enterprise_subclass_proc), SUBCLASS_UID) };
    }
    Ok(())
}

/// 中文注释：是否输出 `RegisterHotKey`（注册热键）失败详情（stderr）。
fn hotkey_register_debug_enabled() -> bool {
    match std::env::var("DEM_ENTERPRISE_HOTKEY_DEBUG") {
        Ok(s) => {
            let t = s.trim().to_ascii_lowercase();
            !t.is_empty() && t != "0" && t != "false" && t != "off" && t != "no"
        }
        Err(VarError::NotPresent) => false,
        Err(VarError::NotUnicode(_)) => true,
    }
}

fn register_system_hotkeys(hwnd: HWND) {
    let combos: Vec<(HOT_KEY_MODIFIERS, u16)> = vec![
        (MOD_ALT | MOD_NOREPEAT, VK_TAB.0),
        (MOD_ALT | MOD_NOREPEAT, VK_ESCAPE.0),
        (MOD_ALT | MOD_NOREPEAT, VK_F4.0),
        (MOD_ALT | MOD_SHIFT | MOD_NOREPEAT, VK_TAB.0),
        (MOD_ALT | MOD_CONTROL | MOD_NOREPEAT, VK_TAB.0),
        (MOD_WIN | MOD_NOREPEAT, VK_TAB.0),
        (MOD_WIN | MOD_NOREPEAT, VK_SPACE.0),
        (MOD_WIN | MOD_NOREPEAT, VK_D.0),
        (MOD_WIN | MOD_NOREPEAT, VK_E.0),
        (MOD_WIN | MOD_NOREPEAT, VK_R.0),
        (MOD_WIN | MOD_NOREPEAT, VK_Z.0),
        (MOD_WIN | MOD_NOREPEAT, VK_A.0),
        (MOD_WIN | MOD_NOREPEAT, VK_I.0),
        (MOD_CONTROL | MOD_NOREPEAT, VK_ESCAPE.0),
        (MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT, VK_ESCAPE.0),
        (MOD_WIN | MOD_CONTROL | MOD_NOREPEAT, VK_D.0),
        (HOT_KEY_MODIFIERS(0), VK_LWIN.0),
        (HOT_KEY_MODIFIERS(0), VK_RWIN.0),
        (MOD_WIN | MOD_SHIFT | MOD_NOREPEAT, VK_S.0),
    ];

    let labels: &[&str] = &[
        "Alt+Tab",
        "Alt+Esc",
        "Alt+F4",
        "Alt+Shift+Tab",
        "Alt+Ctrl+Tab",
        "Win+Tab",
        "Win+Space",
        "Win+D",
        "Win+E",
        "Win+R",
        "Win+Z",
        "Win+A",
        "Win+I",
        "Ctrl+Esc",
        "Ctrl+Shift+Esc",
        "Win+Ctrl+D",
        "左 Win（无修饰键）",
        "右 Win（无修饰键）",
        "Win+Shift+S",
    ];

    let debug = hotkey_register_debug_enabled();

    for (i, (mods, vk)) in combos.iter().enumerate().take(HOTKEY_SLOT_COUNT as usize) {
        let id = HOTKEY_ID_BASE + i as i32;
        let label = labels.get(i).copied().unwrap_or("?");
        let r = unsafe { RegisterHotKey(Some(hwnd), id, *mods, *vk as u32) };
        if let Err(e) = r {
            if debug {
                eprintln!(
                    "[dem-app][enterprise] RegisterHotKey 失败: label={} hotkey_id=0x{:X} mods=0x{:X} vk=0x{:X} error={}",
                    label, id as u32, mods.0, *vk, e
                );
            }
        }
    }
}

fn unregister_system_hotkeys(hwnd: HWND) {
    for i in 0..HOTKEY_SLOT_COUNT {
        let _ = unsafe { UnregisterHotKey(Some(hwnd), HOTKEY_ID_BASE + i) };
    }
}

/// 中文注释：企业层一键启用（须在 GUI 主线程调用）。`hwnd_bits` 为 `HWND.0` 指针位模式；`cover` 为 `Some` 时使用虚拟屏联合矩形置顶。
pub fn enterprise_layer_activate(
    hwnd_bits: usize,
    cover: Option<(i32, i32, u32, u32)>,
) -> Result<(), String> {
    let hwnd = HWND(hwnd_bits as *mut std::ffi::c_void);
    let result = (|| {
        if let Some((x, y, w, h)) = cover {
            apply_topmost_cover(hwnd, x, y, w, h)?;
        } else {
            reinforce_topmost(hwnd)?;
        }
        subclass_install(hwnd)?;
        register_system_hotkeys(hwnd);
        enterprise_hooks_install(hwnd)?;
        Ok::<(), String>(())
    })();

    if result.is_err() {
        let _ = enterprise_hooks_uninstall();
        unregister_system_hotkeys(hwnd);
        let _ = subclass_remove(hwnd);
    }

    result
}

/// 中文注释：企业层一键关闭（须在 GUI 主线程调用）。`hwnd_bits` 为 `HWND.0` 指针位模式。
pub fn enterprise_layer_deactivate(hwnd_bits: usize) -> Result<(), String> {
    let hwnd = HWND(hwnd_bits as *mut std::ffi::c_void);
    let _ = enterprise_hooks_uninstall();
    unregister_system_hotkeys(hwnd);
    subclass_remove(hwnd)?;
    clear_topmost(hwnd)?;
    Ok(())
}
