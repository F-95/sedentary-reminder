import { Column } from "@ant-design/plots";
import { Card, Spin, Typography, theme } from "antd";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { queryStatEvents } from "@/utils/tauri";
import {
  briefLast7DaysActivityStacks,
  countActivityMergedThisCalendarWeek,
  countActivityMergedToday,
  countSkipsThisCalendarWeek,
  countSkipsToday
} from "@/utils/statsBuckets";

const CHART_HEIGHT = 88;

export interface StatsBriefCardProps {
  /** 中文注释：父级递增以触发重新拉取统计。 */
  refreshKey: number;
  onOpenDetail: () => void;
  /** 中文注释：embedded=嵌入主 Card 正文顶；standalone=独立小卡片（预留）。 */
  variant?: "embedded" | "standalone";
}

/** 中文注释：枢纽活动统计简报，可嵌入主 Card 或独立展示。 */
export default function StatsBriefCard(props: StatsBriefCardProps): JSX.Element {
  const { refreshKey, onOpenDetail, variant = "embedded" } = props;
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [chartFlat, setChartFlat] = useState<{ label: string; type: string; value: number }[]>([]);
  const [todayActivity, setTodayActivity] = useState(0);
  const [todaySkip, setTodaySkip] = useState(0);
  const [weekActivity, setWeekActivity] = useState(0);
  const [weekSkip, setWeekSkip] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const now = Date.now();
      const fromMs = now - 10 * 86400000;
      const events = await queryStatEvents(fromMs, now);
      if (cancelled) {
        return;
      }
      const stacks = briefLast7DaysActivityStacks(events, now);
      const flat: { label: string; type: string; value: number }[] = [];
      for (const b of stacks) {
        flat.push({ label: b.label, type: "活动次数", value: b.activityMerged });
        flat.push({ label: b.label, type: "未活动次数", value: b.sedentarySkipped });
      }
      setChartFlat(flat);
      setTodayActivity(countActivityMergedToday(events, now));
      setTodaySkip(countSkipsToday(events, now));
      setWeekActivity(countActivityMergedThisCalendarWeek(events, now));
      setWeekSkip(countSkipsThisCalendarWeek(events, now));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const columnConfig = useMemo(
    () => ({
      data: chartFlat,
      xField: "label",
      yField: "value",
      seriesField: "type",
      isStack: true,
      height: CHART_HEIGHT,
      padding: [6, 6, 16, 6] as [number, number, number, number],
      axis: false as const,
      legend: false as const,
      colorField: "type",
      tooltip: { showMarkers: false },
      scale: {
        color: {
          range: ["#1677ff", "#d46b08"]
        }
      }
    }),
    [chartFlat]
  );

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetail();
    }
  };

  const content = (
    <>
      <Typography.Text strong>活动统计</Typography.Text>
      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
        今日活动（完成+记录）{todayActivity} 次 · 今日跳过 {todaySkip} 次 · 本周活动 {weekActivity} 次 · 本周跳过 {weekSkip} 次
      </Typography.Text>
      <div style={{ height: CHART_HEIGHT, overflow: "hidden", marginTop: 6 }}>
        {chartFlat.length > 0 ? <Column {...columnConfig} /> : null}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        近 7 日活动次数与未活动（跳过）次数；点击查看详情
      </Typography.Text>
    </>
  );

  if (variant === "standalone") {
    return (
      <Card
        size="small"
        loading={loading}
        bodyStyle={{ padding: "8px 12px", overflow: "hidden" }}
        style={{ cursor: "pointer" }}
        onClick={onOpenDetail}
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {content}
      </Card>
    );
  }

  return (
    <Spin spinning={loading}>
      <div
        style={{
          paddingBottom: 10,
          marginBottom: 4,
          borderBottom: `1px solid ${token.colorSplit}`,
          cursor: "pointer"
        }}
        onClick={onOpenDetail}
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {content}
      </div>
    </Spin>
  );
}
