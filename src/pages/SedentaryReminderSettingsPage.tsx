import { Card, Col, Form, Input, InputNumber, Row, Space, Switch, Typography } from "antd";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";
import type { ReminderConfig, ReminderRule } from "@/types/global";

interface SedentaryReminderSettingsPageProps {
  config: ReminderConfig;
  onChange: (nextConfig: ReminderConfig) => void;
  onBack: () => void;
}

function createFallbackRule(): ReminderRule {
  return {
    id: "fallback-rule",
    enabled: true,
    intervalMinutes: 60
  };
}

function updateRule(rule: ReminderRule, patch: Partial<ReminderRule>): ReminderRule {
  return { ...rule, ...patch };
}

/** 中文注释：久坐全屏提醒独立设置页，与补水/免打扰页同构（第五版）。 */
export default function SedentaryReminderSettingsPage(props: SedentaryReminderSettingsPageProps): JSX.Element {
  const { config, onChange, onBack } = props;
  const rule = config.rules[0] ?? createFallbackRule();

  const handleRuleChange = (patch: Partial<ReminderRule>): void => {
    onChange({
      ...config,
      rules: [updateRule(rule, patch)]
    });
  };

  return (
    <>
      <SubSettingsTopBar title="久坐提醒" onBack={onBack} />
      <Card bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          到达间隔后弹出全屏提醒；开机启动请在主界面设置。进行中的提醒倒计时不会因进入免打扰而中断。
        </Typography.Paragraph>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>启用提醒</Typography.Text>
          </Col>
          <Col>
            <Switch checked={config.enabled} onChange={(checked) => onChange({ ...config, enabled: checked })} />
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>提醒结束后锁屏</Typography.Text>
          </Col>
          <Col>
            <Switch
              checked={config.lockOnReminderFinishEnabled}
              onChange={(checked) => onChange({ ...config, lockOnReminderFinishEnabled: checked })}
            />
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col flex="1 1 auto" style={{ minWidth: 0 }}>
            <Typography.Text strong>解锁视为记录活动</Typography.Text>
          </Col>
          <Col flex="none">
            <Switch
              checked={config.logActivityOnSessionUnlockEnabled}
              onChange={(checked) => onChange({ ...config, logActivityOnSessionUnlockEnabled: checked })}
            />
          </Col>
        </Row>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}>
          开启后，系统从锁屏解锁时自动按「记录活动」重排下次久坐（全屏提醒进行中不会触发）。
        </Typography.Paragraph>

        <Form layout="vertical">
          <Form.Item label={<Typography.Text strong>提醒间隔（分钟，最低1）</Typography.Text>}>
            <InputNumber
              min={1}
              max={360}
              value={rule.intervalMinutes}
              style={{ width: "100%", maxWidth: 320 }}
              onChange={(value) => handleRuleChange({ intervalMinutes: value ?? 60 })}
            />
          </Form.Item>

          <Form.Item label={<Typography.Text strong>活动倒计时（分钟，1-10）</Typography.Text>}>
            <InputNumber
              min={1}
              max={10}
              value={config.reminderDurationMinutes}
              style={{ width: "100%", maxWidth: 320 }}
              onChange={(value) => onChange({ ...config, reminderDurationMinutes: value ?? 2 })}
            />
          </Form.Item>

          <Form.Item label={<Typography.Text strong>提醒文案</Typography.Text>} style={{ marginBottom: 0 }}>
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              <Switch
                checked={config.randomTextEnabled}
                checkedChildren="开启随机"
                unCheckedChildren="固定第一条"
                onChange={(checked) => onChange({ ...config, randomTextEnabled: checked })}
              />
              <Input.TextArea
                rows={4}
                placeholder="每行一条文案"
                value={config.texts.join("\n")}
                onChange={(event) =>
                  onChange({
                    ...config,
                    texts: event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  })
                }
              />
            </Space>
          </Form.Item>
        </Form>
        </Space>
      </Card>
    </>
  );
}
