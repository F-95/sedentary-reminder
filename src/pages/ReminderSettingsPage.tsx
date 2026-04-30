import { Card, Col, Form, Input, InputNumber, Row, Space, Switch, Tag, Typography } from "antd";
import type { ReminderConfig, ReminderRule } from "@/types/global";

interface ReminderSettingsPageProps {
  config: ReminderConfig;
  nextTriggerLabel: string;
  onChange: (nextConfig: ReminderConfig) => void;
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

export default function ReminderSettingsPage(props: ReminderSettingsPageProps): JSX.Element {
  const { config, nextTriggerLabel, onChange } = props;
  const rule = config.rules[0] ?? createFallbackRule();

  const handleRuleChange = (patch: Partial<ReminderRule>): void => {
    onChange({
      ...config,
      rules: [updateRule(rule, patch)]
    });
  };

  return (
    <Card
      title={
        <Tag
          color="blue"
          style={{ fontSize: 16, padding: "6px 12px", fontWeight: 600, borderRadius: 8 }}
        >
          下次提醒时间：{nextTriggerLabel}
        </Tag>
      }
      bordered
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>开机自启</Typography.Text>
          </Col>
          <Col>
            <Switch checked={config.autoStartEnabled} onChange={(checked) => onChange({ ...config, autoStartEnabled: checked })} />
          </Col>
        </Row>

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

          <Form.Item label={<Typography.Text strong>提醒文案</Typography.Text>}>
            <Space direction="vertical" style={{ width: "100%" }}>
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
  );
}
