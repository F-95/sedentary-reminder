import { Card, Col, InputNumber, Row, Space, Switch, Typography } from "antd";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";
import type { ReminderConfig } from "@/types/global";

interface HydrationSettingsPageProps {
  config: ReminderConfig;
  onChange: (nextConfig: ReminderConfig) => void;
  onBack: () => void;
}

/** 中文注释：补水提醒独立设置页，布局与免打扰设置页同构（第四版）。 */
export default function HydrationSettingsPage(props: HydrationSettingsPageProps): JSX.Element {
  const { config, onChange, onBack } = props;

  return (
    <>
      <SubSettingsTopBar title="补水提醒" onBack={onBack} />
      <Card bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          仅通过系统通知（Notification）提醒喝水，不弹出全屏；启用免打扰且当前在免打扰时段内时不发送。
        </Typography.Paragraph>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>启用补水提醒</Typography.Text>
          </Col>
          <Col>
            <Switch
              checked={config.hydrationReminderEnabled}
              onChange={(checked) => onChange({ ...config, hydrationReminderEnabled: checked })}
            />
          </Col>
        </Row>

        <div>
          <Typography.Text type="secondary">提醒间隔（分钟，1–360）</Typography.Text>
          <InputNumber
            min={1}
            max={360}
            value={config.hydrationIntervalMinutes}
            disabled={!config.hydrationReminderEnabled}
            style={{ width: "100%", maxWidth: 320, display: "block", marginTop: 8 }}
            onChange={(value) => onChange({ ...config, hydrationIntervalMinutes: value ?? 60 })}
          />
        </div>
        </Space>
      </Card>
    </>
  );
}
