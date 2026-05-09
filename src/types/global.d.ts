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

/**
 * 中文注释：免打扰时段（左闭右开），0–1439 为本地日内分钟索引。
 * startMinutes < endMinutes：同日；startMinutes > endMinutes：跨午夜（当日 start 至次日 end）。
 */
export interface QuietHourRange {
  id: string;
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
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
  /** 中文注释：免打扰总开关（第二版）；关闭时调度与第一版一致。 */
  quietHoursEnabled: boolean;
  /** 中文注释：免打扰时段列表（第二版）。 */
  quietHours: QuietHourRange[];
  /** 中文注释：补水提醒总开关（第四版）；仅系统通知，不触发全屏提醒。 */
  hydrationReminderEnabled: boolean;
  /** 中文注释：补水提醒间隔分钟（第四版），与久坐间隔同为 1–360。 */
  hydrationIntervalMinutes: number;
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

/** 中文注释：主题偏好（第六版）：浅色 / 深色 / 跟随系统。 */
export type ThemeModePreference = "light" | "dark" | "system";

/** 中文注释：统计事件类型，与后端 `record_stat_event` 约定一致。 */
export type StatEventKind = "sedentary_completed" | "sedentary_triggered" | "hydration_notified";

export interface StatEventRecord {
  kind: string;
  atMs: number;
}
