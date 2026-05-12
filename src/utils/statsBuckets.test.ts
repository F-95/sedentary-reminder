import { describe, expect, it } from "vitest";
import type { StatEventRecord } from "@/types/global";
import {
  aggregateWindowTotals,
  briefLast7DaysActivityStacks,
  buildDetailBuckets,
  countActivityMergedToday,
  peakActivityMergedBucketLabel,
  queryRangeForDimension
} from "@/utils/statsBuckets";

describe("statsBuckets", () => {
  it("countActivityMergedToday counts completed and logged", () => {
    const start = new Date(2026, 4, 9, 10, 0, 0, 0).getTime();
    const events: StatEventRecord[] = [
      { kind: "sedentary_completed", atMs: start },
      { kind: "sedentary_activity_logged", atMs: start + 1000 },
      { kind: "sedentary_completed", atMs: start - 86400000 }
    ];
    expect(countActivityMergedToday(events, start + 3600000)).toBe(2);
  });

  it("briefLast7DaysActivityStacks returns 7 buckets", () => {
    const now = new Date(2026, 4, 9, 12, 0, 0, 0).getTime();
    const events: StatEventRecord[] = [];
    const brief = briefLast7DaysActivityStacks(events, now);
    expect(brief).toHaveLength(7);
    expect(brief[0]).toMatchObject({ label: expect.any(String), activityMerged: 0, sedentarySkipped: 0 });
  });

  it("queryRangeForDimension day starts at local midnight", () => {
    const now = new Date(2026, 4, 9, 15, 30, 0, 0).getTime();
    const { fromMs, toMs } = queryRangeForDimension("day", now);
    expect(toMs).toBe(now);
    const d = new Date(fromMs);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("buildDetailBuckets day has 24 hours with merged activity and skips", () => {
    const day0 = new Date(2026, 4, 9, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 4, 9, 12, 0, 0, 0).getTime();
    const events: StatEventRecord[] = [
      { kind: "sedentary_completed", atMs: day0 + 2 * 3600000 + 1000 },
      { kind: "sedentary_activity_logged", atMs: day0 + 2 * 3600000 + 2000 },
      { kind: "sedentary_skipped", atMs: day0 + 5 * 3600000 }
    ];
    const buckets = buildDetailBuckets(events, "day", now);
    expect(buckets).toHaveLength(24);
    expect(buckets[2]!.activityMerged).toBe(2);
    expect(buckets[2]!.sedentarySkipped).toBe(0);
    expect(buckets[5]!.sedentarySkipped).toBe(1);
  });

  it("peakActivityMergedBucketLabel picks max activity bucket", () => {
    const buckets = [
      { label: "A", activityMerged: 1, sedentarySkipped: 0 },
      { label: "B", activityMerged: 3, sedentarySkipped: 1 },
      { label: "C", activityMerged: 2, sedentarySkipped: 0 }
    ];
    expect(peakActivityMergedBucketLabel(buckets)).toBe("B");
    expect(peakActivityMergedBucketLabel([])).toBeNull();
    expect(peakActivityMergedBucketLabel([{ label: "Z", activityMerged: 0, sedentarySkipped: 2 }])).toBeNull();
  });

  it("aggregateWindowTotals sums kinds", () => {
    const events: StatEventRecord[] = [
      { kind: "sedentary_triggered", atMs: 1 },
      { kind: "hydration_notified", atMs: 2 },
      { kind: "sedentary_activity_logged", atMs: 3 },
      { kind: "sedentary_skipped", atMs: 4 },
      { kind: "sedentary_completed", atMs: 5 }
    ];
    const t = aggregateWindowTotals(events);
    expect(t.sedentaryTriggered).toBe(1);
    expect(t.hydrationNotified).toBe(1);
    expect(t.proactiveActivity).toBe(1);
    expect(t.skips).toBe(1);
    expect(t.activityMerged).toBe(2);
  });
});
