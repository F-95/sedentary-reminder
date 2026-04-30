import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Button, Checkbox, Modal, Space, message } from "antd";
import type { CloseBehaviorPreference, ReminderConfig, ReminderRule, TrayFieldTogglePayload, TrayToggleField } from "@/types/global";
import ReminderFullscreenPage from "@/pages/ReminderFullscreenPage";
import ReminderSettingsPage from "@/pages/ReminderSettingsPage";
import {
  CLOSE_BEHAVIOR_STORAGE_KEY,
  EVENT_MAIN_CLOSE_REQUESTED,
  EVENT_TRAY_FIELD_TOGGLE,
  exitApp,
  finishActivityAndLock,
  getReminderRuntime,
  listDefaultSlogans,
  setAutoStartEnabled,
  setReminderWindowMode,
  startReminderSession,
  syncTrayMenu,
  updateNextTrigger
} from "@/utils/tauri";

const REMINDER_CONFIG_KEY = "reminder-config-v1";
const LAST_MINUTE_NOTIFICATION_MS = 60_000;
const DEFAULT_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_ef8b7f0d9e.mp3";

function clampReminderDurationMinutes(minutes: number): number {
  return Math.min(10, Math.max(1, Math.round(minutes)));
}

function reminderDurationSeconds(config: ReminderConfig): number {
  return config.reminderDurationMinutes * 60;
}

function createDefaultRule(): ReminderRule {
  return {
    id: "default-rule",
    enabled: true,
    intervalMinutes: 60
  };
}

function clampIntervalMinutes(minutes: number): number {
  return Math.min(360, Math.max(1, Math.round(minutes)));
}

function normalizeRule(raw: unknown, index: number): ReminderRule {
  if (!raw || typeof raw !== "object") {
    return { ...createDefaultRule(), id: `rule-${index}` };
  }
  const o = raw as Record<string, unknown>;
  const interval =
    typeof o.intervalMinutes === "number" && Number.isFinite(o.intervalMinutes) ? o.intervalMinutes : 60;
  return {
    id: typeof o.id === "string" ? o.id : `rule-${index}`,
    enabled: o.enabled !== false,
    intervalMinutes: clampIntervalMinutes(interval)
  };
}

/** 兼容旧版 localStorage（曾含 cycleType 等字段），统一迁移为仅间隔模式 */
function migrateReminderConfig(raw: unknown): ReminderConfig {
  const defaults = createDefaultConfig();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  const o = raw as Record<string, unknown>;
  const rulesRaw = o.rules;
  const rules: ReminderRule[] = Array.isArray(rulesRaw) ? rulesRaw.map((r, i) => normalizeRule(r, i)) : defaults.rules;
  const textsRaw = o.texts;
  const migratedTexts = Array.isArray(textsRaw) ? textsRaw.filter((t): t is string => typeof t === "string") : defaults.texts;
  // 中文注释：移除旧版本的固定文案（“久坐提醒：请立即起身活动2分钟。”），防止被覆盖展示。
  const filteredTexts = migratedTexts.filter((t) => t !== "久坐提醒：请立即起身活动2分钟。");
  return {
    enabled: Boolean(o.enabled),
    rules: rules.length ? rules : defaults.rules,
    autoStartEnabled: typeof o.autoStartEnabled === "boolean" ? o.autoStartEnabled : defaults.autoStartEnabled,
    lockOnReminderFinishEnabled:
      typeof o.lockOnReminderFinishEnabled === "boolean" ? o.lockOnReminderFinishEnabled : defaults.lockOnReminderFinishEnabled,
    reminderDurationMinutes:
      typeof o.reminderDurationMinutes === "number"
        ? clampReminderDurationMinutes(o.reminderDurationMinutes)
        : defaults.reminderDurationMinutes,
    randomTextEnabled: o.randomTextEnabled !== false,
    texts: filteredTexts.length ? filteredTexts : defaults.texts
  };
}

function createDefaultConfig(): ReminderConfig {
  return {
    enabled: false,
    rules: [createDefaultRule()],
    autoStartEnabled: false,
    lockOnReminderFinishEnabled: true,
    reminderDurationMinutes: 2,
    randomTextEnabled: true,
    texts: ["该起来活动了，请保护你的肩颈和眼睛。", "走动一下，喝口水，再回来继续高效工作。", "久坐提醒：请立即起身活动。"]
  };
}

function getNextFromRule(rule: ReminderRule, nowMs: number): number | null {
  if (!rule.enabled) {
    return null;
  }
  return nowMs + rule.intervalMinutes * 60_000;
}

function pickRandomText(texts: string[]): string {
  if (!texts.length) {
    return "该活动了，请准备活动并做好准备。";
  }
  const index = Math.floor(Math.random() * texts.length);
  return texts[index] ?? "该活动了，请准备活动并做好准备。";
}

function formatNextLabel(timestamp: number | null): string {
  if (!timestamp) {
    return "未启用";
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

/** 中文注释：「提前 1 分钟」使用操作系统原生通知（Windows Toast 等），不在应用窗口内展示。 */
async function notifyOneMinuteBeforeReminder(): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (!granted) {
      return;
    }
    await sendNotification({
      title: "久坐提醒",
      body: "距离下次提醒还有1分钟，请提前活动并做好准备。"
    });
  } catch {
    // 中文注释：非 Tauri 环境或通知插件不可用时静默跳过，避免打断定时逻辑。
  }
}

function isTrayToggleField(value: string): value is TrayToggleField {
  return value === "autoStart" || value === "enabled" || value === "lockOnFinish";
}

/** 中文注释：读取主窗口关闭后的行为偏好（未设置则每次询问）。 */
function readCloseBehaviorPreference(): CloseBehaviorPreference {
  const raw = localStorage.getItem(CLOSE_BEHAVIOR_STORAGE_KEY);
  if (raw === "tray" || raw === "exit" || raw === "ask") {
    return raw;
  }
  return "ask";
}

export default function HomePage(): JSX.Element {
  const [api, contextHolder] = message.useMessage();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [config, setConfig] = useState<ReminderConfig>(() => {
    const raw = localStorage.getItem(REMINDER_CONFIG_KEY);
    if (!raw) {
      return createDefaultConfig();
    }
    try {
      return migrateReminderConfig(JSON.parse(raw));
    } catch {
      return createDefaultConfig();
    }
  });
  const [nextTriggerAt, setNextTriggerAt] = useState<number | null>(null);
  const [reminderVisible, setReminderVisible] = useState<boolean>(false);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [remainSeconds, setRemainSeconds] = useState<number>(reminderDurationSeconds(createDefaultConfig()));
  const [currentText, setCurrentText] = useState<string>("");
  const [cardAnchor, setCardAnchor] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const sessionIdRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triggerInFlightRef = useRef<boolean>(false);
  const lastMinuteNotifiedForTriggerAtRef = useRef<number | null>(null);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [rememberCloseChoice, setRememberCloseChoice] = useState(false);

  useEffect(() => {
    localStorage.setItem(REMINDER_CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  // 中文注释：与系统托盘勾选状态对齐（配置仅存于前端 localStorage）。
  useEffect(() => {
    void syncTrayMenu(config.autoStartEnabled, config.enabled, config.lockOnReminderFinishEnabled).catch(() => {
      // 中文注释：托盘尚未创建或权限不足时静默失败，避免打断主流程。
    });
  }, [config.autoStartEnabled, config.enabled, config.lockOnReminderFinishEnabled]);

  // 中文注释：订阅托盘菜单与主窗口关闭事件（仅 Tauri 环境有效）。
  useEffect(() => {
    let cancelled = false;
    let unlistenTray: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    void (async () => {
      try {
        unlistenTray = await listen<TrayFieldTogglePayload>(EVENT_TRAY_FIELD_TOGGLE, (event) => {
          const field = event.payload.field;
          if (!isTrayToggleField(field)) {
            return;
          }
          setConfig((prev) => {
            if (field === "autoStart") {
              return { ...prev, autoStartEnabled: !prev.autoStartEnabled };
            }
            if (field === "enabled") {
              return { ...prev, enabled: !prev.enabled };
            }
            return { ...prev, lockOnReminderFinishEnabled: !prev.lockOnReminderFinishEnabled };
          });
        });
        if (cancelled) {
          unlistenTray();
          return;
        }

        unlistenClose = await listen(EVENT_MAIN_CLOSE_REQUESTED, () => {
          const behavior = readCloseBehaviorPreference();
          if (behavior === "tray") {
            void getCurrentWindow()
              .hide()
              .catch((error: unknown) => {
                apiRef.current.error(`隐藏到托盘失败：${String(error)}`);
              });
            return;
          }
          if (behavior === "exit") {
            void exitApp().catch((error: unknown) => {
              apiRef.current.error(`退出失败：${String(error)}`);
            });
            return;
          }
          setRememberCloseChoice(false);
          setClosePromptOpen(true);
        });
        if (cancelled) {
          unlistenTray();
          unlistenClose();
        }
      } catch {
        // 中文注释：非 Tauri 或权限不足时忽略。
      }
    })();

    return () => {
      cancelled = true;
      unlistenTray?.();
      unlistenClose?.();
    };
    // 中文注释：仅在挂载时注册全局监听；message 实例取首次闭包即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void setAutoStartEnabled(config.autoStartEnabled).catch((error) => {
      api.error(`开机自启设置失败：${String(error)}`);
    });
  }, [api, config.autoStartEnabled]);

  useEffect(() => {
    // 配合 “剩余1分钟” 的通知：只对同一个 nextTriggerAt 发送一次。
    lastMinuteNotifiedForTriggerAtRef.current = null;
  }, [nextTriggerAt, reminderVisible]);

  useEffect(() => {
    // 中文注释：首次挂载时尝试获取后端默认文案，增强初始化体验。
    void listDefaultSlogans()
      .then((texts) => {
        if (texts.length && config.texts.length <= 3) {
          setConfig((prev) => ({ ...prev, texts }));
        }
      })
      .catch(() => {
        // 中文注释：忽略默认文案加载失败，保持本地兜底文案可用。
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextTriggerLabel = useMemo(() => formatNextLabel(nextTriggerAt), [nextTriggerAt]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!config.enabled || reminderVisible) {
      setNextTriggerAt(null);
      void updateNextTrigger(null);
      return;
    }

    const candidateTimes = config.rules.map((rule) => getNextFromRule(rule, Date.now())).filter((item): item is number => !!item);
    const next = candidateTimes.length ? Math.min(...candidateTimes) : null;
    setNextTriggerAt(next);
    void updateNextTrigger(next);

    if (!next) {
      return;
    }
    const waitMs = Math.max(500, next - Date.now());
    timerRef.current = window.setTimeout(() => {
      void triggerReminder();
    }, waitMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, reminderVisible]);

  const stopAudio = (): void => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const triggerReminder = async (): Promise<void> => {
    if (triggerInFlightRef.current || reminderVisible) {
      return;
    }
    triggerInFlightRef.current = true;
    sessionIdRef.current = `session-${Date.now()}`;
    const selectedText = config.randomTextEnabled ? pickRandomText(config.texts) : config.texts[0] ?? "该活动了，请准备活动并做好准备。";
    setCurrentText(selectedText);
    setReminderVisible(true);
    setIsCounting(false);
    setRemainSeconds(reminderDurationSeconds(config));

    try {
      await setReminderWindowMode(true);
      const runtime = await getReminderRuntime();
      setCardAnchor({ x: runtime.primaryCenterX, y: runtime.primaryCenterY });
    } catch (error) {
      api.error(`提醒窗口切换失败：${String(error)}`);
      setReminderVisible(false);
      triggerInFlightRef.current = false;
      return;
    }

    const audioSrc = DEFAULT_SOUND_URL;
    try {
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audioRef.current = audio;
      await audio.play();
    } catch {
      api.warning("铃声播放失败，请检查自定义铃声地址。");
    }
    triggerInFlightRef.current = false;
  };

  const handleStartActivity = async (): Promise<void> => {
    if (!sessionIdRef.current) {
      return;
    }
    try {
      await startReminderSession(sessionIdRef.current);
      setIsCounting(true);
      stopAudio();
    } catch (error) {
      api.error(`开始活动失败：${String(error)}`);
    }
  };

  useEffect(() => {
    if (!isCounting) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setRemainSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isCounting]);

  useEffect(() => {
    if (!(isCounting && remainSeconds === 0)) {
      return;
    }
    const sessionId = sessionIdRef.current;
    void finishActivityAndLock(sessionId, config.lockOnReminderFinishEnabled)
      .then(() => {
        setReminderVisible(false);
        setIsCounting(false);
        setCurrentText("");
        setCardAnchor({ x: null, y: null });
        triggerInFlightRef.current = false;
      })
      .catch((error) => {
        api.error(`结束活动失败：${String(error)}`);
      });
  }, [api, isCounting, remainSeconds, config.lockOnReminderFinishEnabled]);

  useEffect(() => {
    if (!config.enabled || reminderVisible || !nextTriggerAt) {
      return;
    }
    // 中文注释：增强兜底触发，避免 setTimeout 在系统休眠/窗口后台节流后错过提醒。
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const msLeft = nextTriggerAt - now;
      if (!triggerInFlightRef.current && msLeft > 0 && msLeft <= LAST_MINUTE_NOTIFICATION_MS) {
        if (lastMinuteNotifiedForTriggerAtRef.current !== nextTriggerAt) {
          lastMinuteNotifiedForTriggerAtRef.current = nextTriggerAt;
          void notifyOneMinuteBeforeReminder();
        }
      }

      if (now >= nextTriggerAt && !triggerInFlightRef.current) {
        void triggerReminder();
      }
    }, 1000);
    const onVisible = (): void => {
      if (document.hidden) {
        return;
      }
      const now = Date.now();
      const msLeft = nextTriggerAt - now;
      if (!triggerInFlightRef.current && msLeft > 0 && msLeft <= LAST_MINUTE_NOTIFICATION_MS) {
        if (lastMinuteNotifiedForTriggerAtRef.current !== nextTriggerAt) {
          lastMinuteNotifiedForTriggerAtRef.current = nextTriggerAt;
          void notifyOneMinuteBeforeReminder();
        }
      }

      if (now >= nextTriggerAt && !triggerInFlightRef.current) {
        void triggerReminder();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [api, config.enabled, nextTriggerAt, reminderVisible]);

  const applyCloseToTray = (): void => {
    if (rememberCloseChoice) {
      localStorage.setItem(CLOSE_BEHAVIOR_STORAGE_KEY, "tray");
    }
    setClosePromptOpen(false);
    void getCurrentWindow()
      .hide()
      .catch((error: unknown) => {
        api.error(`隐藏到托盘失败：${String(error)}`);
      });
  };

  const applyCloseExit = (): void => {
    if (rememberCloseChoice) {
      localStorage.setItem(CLOSE_BEHAVIOR_STORAGE_KEY, "exit");
    }
    setClosePromptOpen(false);
    void exitApp().catch((error: unknown) => {
      api.error(`退出失败：${String(error)}`);
    });
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="关闭主窗口"
        open={closePromptOpen}
        onCancel={() => setClosePromptOpen(false)}
        footer={null}
        destroyOnClose
        maskClosable
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <span>请选择：最小化到系统托盘（后台继续运行），或退出程序。</span>
          <Checkbox checked={rememberCloseChoice} onChange={(e) => setRememberCloseChoice(e.target.checked)}>
            记住我的选择
          </Checkbox>
          <Space wrap>
            <Button type="primary" onClick={applyCloseToTray}>
              最小化到系统托盘
            </Button>
            <Button danger onClick={applyCloseExit}>
              退出程序
            </Button>
          </Space>
        </Space>
      </Modal>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <ReminderSettingsPage config={config} nextTriggerLabel={nextTriggerLabel} onChange={setConfig} />
      </Space>
      <ReminderFullscreenPage
        visible={reminderVisible}
        title="久坐提醒"
        reminderText={currentText || "该活动了，请准备活动并做好准备。"}
        backgroundUrl={""}
        isCounting={isCounting}
        remainSeconds={remainSeconds}
        anchorX={cardAnchor.x}
        anchorY={cardAnchor.y}
        durationMinutes={config.reminderDurationMinutes}
        onStartActivity={() => {
          void handleStartActivity();
        }}
      />
    </>
  );
}
