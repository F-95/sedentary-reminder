import type { StatEventRecord } from "@/types/global";

/** 中文注释：统计详情页时间维度。 */
export type StatsDimension = "day" | "week" | "month" | "year";

export interface BucketDatum {
  label: string;
  /** 中文注释：活动次数 = 久坐完成 + 枢纽记录活动。 */
  activityMerged: number;
  /** 中文注释：未活动次数 = 跳过本次。 */
  sedentarySkipped: number;
}

/** 中文注释：枢纽近 7 日堆叠图单日数据。 */
export interface BriefDayStackDatum {
  label: string;
  activityMerged: number;
  sedentarySkipped: number;
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

/** 中文注释：是否计入「活动次数」合并柱。 */
function isActivityMergedKind(kind: string): boolean {
  return kind === "sedentary_completed" || kind === "sedentary_activity_logged";
}

/** 中文注释：枢纽简报用——最近 7 个日历日（含今日）的活动合并与跳过次数。 */
export function briefLast7DaysActivityStacks(events: StatEventRecord[], nowMs: number): BriefDayStackDatum[] {
  const dayStart = startOfLocalDay(new Date(nowMs)).getTime();
  const out: BriefDayStackDatum[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = dayStart - i * 86400000;
    const end = start + 86400000 - 1;
    const label = padMonthDay(new Date(start));
    const activityMerged = events.filter(
      (e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end
    ).length;
    const sedentarySkipped = events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length;
    out.push({ label, activityMerged, sedentarySkipped });
  }
  return out;
}

/** 中文注释：今日活动次数（完成 + 记录活动）。 */
export function countActivityMergedToday(events: StatEventRecord[], nowMs: number): number {
  const start = startOfLocalDay(new Date(nowMs)).getTime();
  const end = start + 86400000 - 1;
  return events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：今日跳过久坐次数。 */
export function countSkipsToday(events: StatEventRecord[], nowMs: number): number {
  const start = startOfLocalDay(new Date(nowMs)).getTime();
  const end = start + 86400000 - 1;
  return events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：本周（周一至周日，本地时区）活动合并次数。 */
export function countActivityMergedThisCalendarWeek(events: StatEventRecord[], nowMs: number): number {
  const d = new Date(nowMs);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset));
  const start = monday.getTime();
  const end = start + 7 * 86400000 - 1;
  return events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：本周跳过次数。 */
export function countSkipsThisCalendarWeek(events: StatEventRecord[], nowMs: number): number {
  const d = new Date(nowMs);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset));
  const start = monday.getTime();
  const end = start + 7 * 86400000 - 1;
  return events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length;
}

/** 中文注释：详情页按维度生成桶（堆叠图仅活动合并 + 跳过）。 */
export function buildDetailBuckets(events: StatEventRecord[], dimension: StatsDimension, nowMs: number): BucketDatum[] {
  const now = new Date(nowMs);

  if (dimension === "day") {
    const start = startOfLocalDay(now).getTime();
    const out: BucketDatum[] = [];
    for (let h = 0; h < 24; h++) {
      const hs = start + h * 3600000;
      const he = hs + 3600000 - 1;
      out.push({
        label: `${h}:00`,
        activityMerged: events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= hs && e.atMs <= he).length,
        sedentarySkipped: events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= hs && e.atMs <= he).length
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
        activityMerged: events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end).length,
        sedentarySkipped: events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length
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
        activityMerged: events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end).length,
        sedentarySkipped: events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length
      });
    }
    return out;
  }

  const y = now.getFullYear();
  const out: BucketDatum[] = [];
  for (let month = 0; month < 12; month++) {
    const start = new Date(y, month, 1, 0, 0, 0, 0).getTime();
    const end = new Date(y, month + 1, 1, 0, 0, 0, 0).getTime() - 1;
    out.push({
      label: `${month + 1}月`,
      activityMerged: events.filter((e) => isActivityMergedKind(e.kind) && e.atMs >= start && e.atMs <= end).length,
      sedentarySkipped: events.filter((e) => e.kind === "sedentary_skipped" && e.atMs >= start && e.atMs <= end).length
    });
  }
  return out;
}

/** 中文注释：当前时间窗内合计指标（活动统计页文案 + 简报）。 */
export interface WindowTotals {
  sedentaryTriggered: number;
  hydrationNotified: number;
  proactiveActivity: number;
  skips: number;
  /** 中文注释：完成 + 记录活动（用于情绪文案与峰值描述）。 */
  activityMerged: number;
}

export function aggregateWindowTotals(events: StatEventRecord[]): WindowTotals {
  let sedentaryTriggered = 0;
  let hydrationNotified = 0;
  let proactiveActivity = 0;
  let skips = 0;
  let activityMerged = 0;
  for (const e of events) {
    if (e.kind === "sedentary_triggered") {
      sedentaryTriggered += 1;
    } else if (e.kind === "hydration_notified") {
      hydrationNotified += 1;
    } else if (e.kind === "sedentary_activity_logged") {
      proactiveActivity += 1;
      activityMerged += 1;
    } else if (e.kind === "sedentary_skipped") {
      skips += 1;
    } else if (e.kind === "sedentary_completed") {
      activityMerged += 1;
    }
  }
  return { sedentaryTriggered, hydrationNotified, proactiveActivity, skips, activityMerged };
}

/** 中文注释：活动合并次数最多的桶标签（并列取先出现者）；全 0 返回 null。 */
export function peakActivityMergedBucketLabel(buckets: BucketDatum[]): string | null {
  if (!buckets.length) {
    return null;
  }
  let max = -1;
  let label: string | null = null;
  for (const b of buckets) {
    if (b.activityMerged > max) {
      max = b.activityMerged;
      label = b.label;
    }
  }
  if (max <= 0) {
    return null;
  }
  return label;
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
