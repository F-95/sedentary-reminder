import type { ThemeModePreference } from "@/types/global";
import { THEME_MODE_STORAGE_KEY } from "@/utils/tauri";

/** 中文注释：解析后的实际亮/暗（跟随系统时已解析）。 */
export type EffectiveTheme = "light" | "dark";

export function readThemeModePreference(): ThemeModePreference {
  const raw = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function writeThemeModePreference(mode: ThemeModePreference): void {
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}

export function resolveEffectiveTheme(mode: ThemeModePreference): EffectiveTheme {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** 中文注释：订阅系统配色变化（仅在 preference 为 system 时由调用方决定是否监听）。 */
export function subscribeSystemThemeChanged(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (): void => cb();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
