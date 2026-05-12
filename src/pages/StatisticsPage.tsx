import { Column } from "@ant-design/plots";
import { Card, Segmented, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";
import type { StatsDimension, WindowTotals } from "@/utils/statsBuckets";
import {
  aggregateWindowTotals,
  buildDetailBuckets,
  peakActivityMergedBucketLabel,
  queryRangeForDimension
} from "@/utils/statsBuckets";
import { buildEmotionalStatsBrief } from "@/utils/statsEmotionalBrief";
import { queryStatEvents } from "@/utils/tauri";

export interface StatisticsPageProps {
  onBack: () => void;
}

const DIM_OPTIONS: { label: string; value: StatsDimension }[] = [
  { label: "日", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" },
  { label: "年", value: "year" }
];

const EMPTY_TOTALS: WindowTotals = {
  sedentaryTriggered: 0,
  hydrationNotified: 0,
  proactiveActivity: 0,
  skips: 0,
  activityMerged: 0
};

/** 中文注释：活动统计详情——按日/周/月/年展示活动合并与跳过堆叠图、四类合计与情绪简报。 */
export default function StatisticsPage(props: StatisticsPageProps): JSX.Element {
  const { onBack } = props;
  const [dimension, setDimension] = useState<StatsDimension>("week");
  const [loading, setLoading] = useState(true);
  const [chartFlat, setChartFlat] = useState<{ label: string; type: string; value: number }[]>([]);
  const [windowTotals, setWindowTotals] = useState<WindowTotals>(EMPTY_TOTALS);
  const [briefText, setBriefText] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const now = Date.now();
      const { fromMs, toMs } = queryRangeForDimension(dimension, now);
      const events = await queryStatEvents(fromMs, toMs);
      if (cancelled) {
        return;
      }
      const buckets = buildDetailBuckets(events, dimension, now);
      const flat: { label: string; type: string; value: number }[] = [];
      for (const b of buckets) {
        flat.push({ label: b.label, type: "活动次数", value: b.activityMerged });
        flat.push({ label: b.label, type: "未活动次数", value: b.sedentarySkipped });
      }
      const totals = aggregateWindowTotals(events);
      const peakLabel = peakActivityMergedBucketLabel(buckets);
      setChartFlat(flat);
      setWindowTotals(totals);
      setBriefText(buildEmotionalStatsBrief(dimension, totals, peakLabel));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dimension]);

  const columnConfig = useMemo(
    () => ({
      data: chartFlat,
      xField: "label",
      yField: "value",
      seriesField: "type",
      isStack: true,
      height: 280,
      legend: { position: "top" as const },
      colorField: "type",
      scale: {
        color: {
          range: ["#1677ff", "#d46b08"]
        }
      }
    }),
    [chartFlat]
  );

  const { sedentaryTriggered, hydrationNotified, proactiveActivity, skips } = windowTotals;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <SubSettingsTopBar title="活动统计" onBack={onBack} />
      <Card loading={loading} bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Segmented options={DIM_OPTIONS} value={dimension} onChange={(v) => setDimension(v as StatsDimension)} />
          <Typography.Text type="secondary">
            本维度合计：久坐提醒 {sedentaryTriggered} 次 · 补水提醒 {hydrationNotified} 次 · 主动活动 {proactiveActivity}{" "}
            次 · 跳过久坐提醒 {skips} 次
          </Typography.Text>
          {chartFlat.length > 0 ? <Column {...columnConfig} /> : <Typography.Text type="secondary">暂无数据</Typography.Text>}
          {briefText ? (
            <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
              {briefText}
            </Typography.Paragraph>
          ) : null}
        </Space>
      </Card>
    </Space>
  );
}
