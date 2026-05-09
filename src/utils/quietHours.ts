import type { QuietHourRange, ReminderConfig, ReminderRule } from "@/types/global";

/** 中文注释：第一版配置键，仅作迁移只读源。 */
export const REMINDER_CONFIG_KEY_V1 = "reminder-config-v1";
/** 中文注释：第二版起正式读写键。 */
export const REMINDER_CONFIG_KEY_V2 = "reminder-config-v2";

/** 中文注释：免打扰时段条数上限（与产品设计一致）。 */
export const MAX_QUIET_HOUR_RANGES = 20;

/**
 * 中文注释：链式推迟最大迭代次数（与《需求规格说明书-第二版》US2-P2-02 默认 256 一致）；
 * 超过则停止继续移位并交由调用方告警（防止异常配置导致长时间循环）。
 */
export const MAX_QUIET_POSTPONE_ITERATIONS = 256;

function clampReminderDurationMinutes(minutes: number): number {
  return Math.min(10, Math.max(1, Math.round(minutes)));
}

function createDefaultRule(): ReminderRule {
  return {
    id: "default-rule",
    enabled: true,
    intervalMinutes: 60
  };
}

function clampIntervalMinutes(minutes: number): number {
  return Math.min(360, Math.max(1, Math.round(minutes)));
}

function normalizeRule(raw: unknown, index: number): ReminderRule {
  if (!raw || typeof raw !== "object") {
    return { ...createDefaultRule(), id: `rule-${index}` };
  }
  const o = raw as Record<string, unknown>;
  const interval =
    typeof o.intervalMinutes === "number" && Number.isFinite(o.intervalMinutes) ? o.intervalMinutes : 60;
  return {
    id: typeof o.id === "string" ? o.id : `rule-${index}`,
    enabled: o.enabled !== false,
    intervalMinutes: clampIntervalMinutes(interval)
  };
}

/** 中文注释：解析第一版形状的配置对象（不含免打扰字段）。 */
export function migrateV1ShapeToBaseConfig(raw: unknown): Omit<ReminderConfig, "quietHoursEnabled" | "quietHours"> {
  const defaults = {
    enabled: false,
    rules: [createDefaultRule()],
    autoStartEnabled: false,
    lockOnReminderFinishEnabled: true,
    reminderDurationMinutes: 2,
    randomTextEnabled: true,
    texts: ["该起来活动了，请保护你的肩颈和眼睛。", "走动一下，喝口水，再回来继续高效工作。", "久坐提醒：请立即起身活动。"]
  };
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  const o = raw as Record<string, unknown>;
  const rulesRaw = o.rules;
  const rules: ReminderRule[] = Array.isArray(rulesRaw) ? rulesRaw.map((r, i) => normalizeRule(r, i)) : defaults.rules;
  const textsRaw = o.texts;
  const migratedTexts = Array.isArray(textsRaw) ? textsRaw.filter((t): t is string => typeof t === "string") : defaults.texts;
  const filteredTexts = migratedTexts.filter((t) => t !== "久坐提醒：请立即起身活动2分钟。");
  return {
    enabled: Boolean(o.enabled),
    rules: rules.length ? rules : defaults.rules,
    autoStartEnabled: typeof o.autoStartEnabled === "boolean" ? o.autoStartEnabled : defaults.autoStartEnabled,
    lockOnReminderFinishEnabled:
      typeof o.lockOnReminderFinishEnabled === "boolean" ? o.lockOnReminderFinishEnabled : defaults.lockOnReminderFinishEnabled,
    reminderDurationMinutes:
      typeof o.reminderDurationMinutes === "number"
        ? clampReminderDurationMinutes(o.reminderDurationMinutes)
        : defaults.reminderDurationMinutes,
    randomTextEnabled: o.randomTextEnabled !== false,
    texts: filteredTexts.length ? filteredTexts : defaults.texts
  };
}

/**
 * 中文注释：将分钟索引约束在 0–1439。
 * - startMinutes < endMinutes：同日左闭右开 [start, end)。
 * - startMinutes > endMinutes：跨午夜，自当日 start 至次日 end（左闭右开）。
 * - 相等时修正为同日最短 1 分钟段，避免零长度。
 */
export function sanitizeQuietHourRange(q: QuietHourRange): QuietHourRange {
  let startMinutes = Math.min(1439, Math.max(0, Math.round(q.startMinutes)));
  let endMinutes = Math.min(1439, Math.max(0, Math.round(q.endMinutes)));
  if (startMinutes === endMinutes) {
    if (startMinutes < 1439) {
      endMinutes = startMinutes + 1;
    } else {
      startMinutes = 1438;
      endMinutes = 1439;
    }
  }
  return { ...q, startMinutes, endMinutes };
}

function normalizeQuietHourRaw(raw: unknown, index: number): QuietHourRange {
  if (!raw || typeof raw !== "object") {
    return sanitizeQuietHourRange({
      id: `quiet-${index}`,
      enabled: true,
      startMinutes: 12 * 60,
      endMinutes: 13 * 60
    });
  }
  const o = raw as Record<string, unknown>;
  const start =
    typeof o.startMinutes === "number" && Number.isFinite(o.startMinutes) ? Math.round(o.startMinutes) : 12 * 60;
  const end = typeof o.endMinutes === "number" && Number.isFinite(o.endMinutes) ? Math.round(o.endMinutes) : 13 * 60;
  return sanitizeQuietHourRange({
    id: typeof o.id === "string" ? o.id : `quiet-${index}`,
    enabled: o.enabled !== false,
    startMinutes: start,
    endMinutes: end
  });
}

/** 中文注释：将第一版 JSON 对象升为第二版（附加默认免打扰字段）。 */
export function migrateV1ObjectToV2(v1: unknown): ReminderConfig {
  const base = migrateV1ShapeToBaseConfig(v1);
  return {
    ...base,
    quietHoursEnabled: false,
    quietHours: []
  };
}

/** 中文注释：解析第二版持久化 JSON；缺省字段按安全默认补齐。 */
export function parseReminderConfigV2(raw: unknown): ReminderConfig {
  const base = migrateV1ShapeToBaseConfig(raw);
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      quietHoursEnabled: false,
      quietHours: []
    };
  }
  const o = raw as Record<string, unknown>;
  const qhRaw = o.quietHours;
  const quietHours: QuietHourRange[] = Array.isArray(qhRaw)
    ? qhRaw.map((item, i) => normalizeQuietHourRaw(item, i))
    : [];
  return {
    ...base,
    quietHoursEnabled: o.quietHoursEnabled === true,
    quietHours: quietHours.slice(0, MAX_QUIET_HOUR_RANGES)
  };
}

export function createDefaultReminderConfig(): ReminderConfig {
  return migrateV1ObjectToV2({});
}

/** 中文注释：启动加载配置时的可读说明，供界面 error 提示（《测试与验收方案》TC2-P2-02）。 */
export interface ReminderConfigLoadResult {
  config: ReminderConfig;
  /** 中文注释：若非空，表示曾发生解析/读取回退，应向用户展示错误提示。 */
  userMessage: string | null;
}

/**
 * 中文注释：从 localStorage 读取配置：优先 v2；否则 v1 迁移；失败时回退默认并返回 userMessage。
 * 不抛异常。
 */
export function loadReminderConfigFromStorageWithDiagnostics(): ReminderConfigLoadResult {
  let v2Corrupt = false;

  try {
    const rawV2 = localStorage.getItem(REMINDER_CONFIG_KEY_V2);
    if (rawV2 !== null && rawV2 !== "") {
      try {
        return { config: parseReminderConfigV2(JSON.parse(rawV2)), userMessage: null };
      } catch {
        v2Corrupt = true;
      }
    }
  } catch {
    v2Corrupt = true;
  }

  try {
    const rawV1 = localStorage.getItem(REMINDER_CONFIG_KEY_V1);
    if (rawV1 !== null && rawV1 !== "") {
      try {
        const migrated = migrateV1ObjectToV2(JSON.parse(rawV1));
        try {
          localStorage.setItem(REMINDER_CONFIG_KEY_V2, JSON.stringify(migrated));
        } catch {
          // 中文注释：写入失败时仍返回内存中的迁移结果；持久化 effect 会再试。
        }
        if (v2Corrupt) {
          return {
            config: migrated,
            userMessage: "检测到 reminder-config-v2 已损坏，已根据 v1 配置恢复并尝试写回。"
          };
        }
        return { config: migrated, userMessage: null };
      } catch {
        return {
          config: createDefaultReminderConfig(),
          userMessage: v2Corrupt
            ? "reminder-config-v2 与 v1 均无法解析，已使用默认提醒配置。"
            : "reminder-config-v1 无法解析，已使用默认提醒配置。"
        };
      }
    }
  } catch {
    return {
      config: createDefaultReminderConfig(),
      userMessage: "读取本地提醒配置失败，已使用默认提醒配置。"
    };
  }

  if (v2Corrupt) {
    return {
      config: createDefaultReminderConfig(),
      userMessage: "reminder-config-v2 已损坏且不存在 v1 备份，已使用默认提醒配置。"
    };
  }

  return { config: createDefaultReminderConfig(), userMessage: null };
}

/** 中文注释：仅返回配置；与 loadReminderConfigFromStorageWithDiagnostics 行为一致。 */
export function loadReminderConfigFromStorage(): ReminderConfig {
  return loadReminderConfigFromStorageWithDiagnostics().config;
}

/** 中文注释：将第二版配置写入 localStorage（唯一正式键）。 */
export function persistReminderConfigV2(config: ReminderConfig): void {
  localStorage.setItem(REMINDER_CONFIG_KEY_V2, JSON.stringify(config));
}

function startOfLocalDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 中文注释：本地日历日内的分钟索引 0–1439（与需求文档一致，按当前时刻的时、分取整）。 */
function minuteOfDayFromMs(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

const MS_PER_DAY = 24 * 60 * 60_000;

/** 中文注释：候选时刻是否落在免打扰段内（左闭右开）；s<e 同日，s>e 跨午夜。 */
function timestampHitsQuietRange(tMs: number, s: number, e: number): boolean {
  const m = minuteOfDayFromMs(tMs);
  if (s < e) {
    return m >= s && m < e;
  }
  return m >= s || m < e;
}

/**
 * 中文注释：tMs 须落在该段内；返回离开该段后的第一个整分时刻（>= tMs），再用于加间隔。
 * 同日段：当日 end 分；跨午夜晚间腿：次日 end 分；跨午夜清晨腿：当日 end 分。
 */
function exitAfterQuietMs(tMs: number, s: number, e: number): number {
  const dayStart = startOfLocalDayMs(tMs);
  const m = minuteOfDayFromMs(tMs);
  if (s < e) {
    return dayStart + e * 60_000;
  }
  if (m >= s) {
    return dayStart + MS_PER_DAY + e * 60_000;
  }
  return dayStart + e * 60_000;
}

export interface NextTriggerComputeResult {
  nextMs: number | null;
  /** 中文注释：达到链式推迟迭代上限，应提示用户检查免打扰配置。 */
  hitQuietPostponeCap: boolean;
}

/**
 * 中文注释：计算下一次触发时刻（含免打扰链式推迟）；支持同日段与跨午夜段（start>end）。
 * 使用胜出规则的间隔分钟数作为每次移位后的加算间隔（与需求示例 I=45 一致）。
 */
export function computeNextTriggerWithQuietHours(nowMs: number, config: ReminderConfig): NextTriggerComputeResult {
  const enabledRules = config.rules.filter((r) => r.enabled);
  if (!enabledRules.length) {
    return { nextMs: null, hitQuietPostponeCap: false };
  }

  let bestT: number | null = null;
  let winningInterval = enabledRules[0]?.intervalMinutes ?? 60;
  for (const rule of enabledRules) {
    const cand = nowMs + rule.intervalMinutes * 60_000;
    if (bestT === null || cand < bestT) {
      bestT = cand;
      winningInterval = rule.intervalMinutes;
    }
  }
  if (bestT === null) {
    return { nextMs: null, hitQuietPostponeCap: false };
  }

  if (!config.quietHoursEnabled) {
    return { nextMs: bestT, hitQuietPostponeCap: false };
  }

  const activeIntervals = config.quietHours.filter((q) => q.enabled && q.startMinutes !== q.endMinutes);
  if (!activeIntervals.length) {
    return { nextMs: bestT, hitQuietPostponeCap: false };
  }

  let t = bestT;
  for (let iter = 0; iter < MAX_QUIET_POSTPONE_ITERATIONS; iter++) {
    const covering = activeIntervals.filter((q) => timestampHitsQuietRange(t, q.startMinutes, q.endMinutes));
    if (!covering.length) {
      return { nextMs: t, hitQuietPostponeCap: false };
    }
    const boundary = Math.max(...covering.map((q) => exitAfterQuietMs(t, q.startMinutes, q.endMinutes)));
    t = boundary + winningInterval * 60_000;
  }

  return { nextMs: t, hitQuietPostponeCap: true };
}

export function createNewQuietHourRange(): QuietHourRange {
  return sanitizeQuietHourRange({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `quiet-${Date.now()}`,
    enabled: true,
    startMinutes: 12 * 60,
    endMinutes: 13 * 60
  });
}

/** 中文注释：0–1439 分钟索引 ↔ 时、分（用于设置页 InputNumber）。 */
export function minutesToHourMinute(total: number): { hour: number; minute: number } {
  const t = Math.min(1439, Math.max(0, Math.round(total)));
  return { hour: Math.floor(t / 60), minute: t % 60 };
}

export function hourMinuteToMinutes(hour: number, minute: number): number {
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  const m = Math.min(59, Math.max(0, Math.round(minute)));
  return Math.min(1439, h * 60 + m);
}

/** 中文注释：免打扰时段折叠标题用（24 小时制）；跨午夜时如 22:00-06:00（start>end）。 */
export function formatQuietHourRangeLabel(startMinutes: number, endMinutes: number): string {
  const s = minutesToHourMinute(startMinutes);
  const e = minutesToHourMinute(endMinutes);
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${pad(s.hour)}:${pad(s.minute)}-${pad(e.hour)}:${pad(e.minute)}`;
}
