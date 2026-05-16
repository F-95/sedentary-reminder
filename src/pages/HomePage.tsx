import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Button, Checkbox, Modal, Space, Tooltip, Typography, message, theme } from "antd";
import type {
  CloseBehaviorPreference,
  ReminderConfig,
  ThemeModePreference,
  TrayFieldTogglePayload,
  TrayToggleField
} from "@/types/global";
import ReminderFullscreenPage from "@/pages/ReminderFullscreenPage";
import ReminderSettingsPage from "@/pages/ReminderSettingsPage";
import SedentaryReminderSettingsPage from "@/pages/SedentaryReminderSettingsPage";
import HydrationSettingsPage from "@/pages/HydrationSettingsPage";
import QuietHoursSettingsPage from "@/pages/QuietHoursSettingsPage";
import StatisticsPage from "@/pages/StatisticsPage";
import AuthorBlurbPage from "@/pages/AuthorBlurbPage";
import {
  CLOSE_BEHAVIOR_STORAGE_KEY,
  EVENT_MAIN_CLOSE_REQUESTED,
  EVENT_SESSION_UNLOCKED,
  EVENT_TRAY_FIELD_TOGGLE,
  exitApp,
  finishActivityAndLock,
  getAppInfo,
  getReminderRuntime,
  listDefaultSlogans,
  loadSchedulerSnapshot,
  recordStatEvent,
  saveSchedulerSnapshot,
  setAutoStartEnabled,
  setReminderWindowMode,
  startReminderSession,
  syncTrayMenu,
  updateNextTrigger
} from "@/utils/tauri";
import {
  fetchAvailableUpdate,
  formatUpdateBodyForDialog,
  formatUpdaterCheckError,
  githubReleaseNotesUrl,
  installUpdateAndRelaunch,
  shouldShowGithubFullReleaseNotesLink
} from "@/utils/appUpdate";
import {
  buildSchedulerFingerprint,
  computeNextIntervalFireWithQuietHours,
  computeNextTriggerWithQuietHours,
  loadReminderConfigFromStorageWithDiagnostics,
  persistReminderConfigV2
} from "@/utils/quietHours";

const LAST_MINUTE_NOTIFICATION_MS = 60_000;
/** 中文注释：快照「下一拍」若距现在不足该毫秒数则丢弃，避免边界重复触发。 */
const SCHEDULER_SNAPSHOT_SLACK_MS = 2000;
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

/** 中文注释：第四版补水提醒，仅系统通知，不触发全屏。返回是否已成功发出通知（用于统计）。 */
async function notifyHydrationReminder(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (!granted) {
      return false;
    }
    await sendNotification({
      title: "补水提醒",
      body: "该喝水了，记得补充水分。"
    });
    return true;
  } catch {
    // 中文注释：非 Tauri 环境或通知插件不可用时静默跳过。
    return false;
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

export interface HomePageProps {
  themeMode: ThemeModePreference;
  onThemeModeChange: (mode: ThemeModePreference) => void;
}

export default function HomePage(props: HomePageProps): JSX.Element {
  const { themeMode, onThemeModeChange } = props;
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
  const [settingsView, setSettingsView] = useState<"main" | "sedentary" | "hydration" | "quiet" | "stats" | "author">(
    "main"
  );
  /** 中文注释：递增以刷新枢纽统计简报。 */
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  /** 中文注释：补水下一拍时间，与 scheduleNext 内 targetMs 同步，供枢纽页展示。 */
  const [hydrationNextAt, setHydrationNextAt] = useState<number | null>(null);
  /** 中文注释：枢纽页倒计时用，仅在 main 视图每秒刷新。 */
  const [hubNowMs, setHubNowMs] = useState<number>(() => Date.now());
  /** 中文注释：第八版——用户「记录活动/跳过本次」后递增，迫使久坐调度 effect 以当前时刻重算下一拍。 */
  const [sedentaryScheduleNonce, setSedentaryScheduleNonce] = useState(0);
  const { token } = theme.useToken();
  /** 中文注释：第九版——与后端 get_app_info / 安装包版本一致。 */
  const [appVersion, setAppVersion] = useState<string>("…");
  /** 中文注释：第九版——检查或安装更新进行中。 */
  const [updateBusy, setUpdateBusy] = useState(false);

  const nextTriggerAtRef = useRef<number | null>(null);
  const hydrationNextAtRef = useRef<number | null>(null);
  const reminderVisibleRef = useRef<boolean>(false);
  /** 中文注释：第十版——启动时自磁盘加载的调度快照，用于首帧合并久坐/补水下一拍。 */
  const loadedSchedulerSnapshotRef = useRef<Awaited<ReturnType<typeof loadSchedulerSnapshot>>>(null);
  /** 中文注释：仅首轮久坐调度 effect 尝试消费快照，之后一律按当前时刻重算。 */
  const sedentaryScheduleBootstrapRef = useRef<boolean>(true);
  /** 中文注释：仅首轮补水 scheduleNext 尝试消费快照。 */
  const hydrationScheduleBootstrapRef = useRef<boolean>(true);

  const bumpStatsRefresh = useCallback((): void => {
    setStatsRefreshKey((k) => k + 1);
  }, []);

  /** 中文注释：供定时回调读取最新配置；收窄调度 effect 依赖后，避免仍用陈旧闭包中的 randomText / 时长等字段。 */
  const configRef = useRef(config);
  configRef.current = config;

  // 中文注释：主设置枢纽倒计时每秒刷新；离开 main 即停。
  useEffect(() => {
    if (settingsView !== "main") {
      return;
    }
    setHubNowMs(Date.now());
    const id = window.setInterval(() => {
      setHubNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [settingsView]);

  /** 中文注释：第九版——读取安装包语义化版本号供底部栏展示。 */
  useEffect(() => {
    void getAppInfo()
      .then((info) => setAppVersion(info.version))
      .catch(() => setAppVersion("未知"));
  }, []);

  /** 中文注释：第十版——加载调度快照供首轮久坐/补水合并。 */
  useEffect(() => {
    void loadSchedulerSnapshot().then((snap) => {
      if (snap?.schemaVersion === 1) {
        loadedSchedulerSnapshotRef.current = snap;
      }
    });
  }, []);

  useEffect(() => {
    nextTriggerAtRef.current = nextTriggerAt;
  }, [nextTriggerAt]);

  useEffect(() => {
    hydrationNextAtRef.current = hydrationNextAt;
  }, [hydrationNextAt]);

  useEffect(() => {
    reminderVisibleRef.current = reminderVisible;
  }, [reminderVisible]);

  useEffect(() => {
    if (settingsView === "main") {
      bumpStatsRefresh();
    }
  }, [settingsView, bumpStatsRefresh]);

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
    let unlistenSession: (() => void) | undefined;

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
          return;
        }

        unlistenSession = await listen(EVENT_SESSION_UNLOCKED, () => {
          const c = configRef.current;
          if (!c.logActivityOnSessionUnlockEnabled || !c.enabled || reminderVisibleRef.current) {
            return;
          }
          void (async () => {
            try {
              await recordStatEvent("sedentary_activity_logged");
              bumpStatsRefresh();
              setSedentaryScheduleNonce((n) => n + 1);
              apiRef.current.success("已记录活动（系统解锁），已为你安排下次久坐提醒。");
            } catch (error: unknown) {
              apiRef.current.error(`记录失败：${String(error)}`);
            }
          })();
        });
        if (cancelled) {
          unlistenTray();
          unlistenClose();
          unlistenSession();
        }
      } catch {
        // 中文注释：非 Tauri 或权限不足时忽略。
      }
    })();

    return () => {
      cancelled = true;
      unlistenTray?.();
      unlistenClose?.();
      unlistenSession?.();
    };
  }, [bumpStatsRefresh]);

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

    void recordStatEvent("sedentary_triggered");

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
      void saveSchedulerSnapshot({
        schemaVersion: 1,
        fingerprint: buildSchedulerFingerprint(cfg),
        sedentaryNextAtMs: null,
        hydrationNextAtMs: hydrationNextAtRef.current
      });
      return;
    }

    const fp = buildSchedulerFingerprint(cfg);
    const computed = computeNextTriggerWithQuietHours(Date.now(), cfg);
    let { nextMs } = computed;
    const { hitQuietPostponeCap } = computed;
    const snap = loadedSchedulerSnapshotRef.current;
    const now = Date.now();
    if (
      nextMs !== null &&
      sedentaryScheduleBootstrapRef.current &&
      snap &&
      snap.schemaVersion === 1 &&
      snap.fingerprint === fp &&
      snap.sedentaryNextAtMs !== null &&
      snap.sedentaryNextAtMs > now + SCHEDULER_SNAPSHOT_SLACK_MS
    ) {
      nextMs = snap.sedentaryNextAtMs;
    }
    sedentaryScheduleBootstrapRef.current = false;

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

    void saveSchedulerSnapshot({
      schemaVersion: 1,
      fingerprint: fp,
      sedentaryNextAtMs: nextMs,
      hydrationNextAtMs: hydrationNextAtRef.current
    });

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
  }, [
    config.enabled,
    config.rules,
    config.quietHoursEnabled,
    config.quietHours,
    reminderVisible,
    sedentaryScheduleNonce,
    api,
    triggerReminder
  ]);

  /** 中文注释：枢纽「记录活动」——记统计、刷新简报、从当前时刻重排久坐下一拍（不调起全屏）。 */
  const handleSedentaryLogActivity = useCallback(async (): Promise<void> => {
    try {
      await recordStatEvent("sedentary_activity_logged");
      bumpStatsRefresh();
      setSedentaryScheduleNonce((n) => n + 1);
      api.success("已记录活动，已为你安排下次久坐提醒。");
    } catch (error) {
      api.error(`记录失败：${String(error)}`);
    }
  }, [api, bumpStatsRefresh]);

  /** 中文注释：枢纽「跳过本次」——记统计、刷新简报、从当前时刻重排下一拍。 */
  const handleSedentarySkipOnce = useCallback(async (): Promise<void> => {
    try {
      await recordStatEvent("sedentary_skipped");
      bumpStatsRefresh();
      setSedentaryScheduleNonce((n) => n + 1);
      api.success("已跳过本次，已为你安排下次久坐提醒。");
    } catch (error) {
      api.error(`跳过失败：${String(error)}`);
    }
  }, [api, bumpStatsRefresh]);

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
        hydrationScheduleBootstrapRef.current = false;
        setHydrationNextAt(null);
        void saveSchedulerSnapshot({
          schemaVersion: 1,
          fingerprint: buildSchedulerFingerprint(cfg),
          sedentaryNextAtMs: nextTriggerAtRef.current,
          hydrationNextAtMs: null
        });
        return;
      }

      const fp = buildSchedulerFingerprint(cfg);
      const computed = computeNextIntervalFireWithQuietHours(
        Date.now(),
        cfg.hydrationIntervalMinutes,
        cfg
      );
      let { nextMs } = computed;
      const { hitQuietPostponeCap } = computed;

      const snap = loadedSchedulerSnapshotRef.current;
      const now = Date.now();
      if (
        hydrationScheduleBootstrapRef.current &&
        snap &&
        snap.schemaVersion === 1 &&
        snap.fingerprint === fp &&
        snap.hydrationNextAtMs !== null &&
        snap.hydrationNextAtMs > now + SCHEDULER_SNAPSHOT_SLACK_MS
      ) {
        nextMs = snap.hydrationNextAtMs;
      }
      hydrationScheduleBootstrapRef.current = false;

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
      setHydrationNextAt(targetMs);
      void saveSchedulerSnapshot({
        schemaVersion: 1,
        fingerprint: fp,
        sedentaryNextAtMs: nextTriggerAtRef.current,
        hydrationNextAtMs: targetMs
      });
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
          const sent = await notifyHydrationReminder();
          if (sent) {
            void recordStatEvent("hydration_notified");
            bumpStatsRefresh();
          }
          scheduleNext();
        })();
      }, waitMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [
    api,
    bumpStatsRefresh,
    config.hydrationReminderEnabled,
    config.hydrationIntervalMinutes,
    config.quietHoursEnabled,
    config.quietHours
  ]);

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
        void recordStatEvent("sedentary_completed");
        bumpStatsRefresh();
        setReminderVisible(false);
        setIsCounting(false);
        setCurrentText("");
        setCardAnchor({ x: null, y: null });
        triggerInFlightRef.current = false;
      })
      .catch((error) => {
        api.error(`结束活动失败：${String(error)}`);
      });
  }, [api, bumpStatsRefresh, isCounting, remainSeconds, config.lockOnReminderFinishEnabled]);

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

  const handleCheckForUpdates = useCallback((): void => {
    void (async () => {
      setUpdateBusy(true);
      try {
        const update = await fetchAvailableUpdate();
        if (!update) {
          api.success("当前已是最新版本");
          return;
        }
        const releaseNotesRaw = update.body?.trim() ?? "";
        const releaseNotesDisplay = formatUpdateBodyForDialog(releaseNotesRaw);
        const showGithubNotes = shouldShowGithubFullReleaseNotesLink(releaseNotesRaw, releaseNotesDisplay);
        const githubNotesUrl = githubReleaseNotesUrl(update.version);

        Modal.confirm({
          title: "发现新版本",
          width: 440,
          content: (
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }}>新版本号：{update.version}</Typography.Paragraph>
              {releaseNotesDisplay ? (
                <div
                  style={{
                    maxHeight: 240,
                    overflowY: "auto",
                    marginBottom: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--ant-color-fill-quaternary, rgba(0,0,0,0.04))",
                    fontSize: 12,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word"
                  }}
                >
                  {releaseNotesDisplay}
                </div>
              ) : null}
              {showGithubNotes ? (
                <Typography.Paragraph style={{ marginBottom: 8 }}>
                  <Typography.Link href={githubNotesUrl} target="_blank" rel="noopener noreferrer">
                    在 GitHub 查看完整说明
                  </Typography.Link>
                </Typography.Paragraph>
              ) : null}
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                将下载并安装更新，完成后自动重启应用（Windows 安装过程可能短暂无界面反馈）。
              </Typography.Paragraph>
            </div>
          ),
          okText: "下载并安装",
          cancelText: "稍后",
          onCancel: () => {
            void update.close();
          },
          onOk: async () => {
            try {
              await installUpdateAndRelaunch(update);
            } catch (err) {
              api.error(`安装更新失败：${formatUpdaterCheckError(String(err))}`);
              throw err;
            }
          }
        });
      } catch (e) {
        api.error(`检查更新失败：${formatUpdaterCheckError(String(e))}`);
      } finally {
        setUpdateBusy(false);
      }
    })();
  }, [api]);

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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minHeight: "calc(100vh - 48px)",
          boxSizing: "border-box"
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Space
            direction="vertical"
            size="middle"
            style={{
              width: "100%",
              flex: 1,
              minHeight: 0,
              maxHeight: settingsView === "main" ? "100%" : undefined,
              overflowY: settingsView === "main" ? "hidden" : "auto"
            }}
          >
            {settingsView === "main" ? (
              <ReminderSettingsPage
                config={config}
                nextSedentaryAt={nextTriggerAt}
                nextHydrationAt={hydrationNextAt}
                nowMs={hubNowMs}
                sedentaryFullscreenActive={reminderVisible}
                onChange={setConfig}
                onOpenSedentary={() => setSettingsView("sedentary")}
                onOpenHydration={() => setSettingsView("hydration")}
                onOpenQuietHours={() => setSettingsView("quiet")}
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
                statsRefreshKey={statsRefreshKey}
                onOpenStats={() => setSettingsView("stats")}
                onOpenAuthorBlurb={() => setSettingsView("author")}
                onSedentaryLogActivity={() => {
                  void handleSedentaryLogActivity();
                }}
                onSedentarySkipOnce={() => {
                  void handleSedentarySkipOnce();
                }}
              />
            ) : settingsView === "stats" ? (
              <StatisticsPage onBack={() => setSettingsView("main")} />
            ) : settingsView === "author" ? (
              <AuthorBlurbPage onBack={() => setSettingsView("main")} />
            ) : settingsView === "sedentary" ? (
              <SedentaryReminderSettingsPage
                config={config}
                onChange={setConfig}
                onBack={() => setSettingsView("main")}
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
        </div>
        <div
          style={{
            flexShrink: 0,
            paddingTop: 10,
            borderTop: `1px solid ${token.colorSplit}`,
            textAlign: "center"
          }}
        >
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">v{appVersion}</Typography.Text>
              <Button
                type="link"
                size="small"
                aria-label="检查更新"
                icon={<ReloadOutlined spin={updateBusy} />}
                onClick={handleCheckForUpdates}
                disabled={updateBusy}
                style={{ padding: "0 4px" }}
              />
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <Tooltip title="提醒配置、统计与本地调度快照仅保存在本机应用数据目录，不会上传云端或任何服务器。">
                <InfoCircleOutlined style={{ marginRight: 6 }} aria-hidden />
                用户须知：数据仅存本机，不上传云端
              </Tooltip>
            </Typography.Text>
          </Space>
        </div>
      </div>
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
