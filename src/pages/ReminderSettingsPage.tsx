import { RightOutlined } from "@ant-design/icons";
import { Button, Card, Col, Row, Segmented, Space, Switch, Typography } from "antd";
import StatsBriefCard from "@/components/StatsBriefCard";
import type { ReminderConfig, ThemeModePreference } from "@/types/global";

interface ReminderSettingsPageProps {
  config: ReminderConfig;
  /** 中文注释：久坐下次触发时间戳（毫秒），与 HomePage 调度一致；全屏进行中时父组件可能置空。 */
  nextSedentaryAt: number | null;
  /** 中文注释：补水下次通知时间戳；未启用时为 null。 */
  nextHydrationAt: number | null;
  /** 中文注释：用于倒计时，主界面每秒更新。 */
  nowMs: number;
  /** 中文注释：久坐全屏提醒是否展示中（此时 next 可能被清空，单独展示状态）。 */
  sedentaryFullscreenActive: boolean;
  onChange: (nextConfig: ReminderConfig) => void;
  onOpenSedentary: () => void;
  onOpenHydration: () => void;
  onOpenQuietHours: () => void;
  themeMode: ThemeModePreference;
  onThemeModeChange: (mode: ThemeModePreference) => void;
  statsRefreshKey: number;
  onOpenStats: () => void;
  onOpenAuthorBlurb: () => void;
}

function formatNextTimeLabel(timestamp: number | null): string {
  if (!timestamp) {
    return "未启用";
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

/** 中文注释：按本地时段返回一句简短关怀文案（单行、无换行）。 */
function warmLineForHour(hour: number): string {
  if (hour >= 5 && hour < 8) {
    return "清晨好，今天也请对自己温柔一点。";
  }
  if (hour >= 8 && hour < 11) {
    return "上午加油，专注很酷，偶尔伸个懒腰也很酷。";
  }
  if (hour >= 11 && hour < 13) {
    return "快到午间了，胃和眼睛都等你关照一下。";
  }
  if (hour >= 13 && hour < 15) {
    return "午后容易倦，起身接杯水，你会更清醒。";
  }
  if (hour >= 15 && hour < 18) {
    return "下午坚持得很棒，小动作也能救久坐。";
  }
  if (hour >= 18 && hour < 20) {
    return "傍晚了，收个尾就给自己一点小奖励。";
  }
  if (hour >= 20 && hour < 23) {
    return "夜晚模式：少盯屏一分钟，就多爱自己一分钟。";
  }
  if (hour >= 23 || hour < 1) {
    return "夜深了，让眼睛和心情都慢慢松下来。";
  }
  return "凌晨还在线？记得留一点睡眠给明天的你。";
}

/** 中文注释：将剩余毫秒格式化为可读倒计时。 */
function formatCountdown(remainMs: number): string {
  if (remainMs <= 0) {
    return "即将提醒";
  }
  const totalSec = Math.floor(remainMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad2 = (n: number): string => String(n).padStart(2, "0");
  if (h > 0) {
    return `剩余 ${h}小时${pad2(m)}分${pad2(s)}秒`;
  }
  return `剩余 ${pad2(m)}:${pad2(s)}`;
}

/** 中文注释：主设置枢纽页——关怀标题下内嵌统计、双通道、主题与开机启动、子页入口。 */
export default function ReminderSettingsPage(props: ReminderSettingsPageProps): JSX.Element {
  const {
    config,
    nextSedentaryAt,
    nextHydrationAt,
    nowMs,
    sedentaryFullscreenActive,
    onChange,
    onOpenSedentary,
    onOpenHydration,
    onOpenQuietHours,
    themeMode,
    onThemeModeChange,
    statsRefreshKey,
    onOpenStats,
    onOpenAuthorBlurb
  } = props;

  const sedentaryTimeLabel = sedentaryFullscreenActive
    ? "全屏提醒进行中"
    : !config.enabled
      ? "未启用"
      : formatNextTimeLabel(nextSedentaryAt);

  const sedentaryRemainMs =
    !config.enabled || sedentaryFullscreenActive || nextSedentaryAt === null ? null : nextSedentaryAt - nowMs;

  const sedentaryCountdownLabel =
    sedentaryFullscreenActive || !config.enabled
      ? "—"
      : nextSedentaryAt === null
        ? "—"
        : formatCountdown(sedentaryRemainMs ?? 0);

  const hydrationEnabled = config.hydrationReminderEnabled;
  const hydrationTimeLabel = !hydrationEnabled ? "未启用" : formatNextTimeLabel(nextHydrationAt);
  const hydrationRemainMs =
    !hydrationEnabled || nextHydrationAt === null ? null : nextHydrationAt - nowMs;
  const hydrationCountdownLabel = !hydrationEnabled ? "—" : nextHydrationAt === null ? "—" : formatCountdown(hydrationRemainMs ?? 0);

  const warmLine = warmLineForHour(new Date(nowMs).getHours());

  return (
    <Card
      bordered
      title={
        <Typography.Text
          style={{
            display: "block",
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: 15,
            fontWeight: 500
          }}
        >
          {warmLine}
        </Typography.Text>
      }
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <StatsBriefCard refreshKey={statsRefreshKey} onOpenDetail={onOpenStats} variant="embedded" />

        <div>
          <Typography.Text strong>久坐提醒</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">下次提醒时间：</Typography.Text>
            <Typography.Text> {sedentaryTimeLabel}</Typography.Text>
          </div>
          <div style={{ marginTop: 4 }}>
            <Typography.Text type="secondary">倒计时：</Typography.Text>
            <Typography.Text> {sedentaryCountdownLabel}</Typography.Text>
          </div>
        </div>

        <div>
          <Typography.Text strong>补水提醒</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">下次提醒时间：</Typography.Text>
            <Typography.Text> {hydrationTimeLabel}</Typography.Text>
          </div>
          <div style={{ marginTop: 4 }}>
            <Typography.Text type="secondary">倒计时：</Typography.Text>
            <Typography.Text> {hydrationCountdownLabel}</Typography.Text>
          </div>
        </div>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>开机启动</Typography.Text>
          </Col>
          <Col>
            <Switch checked={config.autoStartEnabled} onChange={(checked) => onChange({ ...config, autoStartEnabled: checked })} />
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Text strong>主题模式</Typography.Text>
          </Col>
          <Col>
            <Segmented
              value={themeMode}
              onChange={(v) => onThemeModeChange(v as ThemeModePreference)}
              options={[
                { label: "浅色", value: "light" },
                { label: "深色", value: "dark" },
                { label: "跟随系统", value: "system" }
              ]}
            />
          </Col>
        </Row>

        <Space direction="vertical" size="small" align="start" style={{ width: "100%" }}>
          <Button type="link" icon={<RightOutlined />} onClick={onOpenSedentary} style={{ padding: 0, height: "auto" }}>
            久坐提醒设置
          </Button>
          <Button type="link" icon={<RightOutlined />} onClick={onOpenHydration} style={{ padding: 0, height: "auto" }}>
            补水提醒设置
          </Button>
          <Button type="link" icon={<RightOutlined />} onClick={onOpenQuietHours} style={{ padding: 0, height: "auto" }}>
            免打扰时段设置
          </Button>
          <Button type="link" icon={<RightOutlined />} onClick={onOpenAuthorBlurb} style={{ padding: 0, height: "auto" }}>
            作者的哔哔赖赖
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
