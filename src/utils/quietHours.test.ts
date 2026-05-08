import { describe, expect, it } from "vitest";
import type { ReminderConfig } from "@/types/global";
import {
  computeNextTriggerWithQuietHours,
  migrateV1ObjectToV2,
  parseReminderConfigV2,
  sanitizeQuietHourRange
} from "@/utils/quietHours";

function baseConfig(partial: Partial<ReminderConfig> = {}): ReminderConfig {
  return {
    enabled: true,
    rules: [{ id: "r1", enabled: true, intervalMinutes: 45 }],
    autoStartEnabled: false,
    lockOnReminderFinishEnabled: true,
    reminderDurationMinutes: 2,
    randomTextEnabled: true,
    texts: ["a"],
    quietHoursEnabled: false,
    quietHours: [],
    ...partial
  };
}

describe("computeNextTriggerWithQuietHours", () => {
  it("TC2-P0-03：关闭免打扰时与第一版一致（取最短间隔候选）", () => {
    const nowMs = Date.UTC(2024, 4, 8, 3, 24, 0, 0); // 任意基准
    const config = baseConfig({
      quietHoursEnabled: false,
      rules: [
        { id: "a", enabled: true, intervalMinutes: 30 },
        { id: "b", enabled: true, intervalMinutes: 60 }
      ]
    });
    const { nextMs, hitQuietPostponeCap } = computeNextTriggerWithQuietHours(nowMs, config);
    expect(hitQuietPostponeCap).toBe(false);
    expect(nextMs).toBe(nowMs + 30 * 60_000);
  });

  it("TC2-P0-02：候选 12:09 落入 12:00–14:00，间隔 45 分钟 → 14:45（本地时区）", () => {
    // 中文注释：使用本地 Date 构造，与运行时调度一致（非 UTC）。
    const t0 = new Date(2024, 4, 8, 12, 9, 0, 0).getTime();
    const nowMs = t0 - 45 * 60_000;
    const config = baseConfig({
      quietHoursEnabled: true,
      quietHours: [{ id: "q1", enabled: true, startMinutes: 12 * 60, endMinutes: 14 * 60 }]
    });
    const { nextMs, hitQuietPostponeCap } = computeNextTriggerWithQuietHours(nowMs, config);
    expect(hitQuietPostponeCap).toBe(false);
    const expected = new Date(2024, 4, 8, 14, 45, 0, 0).getTime();
    expect(nextMs).toBe(expected);
  });

  it("TC2-P1-01：重叠区间取最晚结束边界 e", () => {
    const t0 = new Date(2024, 4, 8, 12, 30, 0, 0).getTime();
    const nowMs = t0 - 60 * 60_000;
    const config = baseConfig({
      rules: [{ id: "r1", enabled: true, intervalMinutes: 60 }],
      quietHoursEnabled: true,
      quietHours: [
        { id: "a", enabled: true, startMinutes: 11 * 60, endMinutes: 13 * 60 },
        { id: "b", enabled: true, startMinutes: 12 * 60, endMinutes: 15 * 60 }
      ]
    });
    const { nextMs } = computeNextTriggerWithQuietHours(nowMs, config);
    // 中文注释：12:30 同时落在两段内，Emax = max(13*60, 15*60) = 15*60
    const at15 = new Date(2024, 4, 8, 15, 0, 0, 0).getTime();
    const expected = at15 + 60 * 60_000;
    expect(nextMs).toBe(expected);
  });

  it("左闭右开：结束时刻整点不属于禁区内（14:00 不在 [12:00,14:00)）", () => {
    const t0 = new Date(2024, 4, 8, 14, 0, 0, 0).getTime();
    const nowMs = t0 - 45 * 60_000;
    const config = baseConfig({
      quietHoursEnabled: true,
      quietHours: [{ id: "q1", enabled: true, startMinutes: 12 * 60, endMinutes: 14 * 60 }]
    });
    const { nextMs } = computeNextTriggerWithQuietHours(nowMs, config);
    expect(nextMs).toBe(t0);
  });

  it("TC2-P1-04：禁用的时段不参与命中", () => {
    const t0 = new Date(2024, 4, 8, 12, 9, 0, 0).getTime();
    const nowMs = t0 - 45 * 60_000;
    const config = baseConfig({
      quietHoursEnabled: true,
      quietHours: [
        { id: "on", enabled: false, startMinutes: 12 * 60, endMinutes: 14 * 60 },
        { id: "off", enabled: true, startMinutes: 15 * 60, endMinutes: 16 * 60 }
      ]
    });
    const { nextMs } = computeNextTriggerWithQuietHours(nowMs, config);
    expect(nextMs).toBe(t0);
  });

  it("TC2-P1-02：链式跳过（第一次出禁区后再次落入下一段）", () => {
    const interval = 30;
    const t0 = new Date(2024, 4, 8, 11, 45, 0, 0).getTime();
    const nowMs = t0 - interval * 60_000;
    const config = baseConfig({
      rules: [{ id: "r1", enabled: true, intervalMinutes: interval }],
      quietHoursEnabled: true,
      quietHours: [
        { id: "a", enabled: true, startMinutes: 11 * 60 + 30, endMinutes: 12 * 60 },
        { id: "b", enabled: true, startMinutes: 12 * 60, endMinutes: 13 * 60 }
      ]
    });
    const { nextMs, hitQuietPostponeCap } = computeNextTriggerWithQuietHours(nowMs, config);
    expect(hitQuietPostponeCap).toBe(false);
    // 中文注释：11:45 落入第一段 → 12:00+30=12:30 仍落入第二段 → 13:00+30=13:30 跳出
    const expected = new Date(2024, 4, 8, 13, 30, 0, 0).getTime();
    expect(nextMs).toBe(expected);
  });
});

describe("迁移与清洗", () => {
  it("v1 升 v2 附带免打扰默认关闭与空列表", () => {
    const v2 = migrateV1ObjectToV2({ enabled: true, rules: [{ id: "x", enabled: true, intervalMinutes: 55 }] });
    expect(v2.quietHoursEnabled).toBe(false);
    expect(v2.quietHours).toEqual([]);
    expect(v2.rules[0]?.intervalMinutes).toBe(55);
  });

  it("parseReminderConfigV2 读取布尔与列表", () => {
    const c = parseReminderConfigV2({
      enabled: true,
      rules: [],
      quietHoursEnabled: true,
      quietHours: [{ id: "1", enabled: true, startMinutes: 10, endMinutes: 20 }]
    });
    expect(c.quietHoursEnabled).toBe(true);
    expect(c.quietHours).toHaveLength(1);
  });

  it("sanitizeQuietHourRange：结束早于等于开始时抬升 end", () => {
    const s = sanitizeQuietHourRange({
      id: "x",
      enabled: true,
      startMinutes: 100,
      endMinutes: 50
    });
    expect(s.endMinutes).toBeGreaterThan(s.startMinutes);
  });
});
