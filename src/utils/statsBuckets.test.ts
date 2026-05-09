import { describe, expect, it } from "vitest";
import type { StatEventRecord } from "@/types/global";
import {
  briefLast7DaysSedentaryCounts,
  buildDetailBuckets,
  countSedentaryCompletedToday,
  queryRangeForDimension
} from "@/utils/statsBuckets";

describe("statsBuckets", () => {
  it("countSedentaryCompletedToday filters by local day", () => {
    const start = new Date(2026, 4, 9, 10, 0, 0, 0).getTime();
    const events: StatEventRecord[] = [
      { kind: "sedentary_completed", atMs: start },
      { kind: "sedentary_completed", atMs: start - 86400000 }
    ];
    expect(countSedentaryCompletedToday(events, start + 3600000)).toBe(1);
  });

  it("briefLast7DaysSedentaryCounts returns 7 buckets", () => {
    const now = new Date(2026, 4, 9, 12, 0, 0, 0).getTime();
    const events: StatEventRecord[] = [];
    const brief = briefLast7DaysSedentaryCounts(events, now);
    expect(brief).toHaveLength(7);
  });

  it("queryRangeForDimension day starts at local midnight", () => {
    const now = new Date(2026, 4, 9, 15, 30, 0, 0).getTime();
    const { fromMs, toMs } = queryRangeForDimension("day", now);
    expect(toMs).toBe(now);
    const d = new Date(fromMs);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("buildDetailBuckets day has 24 hours", () => {
    const now = new Date(2026, 4, 9, 12, 0, 0, 0).getTime();
    const buckets = buildDetailBuckets([], "day", now);
    expect(buckets).toHaveLength(24);
  });
});
