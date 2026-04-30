import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, PatchMeta, PluginMeta, ReminderRuntime } from "@/types/global";

/** 中文注释：托盘菜单切换字段事件名，须与 `src-tauri/src/tray.rs` 常量一致。 */
export const EVENT_TRAY_FIELD_TOGGLE = "tray-field-toggle";

/** 中文注释：主窗口关闭拦截后由后端转发给前端的事件名。 */
export const EVENT_MAIN_CLOSE_REQUESTED = "main-close-requested";

/** 中文注释：关闭主窗口时「记住选择」的 localStorage 键。 */
export const CLOSE_BEHAVIOR_STORAGE_KEY = "close-behavior-v1";

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export async function listPatches(): Promise<PatchMeta[]> {
  return invoke<PatchMeta[]>("list_patches");
}

export async function listPlugins(): Promise<PluginMeta[]> {
  return invoke<PluginMeta[]>("list_plugins");
}

export async function setReminderWindowMode(active: boolean): Promise<void> {
  return invoke("set_reminder_window_mode", { active });
}

export async function updateNextTrigger(triggerAtMs: number | null): Promise<void> {
  return invoke("update_next_trigger", { triggerAtMs });
}

export async function startReminderSession(sessionId: string): Promise<void> {
  return invoke("start_reminder_session", { sessionId });
}

export async function finishActivityAndLock(sessionId: string, lockEnabled: boolean): Promise<void> {
  return invoke("finish_activity_and_lock", { sessionId, lockEnabled });
}

export async function getReminderRuntime(): Promise<ReminderRuntime> {
  return invoke<ReminderRuntime>("get_reminder_runtime");
}

export async function listDefaultSlogans(): Promise<string[]> {
  return invoke<string[]>("list_default_slogans");
}

export async function setAutoStartEnabled(enabled: boolean): Promise<void> {
  return invoke("set_auto_start", { enabled });
}

/** 中文注释：将当前提醒配置中的三个布尔同步到系统托盘勾选菜单。 */
export async function syncTrayMenu(autoStart: boolean, reminderEnabled: boolean, lockOnFinish: boolean): Promise<void> {
  return invoke("sync_tray_menu", { autoStart, reminderEnabled, lockOnFinish });
}

/** 中文注释：退出整个应用进程。 */
export async function exitApp(): Promise<void> {
  return invoke("exit_app");
}

