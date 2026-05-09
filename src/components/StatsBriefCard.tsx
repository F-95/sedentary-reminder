import { Column } from "@ant-design/plots";
import { Card, Spin, Typography, theme } from "antd";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { queryStatEvents } from "@/utils/tauri";
import {
  briefLast7DaysSedentaryCounts,
  countSedentaryCompletedThisCalendarWeek,
  countSedentaryCompletedToday
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
  const [chartRows, setChartRows] = useState<{ day: string; count: number }[]>([]);
  const [todayN, setTodayN] = useState(0);
  const [weekN, setWeekN] = useState(0);

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
      const brief = briefLast7DaysSedentaryCounts(events, now);
      setChartRows(brief.map((b) => ({ day: b.label, count: b.count })));
      setTodayN(countSedentaryCompletedToday(events, now));
      setWeekN(countSedentaryCompletedThisCalendarWeek(events, now));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const columnConfig = useMemo(
    () => ({
      data: chartRows,
      xField: "day",
      yField: "count",
      height: CHART_HEIGHT,
      padding: [6, 6, 16, 6] as [number, number, number, number],
      axis: false as const,
      tooltip: { showMarkers: false },
      style: { maxWidth: 12 }
    }),
    [chartRows]
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
        今日完成 {todayN} 次 · 本周 {weekN} 次
      </Typography.Text>
      <div style={{ height: CHART_HEIGHT, overflow: "hidden", marginTop: 6 }}>
        {chartRows.length > 0 ? <Column {...columnConfig} /> : null}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        近 7 日久坐完成次数；点击查看详情
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
