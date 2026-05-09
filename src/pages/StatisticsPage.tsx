import { Column } from "@ant-design/plots";
import { Card, Segmented, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";
import type { StatsDimension } from "@/utils/statsBuckets";
import { buildDetailBuckets, queryRangeForDimension } from "@/utils/statsBuckets";
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

/** 中文注释：活动统计详情——按日/周/月/年维度展示久坐完成与补水通知次数。 */
export default function StatisticsPage(props: StatisticsPageProps): JSX.Element {
  const { onBack } = props;
  const [dimension, setDimension] = useState<StatsDimension>("week");
  const [loading, setLoading] = useState(true);
  const [chartFlat, setChartFlat] = useState<{ label: string; type: string; value: number }[]>([]);
  const [totals, setTotals] = useState({ sed: 0, hyd: 0 });

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
      let sed = 0;
      let hyd = 0;
      for (const b of buckets) {
        flat.push({ label: b.label, type: "久坐完成", value: b.sedentaryCompleted });
        flat.push({ label: b.label, type: "补水提醒", value: b.hydrationNotified });
        sed += b.sedentaryCompleted;
        hyd += b.hydrationNotified;
      }
      setChartFlat(flat);
      setTotals({ sed, hyd });
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
          range: ["#1677ff", "#52c41a"]
        }
      }
    }),
    [chartFlat]
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <SubSettingsTopBar title="活动统计" onBack={onBack} />
      <Card loading={loading} bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Segmented options={DIM_OPTIONS} value={dimension} onChange={(v) => setDimension(v as StatsDimension)} />
          <Typography.Text type="secondary">
            本维度合计：久坐完成 {totals.sed} 次 · 补水提醒 {totals.hyd} 次（本地统计，未上传）
          </Typography.Text>
          {chartFlat.length > 0 ? <Column {...columnConfig} /> : <Typography.Text type="secondary">暂无数据</Typography.Text>}
        </Space>
      </Card>
    </Space>
  );
}
