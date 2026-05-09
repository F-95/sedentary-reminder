import { App as AntdApp, ConfigProvider, Layout, theme as antdTheme } from "antd";
import { useEffect, useReducer, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import HomePage from "@/pages/HomePage";
import { PluginHost } from "@/plugins/loader";
import type { ThemeModePreference } from "@/types/global";
import {
  readThemeModePreference,
  resolveEffectiveTheme,
  subscribeSystemThemeChanged,
  writeThemeModePreference
} from "@/utils/themeMode";

const { Content } = Layout;

export default function App(): JSX.Element {
  const [themeMode, setThemeMode] = useState<ThemeModePreference>(() => readThemeModePreference());
  const [, resyncSystemTheme] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (themeMode !== "system") {
      return;
    }
    return subscribeSystemThemeChanged(resyncSystemTheme);
  }, [themeMode]);

  const effective = resolveEffectiveTheme(themeMode);

  useEffect(() => {
    void getCurrentWindow()
      .setTheme(effective === "dark" ? "dark" : "light")
      .catch(() => {
        // 中文注释：非 Tauri 环境忽略。
      });
  }, [effective]);

  const handleThemeModeChange = (mode: ThemeModePreference): void => {
    writeThemeModePreference(mode);
    setThemeMode(mode);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: effective === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: "#1677ff", borderRadius: 10 }
      }}
    >
      <AntdApp>
        <Layout style={{ minHeight: "100vh" }}>
          <Content style={{ padding: 24, boxSizing: "border-box" }}>
            <HomePage themeMode={themeMode} onThemeModeChange={handleThemeModeChange} />
            <PluginHost />
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}
