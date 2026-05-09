import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Button, Checkbox, Modal, Space, message } from "antd";
import type { CloseBehaviorPreference, ReminderConfig, TrayFieldTogglePayload, TrayToggleField } from "@/types/global";
import ReminderFullscreenPage from "@/pages/ReminderFullscreenPage";
import ReminderSettingsPage from "@/pages/ReminderSettingsPage";
import HydrationSettingsPage from "@/pages/HydrationSettingsPage";
import QuietHoursSettingsPage from "@/pages/QuietHoursSettingsPage";
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
import {
  computeNextIntervalFireWithQuietHours,
  computeNextTriggerWithQuietHours,
  loadReminderConfigFromStorageWithDiagnostics,
  persistReminderConfigV2
} from "@/utils/quietHours";

const LAST_MINUTE_NOTIFICATION_MS = 60_000;
const DEFAULT_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_ef8b7f0d9e.mp3";

function reminderDurationSeconds(config: ReminderConfig): number {
  return config.reminderDurationMinutes * 60;
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

/** 中文注释：第四版补水提醒，仅系统通知，不触发全屏。 */
async function notifyHydrationReminder(): Promise<void> {
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
      title: "补水提醒",
      body: "该喝水了，记得补充水分。"
    });
  } catch {
    // 中文注释：非 Tauri 环境或通知插件不可用时静默跳过。
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

/** 中文注释：首屏只读一次 localStorage，避免重复解析并与错误提示共用同一份诊断结果。 */
function getInitialReminderLoad() {
  const ref = { current: null as ReturnType<typeof loadReminderConfigFromStorageWithDiagnostics> | null };
  return (): ReturnType<typeof loadReminderConfigFromStorageWithDiagnostics> => {
    if (!ref.current) {
      ref.current = loadReminderConfigFromStorageWithDiagnostics();
    }
    return ref.current;
  };
}

const readInitialReminderLoad = getInitialReminderLoad();

export default function HomePage(): JSX.Element {
  const [api, contextHolder] = message.useMessage();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [config, setConfig] = useState<ReminderConfig>(() => readInitialReminderLoad().config);
  const [nextTriggerAt, setNextTriggerAt] = useState<number | null>(null);
  const [reminderVisible, setReminderVisible] = useState<boolean>(false);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [remainSeconds, setRemainSeconds] = useState<number>(() => reminderDurationSeconds(readInitialReminderLoad().config));
  const [currentText, setCurrentText] = useState<string>("");
  const [cardAnchor, setCardAnchor] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const sessionIdRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triggerInFlightRef = useRef<boolean>(false);
  const lastMinuteNotifiedForTriggerAtRef = useRef<number | null>(null);
  const quietPostponeCapWarnedRef = useRef<boolean>(false);
  const hydrationQuietPostponeCapWarnedRef = useRef<boolean>(false);
  const configLoadErrorShownRef = useRef<boolean>(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [rememberCloseChoice, setRememberCloseChoice] = useState(false);
  const [settingsView, setSettingsView] = useState<"main" | "quiet" | "hydration">("main");

  /** 中文注释：供定时回调读取最新配置；收窄调度 effect 依赖后，避免仍用陈旧闭包中的 randomText / 时长等字段。 */
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (configLoadErrorShownRef.current) {
      return;
    }
    const { userMessage } = readInitialReminderLoad();
    if (userMessage) {
      configLoadErrorShownRef.current = true;
      api.error(userMessage);
    }
  }, [api]);

  useEffect(() => {
    try {
      persistReminderConfigV2(config);
    } catch (error) {
      api.error(`配置保存失败：${String(error)}`);
    }
  }, [api, config]);

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

  const stopAudio = useCallback((): void => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }, []);

  const triggerReminder = useCallback(async (): Promise<void> => {
    if (triggerInFlightRef.current || reminderVisible) {
      return;
    }
    const cfg = configRef.current;
    triggerInFlightRef.current = true;
    sessionIdRef.current = `session-${Date.now()}`;
    const selectedText = cfg.randomTextEnabled ? pickRandomText(cfg.texts) : cfg.texts[0] ?? "该活动了，请准备活动并做好准备。";
    setCurrentText(selectedText);
    setReminderVisible(true);
    setIsCounting(false);
    setRemainSeconds(reminderDurationSeconds(cfg));

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
  }, [api, reminderVisible]);

  /**
   * 中文注释：仅当「参与 computeNextTriggerWithQuietHours 的字段」或提醒显隐变化时重算下次触发。
   * 开机自启、提醒结束锁屏、随机文案等不参与调度，变更时不得清空 setTimeout，否则会错误刷新「下次提醒时间」。
   * 触发提醒时通过 configRef 读取最新配置（见 triggerReminder）。
   */
  useEffect(() => {
    const cfg = configRef.current;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!cfg.enabled || reminderVisible) {
      quietPostponeCapWarnedRef.current = false;
      setNextTriggerAt(null);
      void updateNextTrigger(null, null);
      return;
    }

    const { nextMs, hitQuietPostponeCap } = computeNextTriggerWithQuietHours(Date.now(), cfg);
    if (hitQuietPostponeCap) {
      if (!quietPostponeCapWarnedRef.current) {
        api.warning(
          "免打扰链式推迟次数达到安全上限，已使用最后一次计算结果；请检查时段是否重叠过多或配置异常。"
        );
        quietPostponeCapWarnedRef.current = true;
      }
    } else {
      quietPostponeCapWarnedRef.current = false;
    }

    setNextTriggerAt(nextMs);
    void updateNextTrigger(nextMs, nextMs ? formatNextLabel(nextMs) : null);

    if (!nextMs) {
      return;
    }
    const waitMs = Math.max(500, nextMs - Date.now());
    timerRef.current = window.setTimeout(() => {
      void triggerReminder();
    }, waitMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [config.enabled, config.rules, config.quietHoursEnabled, config.quietHours, reminderVisible, api, triggerReminder]);

  /**
   * 中文注释：补水独立调度链；依赖仅含补水开关、补水间隔与免打扰字段，不得并入久坐 next 的 effect。
   * 每次触发后自「当前时刻」重算下一拍，语义与 computeNextIntervalFireWithQuietHours 一致。
   */
  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const clearTimer = (): void => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const scheduleNext = (): void => {
      if (cancelled) {
        return;
      }
      clearTimer();
      const cfg = configRef.current;
      if (!cfg.hydrationReminderEnabled) {
        hydrationQuietPostponeCapWarnedRef.current = false;
        return;
      }

      const { nextMs, hitQuietPostponeCap } = computeNextIntervalFireWithQuietHours(
        Date.now(),
        cfg.hydrationIntervalMinutes,
        cfg
      );

      if (hitQuietPostponeCap) {
        if (!hydrationQuietPostponeCapWarnedRef.current) {
          hydrationQuietPostponeCapWarnedRef.current = true;
          api.warning(
            "免打扰链式推迟次数达到安全上限，已使用最后一次计算结果；请检查时段是否重叠过多或配置异常。"
          );
        }
      } else {
        hydrationQuietPostponeCapWarnedRef.current = false;
      }

      const targetMs = nextMs ?? Date.now() + cfg.hydrationIntervalMinutes * 60_000;
      const waitMs = Math.max(500, targetMs - Date.now());
      timerId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        void (async () => {
          const latest = configRef.current;
          if (!latest.hydrationReminderEnabled) {
            scheduleNext();
            return;
          }
          await notifyHydrationReminder();
          scheduleNext();
        })();
      }, waitMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [api, config.hydrationReminderEnabled, config.hydrationIntervalMinutes, config.quietHoursEnabled, config.quietHours]);

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
    // 中文注释：不将 triggerReminder 列入依赖，避免定时器随渲染频繁重建；逻辑内通过 ref 与最新闭包调用。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
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
        {settingsView === "main" ? (
          <ReminderSettingsPage
            config={config}
            nextTriggerLabel={nextTriggerLabel}
            onChange={setConfig}
            onOpenQuietHours={() => setSettingsView("quiet")}
            onOpenHydration={() => setSettingsView("hydration")}
          />
        ) : settingsView === "quiet" ? (
          <QuietHoursSettingsPage
            config={config}
            onChange={setConfig}
            onBack={() => setSettingsView("main")}
          />
        ) : (
          <HydrationSettingsPage
            config={config}
            onChange={setConfig}
            onBack={() => setSettingsView("main")}
          />
        )}
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
