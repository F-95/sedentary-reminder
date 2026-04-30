export interface AppInfo {
  name: string;
  version: string;
  appId: string;
}

export interface PatchMeta {
  version: string;
  platform: "windows" | "macos" | "linux" | "all";
  entry: string;
}

export interface PluginMeta {
  id: string;
  version: string;
  permissions: string[];
}

/** 提醒规则：第1版仅支持按固定间隔（interval，间隔）重复提醒 */
export interface ReminderRule {
  id: string;
  enabled: boolean;
  intervalMinutes: number;
}

export interface ReminderConfig {
  enabled: boolean;
  rules: ReminderRule[];
  /** 是否启用开机自启（AutoStart） */
  autoStartEnabled: boolean;
  /** 是否在提醒结束后执行锁屏 */
  lockOnReminderFinishEnabled: boolean;
  /** 提醒倒计时（活动时长），单位分钟（1-10） */
  reminderDurationMinutes: number;
  randomTextEnabled: boolean;
  texts: string[];
}

export interface ReminderRuntime {
  mandatoryModeActive: boolean;
  activeSessionId: string | null;
  nextTriggerAtMs: number | null;
  primaryCenterX: number | null;
  primaryCenterY: number | null;
}

/** 中文注释：托盘菜单点击后由后端 emit 的字段名（与 Rust 一致）。 */
export type TrayToggleField = "autoStart" | "enabled" | "lockOnFinish";

export interface TrayFieldTogglePayload {
  field: TrayToggleField;
}

/** 中文注释：主窗口关闭后的行为记忆：`ask` 每次询问，`tray` 最小化到托盘，`exit` 退出进程。 */
export type CloseBehaviorPreference = "ask" | "tray" | "exit";
