import type { StatEventRecord } from "@/types/global";

/** 中文注释：统计详情页时间维度。 */
export type StatsDimension = "day" | "week" | "month" | "year";

export interface BucketDatum {
  label: string;
  /** 中文注释：久坐完成次数。 */
  sedentaryCompleted: number;
  /** 中文注释：补水通知次数。 */
  hydrationNotified: number;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function padMonthDay(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

/** 中文注释：枢纽简报用——最近 7 个日历日（含今日）的久坐完成次数。 */
export function briefLast7DaysSedentaryCounts(events: StatEventRecord[], nowMs: number): { label: string; count: number }[] {
  const dayStart = startOfLocalDay(new Date(nowMs)).getTime();
  const out: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = dayStart - i * 86400000;
    const end = start + 86400000 - 1;
    const label = padMonthDay(new Date(start));
    const count = events.filter((e) => e.kind === "sedentary_completed" && e.atMs >= start && e.atMs <= end).length;
    out.push({ label, count });
  }
  return out;
}

/** 中文注释：今日久坐完成次数。 */
export function countSedentaryCompletedToday(events: StatEventRecord[], nowMs: number): number {
  const start = startOfLocalDay(new Date(nowMs)).getTime();
  const end = start + 86400000 - 1;
  return events.filter((e) => e.kind === "sedentary_completed" && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：本周（周一至周日，本地时区）久坐完成次数。 */
export function countSedentaryCompletedThisCalendarWeek(events: StatEventRecord[], nowMs: number): number {
  const d = new Date(nowMs);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset));
  const start = monday.getTime();
  const end = start + 7 * 86400000 - 1;
  return events.filter((e) => e.kind === "sedentary_completed" && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：详情页按维度生成桶与计数。 */
export function buildDetailBuckets(events: StatEventRecord[], dimension: StatsDimension, nowMs: number): BucketDatum[] {
  const now = new Date(nowMs);
  const sed = events.filter((e) => e.kind === "sedentary_completed");
  const hyd = events.filter((e) => e.kind === "hydration_notified");

  if (dimension === "day") {
    const start = startOfLocalDay(now).getTime();
    const out: BucketDatum[] = [];
    for (let h = 0; h < 24; h++) {
      const hs = start + h * 3600000;
      const he = hs + 3600000 - 1;
      out.push({
        label: `${h}:00`,
        sedentaryCompleted: sed.filter((e) => e.atMs >= hs && e.atMs <= he).length,
        hydrationNotified: hyd.filter((e) => e.atMs >= hs && e.atMs <= he).length
      });
    }
    return out;
  }

  if (dimension === "week") {
    const dayStart = startOfLocalDay(now).getTime();
    const out: BucketDatum[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = dayStart - i * 86400000;
      const end = start + 86400000 - 1;
      out.push({
        label: padMonthDay(new Date(start)),
        sedentaryCompleted: sed.filter((e) => e.atMs >= start && e.atMs <= end).length,
        hydrationNotified: hyd.filter((e) => e.atMs >= start && e.atMs <= end).length
      });
    }
    return out;
  }

  if (dimension === "month") {
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: BucketDatum[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const start = new Date(y, m, day, 0, 0, 0, 0).getTime();
      const end = start + 86400000 - 1;
      out.push({
        label: `${day}日`,
        sedentaryCompleted: sed.filter((e) => e.atMs >= start && e.atMs <= end).length,
        hydrationNotified: hyd.filter((e) => e.atMs >= start && e.atMs <= end).length
      });
    }
    return out;
  }

  // year
  const y = now.getFullYear();
  const out: BucketDatum[] = [];
  for (let month = 0; month < 12; month++) {
    const start = new Date(y, month, 1, 0, 0, 0, 0).getTime();
    const end = new Date(y, month + 1, 1, 0, 0, 0, 0).getTime() - 1;
    out.push({
      label: `${month + 1}月`,
      sedentaryCompleted: sed.filter((e) => e.atMs >= start && e.atMs <= end).length,
      hydrationNotified: hyd.filter((e) => e.atMs >= start && e.atMs <= end).length
    });
  }
  return out;
}

/** 中文注释：详情查询时间窗（闭区间），用于 invoke queryStatEvents。 */
export function queryRangeForDimension(dimension: StatsDimension, nowMs: number): { fromMs: number; toMs: number } {
  const now = new Date(nowMs);
  const toMs = nowMs;
  if (dimension === "day") {
    const from = startOfLocalDay(now).getTime();
    return { fromMs: from, toMs };
  }
  if (dimension === "week") {
    const dayStart = startOfLocalDay(now).getTime();
    return { fromMs: dayStart - 6 * 86400000, toMs };
  }
  if (dimension === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    return { fromMs: from, toMs };
  }
  const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
  return { fromMs: from, toMs };
}
