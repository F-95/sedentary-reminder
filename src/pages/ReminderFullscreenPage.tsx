import { useEffect } from "react";
import { Button, Card, Space, Statistic, Typography } from "antd";

export interface ReminderFullscreenPageProps {
  visible: boolean;
  title: string;
  reminderText: string;
  backgroundUrl: string;
  isCounting: boolean;
  remainSeconds: number;
  /** 当前活动时长（分钟），用于按钮文案 */
  durationMinutes: number;
  anchorX: number | null;
  anchorY: number | null;
  onStartActivity: () => void;
}

export default function ReminderFullscreenPage(props: ReminderFullscreenPageProps): JSX.Element | null {
  const { visible, title, reminderText, backgroundUrl, isCounting, remainSeconds, durationMinutes, anchorX, anchorY, onStartActivity } =
    props;

  /** 中文注释：第十版——全屏层拦截 WebView 默认右键菜单（返回/刷新等）。 */
  useEffect(() => {
    if (!visible) {
      return;
    }
    const block = (e: Event): void => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", block, true);
    return () => document.removeEventListener("contextmenu", block, true);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        background: backgroundUrl
          ? `linear-gradient(rgba(0, 0, 0, 0.52), rgba(0, 0, 0, 0.52)), url("${backgroundUrl}") center / cover`
          : "linear-gradient(120deg, #0f172a 0%, #1d4ed8 45%, #0ea5e9 100%)"
      }}
    >
      <Card
        style={{
          width: "min(760px, 92vw)",
          borderRadius: 16,
          position: "absolute",
          left: anchorX ?? "50%",
          top: anchorY ?? "50%",
          transform: "translate(-50%, -50%)"
        }}
        bodyStyle={{ padding: 32, textAlign: "center" }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Paragraph style={{ margin: 0, fontSize: 18 }}>{reminderText}</Typography.Paragraph>
          {isCounting ? (
            <Statistic
              title="活动倒计时（秒）"
              value={remainSeconds}
              valueStyle={{ fontSize: 52, color: remainSeconds <= 10 ? "#cf1322" : "#1677ff" }}
            />
          ) : (
            <Button size="large" type="primary" onClick={onStartActivity}>
              开始活动（{durationMinutes}分钟）
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
