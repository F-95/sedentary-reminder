import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, PatchMeta, PluginMeta, ReminderRuntime, StatEventRecord } from "@/types/global";

/** 中文注释：托盘菜单切换字段事件名，须与 `src-tauri/src/tray.rs` 常量一致。 */
export const EVENT_TRAY_FIELD_TOGGLE = "tray-field-toggle";

/** 中文注释：主窗口关闭拦截后由后端转发给前端的事件名。 */
export const EVENT_MAIN_CLOSE_REQUESTED = "main-close-requested";

/** 中文注释：关闭主窗口时「记住选择」的 localStorage 键。 */
export const CLOSE_BEHAVIOR_STORAGE_KEY = "close-behavior-v1";

/** 中文注释：主题模式持久化键（第六版）。 */
export const THEME_MODE_STORAGE_KEY = "theme-mode-v1";

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

export async function updateNextTrigger(triggerAtMs: number | null, triggerLabel: string | null): Promise<void> {
  return invoke("update_next_trigger", { triggerAtMs, triggerLabel });
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

/** 中文注释：追加一条本地统计事件（非 Tauri 环境可静默跳过）。 */
export async function recordStatEvent(kind: string, atMs?: number): Promise<void> {
  try {
    await invoke("record_stat_event", { kind, atMs: atMs ?? null });
  } catch {
    // 中文注释：开发态浏览器或非 Tauri 时忽略。
  }
}

/** 中文注释：按毫秒时间窗查询统计事件。 */
export async function queryStatEvents(fromMs: number, toMs: number): Promise<StatEventRecord[]> {
  try {
    return await invoke<StatEventRecord[]>("query_stat_events", { fromMs, toMs });
  } catch {
    return [];
  }
}

/** 中文注释：第十版——与后端 `session_unlock` 模块 emit 名称一致。 */
export const EVENT_SESSION_UNLOCKED = "session-unlocked";

/** 中文注释：调度快照载荷（字段名与 Rust `SchedulerSnapshot` serde camelCase 对齐）。 */
export interface SchedulerSnapshotPayload {
  schemaVersion: number;
  fingerprint: string;
  sedentaryNextAtMs: number | null;
  hydrationNextAtMs: number | null;
}

export async function loadSchedulerSnapshot(): Promise<SchedulerSnapshotPayload | null> {
  try {
    return await invoke<SchedulerSnapshotPayload | null>("load_scheduler_snapshot");
  } catch {
    return null;
  }
}

export async function saveSchedulerSnapshot(snapshot: SchedulerSnapshotPayload): Promise<void> {
  try {
    await invoke("save_scheduler_snapshot", { snapshot });
  } catch {
    // 中文注释：开发态浏览器或磁盘异常时静默，不打断主流程。
  }
}
