import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, PatchMeta, PluginMeta, ReminderRuntime } from "@/types/global";

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

export async function pushSystemNotification(title: string, body: string): Promise<void> {
  return invoke("push_system_notification", { title, body });
}
