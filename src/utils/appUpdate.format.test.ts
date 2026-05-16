import { describe, expect, it } from "vitest";
import {
  UPDATE_DIALOG_BODY_MAX_CHARS,
  formatUpdateBodyForDialog,
  githubReleaseNotesUrl,
  shouldShowGithubFullReleaseNotesLink,
  toReleaseTag
} from "@/utils/appUpdate";

describe("toReleaseTag", () => {
  it("无 v 前缀时补上 v", () => {
    expect(toReleaseTag("0.1.10")).toBe("v0.1.10");
  });

  it("已有 v 前缀时保持", () => {
    expect(toReleaseTag("v0.1.10")).toBe("v0.1.10");
  });
});

describe("githubReleaseNotesUrl", () => {
  it("生成带 tag 的 Release URL", () => {
    expect(githubReleaseNotesUrl("0.1.10")).toBe(
      "https://github.com/F-95/sedentary-reminder/releases/tag/v0.1.10"
    );
  });
});

describe("formatUpdateBodyForDialog", () => {
  it("空字符串返回空", () => {
    expect(formatUpdateBodyForDialog("")).toBe("");
    expect(formatUpdateBodyForDialog("   \n")).toBe("");
  });

  it("截断「### 构建与发布」及其后内容", () => {
    const raw =
      "### 用户可见\n\n- 功能 A\n\n### 构建与发布\n\n- tauri 命令\n";
    const out = formatUpdateBodyForDialog(raw);
    expect(out).toContain("功能 A");
    expect(out).not.toContain("tauri");
    expect(out).not.toContain("构建与发布");
  });

  it("截断「### 构建」标题行及其后内容", () => {
    const raw = "前言\n### 构建\n技术细节";
    expect(formatUpdateBodyForDialog(raw)).toBe("前言");
  });

  it("无构建段时超长正文按字数兜底并加省略号", () => {
    const long = "x".repeat(UPDATE_DIALOG_BODY_MAX_CHARS + 80);
    const out = formatUpdateBodyForDialog(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(UPDATE_DIALOG_BODY_MAX_CHARS + 1);
  });

  it("对常见 Markdown 符号做轻量降噪", () => {
    expect(formatUpdateBodyForDialog("**粗体** 与 `code`")).toBe("粗体 与 code");
  });
});

describe("shouldShowGithubFullReleaseNotesLink", () => {
  it("原文含构建段时应展示外链", () => {
    const original = "用户\n### 构建与发布\n技术";
    const formatted = formatUpdateBodyForDialog(original);
    expect(shouldShowGithubFullReleaseNotesLink(original, formatted)).toBe(true);
  });

  it("仅短正文且无构建段时可不强调外链", () => {
    const original = "仅一条说明";
    const formatted = formatUpdateBodyForDialog(original);
    expect(shouldShowGithubFullReleaseNotesLink(original, formatted)).toBe(false);
  });

  it("超长被截断时应展示外链", () => {
    const original = "y".repeat(UPDATE_DIALOG_BODY_MAX_CHARS + 50);
    const formatted = formatUpdateBodyForDialog(original);
    expect(shouldShowGithubFullReleaseNotesLink(original, formatted)).toBe(true);
  });
});
