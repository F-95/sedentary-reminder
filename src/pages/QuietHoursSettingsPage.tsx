import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { App, Button, Card, Col, Collapse, InputNumber, Row, Space, Switch, Tag, Typography } from "antd";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";
import type { QuietHourRange, ReminderConfig } from "@/types/global";
import {
  MAX_QUIET_HOUR_RANGES,
  createNewQuietHourRange,
  formatQuietHourRangeLabel,
  hourMinuteToMinutes,
  minutesToHourMinute,
  sanitizeQuietHourRange
} from "@/utils/quietHours";

interface QuietHoursSettingsPageProps {
  config: ReminderConfig;
  onChange: (nextConfig: ReminderConfig) => void;
  onBack: () => void;
}

/** 中文注释：固定宽度，避免 InputNumber 在 flex 布局下被拉满导致溢出卡片。 */
const QUIET_HOUR_INPUT_NUMBER_STYLE: CSSProperties = { width: 96, maxWidth: 96, minWidth: 96 };

export default function QuietHoursSettingsPage(props: QuietHoursSettingsPageProps): JSX.Element {
  const { message } = App.useApp();
  const { config, onChange, onBack } = props;

  /** 中文注释：受控折叠；默认全部折叠，新增时段时仅展开新段（第四版）。 */
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    const ids = new Set(config.quietHours.map((q) => q.id));
    setActiveKeys((prev) => prev.filter((id) => ids.has(id)));
  }, [config.quietHours]);

  const patchQuietHourAt = (index: number, patch: Partial<QuietHourRange>): void => {
    const next = config.quietHours.map((q, i) => (i === index ? sanitizeQuietHourRange({ ...q, ...patch }) : q));
    onChange({ ...config, quietHours: next });
  };

  const removeQuietHourAt = (index: number): void => {
    const removed = config.quietHours[index];
    onChange({
      ...config,
      quietHours: config.quietHours.filter((_, i) => i !== index)
    });
    if (removed) {
      setActiveKeys((prev) => prev.filter((k) => k !== removed.id));
    }
  };

  const addQuietHour = (): void => {
    if (config.quietHours.length >= MAX_QUIET_HOUR_RANGES) {
      message.warning(`免打扰时段已达到上限（${MAX_QUIET_HOUR_RANGES} 段），请先删除或合并后再新增。`);
      return;
    }
    const created = createNewQuietHourRange();
    onChange({
      ...config,
      quietHours: [...config.quietHours, created]
    });
    setActiveKeys([created.id]);
  };

  return (
    <>
      <SubSettingsTopBar title="免打扰时段" onBack={onBack} />
      <Card bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          支持跨午夜：若结束时刻早于开始时刻，表示从当日开始至次日结束（左闭右开）；否则为同日内时段。进行中的提醒倒计时不会因进入免打扰而中断。
        </Typography.Paragraph>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>启用免打扰</Typography.Text>
          </Col>
          <Col>
            <Switch
              checked={config.quietHoursEnabled}
              onChange={(checked) => onChange({ ...config, quietHoursEnabled: checked })}
            />
          </Col>
        </Row>

        {config.quietHours.length > 0 ? (
          <Collapse
            bordered={false}
            style={{ background: "transparent" }}
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            items={config.quietHours.map((q, index) => {
              const startHm = minutesToHourMinute(q.startMinutes);
              const endHm = minutesToHourMinute(q.endMinutes);
              const rangeLabel = formatQuietHourRangeLabel(q.startMinutes, q.endMinutes);
              return {
                key: q.id,
                label: (
                  <Row justify="space-between" align="middle" wrap={false} style={{ width: "100%" }} gutter={8}>
                    <Col flex="auto" style={{ minWidth: 0 }}>
                      <Space size={8} wrap>
                        <Typography.Text strong>{`时段 ${index + 1}`}</Typography.Text>
                        <Typography.Text type="secondary">{rangeLabel}</Typography.Text>
                        {!q.enabled ? <Tag>已关闭</Tag> : null}
                      </Space>
                    </Col>
                  </Row>
                ),
                children: (
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Row justify="space-between" align="middle" gutter={[8, 8]}>
                      <Col>
                        <Space>
                          <Typography.Text>启用</Typography.Text>
                          <Switch
                            checked={q.enabled}
                            onChange={(checked) => patchQuietHourAt(index, { enabled: checked })}
                          />
                        </Space>
                      </Col>
                      <Col>
                        <Button danger type="link" onClick={() => removeQuietHourAt(index)}>
                          删除
                        </Button>
                      </Col>
                    </Row>

                    <Typography.Text type="secondary">开始（本地时间）</Typography.Text>
                    <Row gutter={[8, 8]} align="middle" wrap={false}>
                      <Col flex="none">
                        <InputNumber
                          controls={false}
                          style={QUIET_HOUR_INPUT_NUMBER_STYLE}
                          min={0}
                          max={23}
                          addonBefore="时"
                          value={startHm.hour}
                          onChange={(v) =>
                            patchQuietHourAt(index, {
                              startMinutes: hourMinuteToMinutes(v ?? 0, startHm.minute)
                            })
                          }
                        />
                      </Col>
                      <Col flex="none">
                        <InputNumber
                          controls={false}
                          style={QUIET_HOUR_INPUT_NUMBER_STYLE}
                          min={0}
                          max={59}
                          addonBefore="分"
                          value={startHm.minute}
                          onChange={(v) =>
                            patchQuietHourAt(index, {
                              startMinutes: hourMinuteToMinutes(startHm.hour, v ?? 0)
                            })
                          }
                        />
                      </Col>
                    </Row>

                    <Typography.Text type="secondary">
                      结束（同日须晚于开始；跨午夜时结束在次日，可早于开始的数字；左闭右开不包含结束整点）
                    </Typography.Text>
                    <Row gutter={[8, 8]} align="middle" wrap={false}>
                      <Col flex="none">
                        <InputNumber
                          controls={false}
                          style={QUIET_HOUR_INPUT_NUMBER_STYLE}
                          min={0}
                          max={23}
                          addonBefore="时"
                          value={endHm.hour}
                          onChange={(v) =>
                            patchQuietHourAt(index, {
                              endMinutes: hourMinuteToMinutes(v ?? 0, endHm.minute)
                            })
                          }
                        />
                      </Col>
                      <Col flex="none">
                        <InputNumber
                          controls={false}
                          style={QUIET_HOUR_INPUT_NUMBER_STYLE}
                          min={0}
                          max={59}
                          addonBefore="分"
                          value={endHm.minute}
                          onChange={(v) =>
                            patchQuietHourAt(index, {
                              endMinutes: hourMinuteToMinutes(endHm.hour, v ?? 0)
                            })
                          }
                        />
                      </Col>
                    </Row>
                  </Space>
                )
              };
            })}
          />
        ) : null}

        <Button type="dashed" onClick={addQuietHour} block>
          新增时段（最多 {MAX_QUIET_HOUR_RANGES} 段）
        </Button>
        </Space>
      </Card>
    </>
  );
}
