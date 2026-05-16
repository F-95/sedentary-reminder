import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

const CHECK_TIMEOUT_MS = 60_000;

/** 中文注释：与本仓库 `tauri.conf.json` 中 updater endpoints 对应的 GitHub 仓库，用于「完整 Release 说明」外链。 */
export const UPDATER_GITHUB_REPO = "F-95/sedentary-reminder" as const;

/** 中文注释：弹窗内更新说明最大字符数（截断「构建」段之后、Markdown 降噪之后统计），防止异常超长正文。 */
export const UPDATE_DIALOG_BODY_MAX_CHARS = 560;

/**
 * 中文注释：从 Release 正文中截掉「### 构建…」及之后（应用内不展示技术/发版细节）。
 * 匹配行首 `### 构建` 或 `### 构建与发布`（允许 `###` 与标题间空格）。
 */
const BUILD_SECTION_SPLIT_RE = /(?:^|[\r\n]+)###\s*构建(?:与发布)?(?:\s|$|[\r\n])/m;

/**
 * 中文注释：将 semver 规范为与本仓库发版一致的 Git 标签（`v*`），供 Release 页 URL 使用。
 */
export function toReleaseTag(version: string): string {
  const v = version.trim();
  if (!v) {
    return "v0.0.0";
  }
  return /^v\d/i.test(v) ? v : `v${v}`;
}

/**
 * 中文注释：当前版本对应 GitHub Release 页面 URL（与 `.github/workflows/release.yml` 的 `v*` 标签约定一致）。
 */
export function githubReleaseNotesUrl(version: string): string {
  const tag = toReleaseTag(version);
  return `https://github.com/${UPDATER_GITHUB_REPO}/releases/tag/${encodeURIComponent(tag)}`;
}

/**
 * 中文注释：对弹窗展示的纯文本做轻量 Markdown 降噪（不引入 Markdown 渲染，仅弱化符号噪音）。
 */
function stripLightMarkdownForPlainText(input: string): string {
  let s = input.replace(/\*\*/g, "");
  s = s.replace(/`+/g, "");
  s = s.replace(/^#{1,6}\s*/gm, "");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 中文注释：将 updater 返回的 `body` 格式化为适合「发现新版本」弹窗的短文案（截断构建段 + 降噪 + 超长兜底）。
 */
export function formatUpdateBodyForDialog(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  const split = BUILD_SECTION_SPLIT_RE.exec(trimmed);
  const beforeBuild = split?.index !== undefined ? trimmed.slice(0, split.index).trimEnd() : trimmed;
  let out = stripLightMarkdownForPlainText(beforeBuild);
  if (out.length > UPDATE_DIALOG_BODY_MAX_CHARS) {
    out = `${out.slice(0, UPDATE_DIALOG_BODY_MAX_CHARS).trimEnd()}…`;
  }
  return out;
}

/**
 * 中文注释：是否应在弹窗展示「GitHub 完整说明」链接（正文被截断或去掉构建段时建议展示）。
 */
export function shouldShowGithubFullReleaseNotesLink(originalBody: string, formatted: string): boolean {
  const t = originalBody.trim();
  if (!t) {
    return false;
  }
  if (BUILD_SECTION_SPLIT_RE.test(t)) {
    return true;
  }
  if (t.length > UPDATE_DIALOG_BODY_MAX_CHARS) {
    return true;
  }
  return stripLightMarkdownForPlainText(t) !== formatted;
}

/**
 * 中文注释：将 Tauri Updater 常见英文错误转写为用户可理解的说明（仍保留技术关键词便于排查）。
 */
export function formatUpdaterCheckError(raw: string): string {
  if (raw.includes("Could not fetch a valid release JSON")) {
    return "未从更新地址获取到有效的 latest.json。常见原因：① Releases 未上传名为 latest.json 的资源；② 地址 404（仓库名或路径错误）；③ 返回内容不是 Tauri 要求的 JSON。请检查 src-tauri/tauri.conf.json 的 plugins.updater.endpoints，并在每次发版时附带由构建生成的 latest.json 与签名。";
  }
  if (raw.includes("Updater does not have any endpoints set")) {
    return "未配置更新地址（endpoints 为空）。请在 tauri.conf.json 中配置 plugins.updater.endpoints。";
  }
  if (raw.includes("the platform") && raw.includes("was not found in the response")) {
    return "更新描述 JSON 中缺少当前平台条目（例如 windows-x86_64）。请补全 latest.json 的 platforms 字段。";
  }
  if (raw.includes("InsecureTransportProtocol") || raw.includes("secure protocol")) {
    return "更新地址必须使用 HTTPS。请修改 endpoints 为 https 链接。";
  }
  return raw;
}

/**
 * 中文注释：请求更新源并返回结果；无新版本时 `update` 为 null。
 * 非 Tauri 或网络/配置异常时抛出，由调用方统一提示。
 */
export async function fetchAvailableUpdate() {
  return check({ timeout: CHECK_TIMEOUT_MS });
}

/**
 * 中文注释：下载并安装已解析的更新包，随后重启进程（Windows 上安装前会退出应用）。
 */
export async function installUpdateAndRelaunch(
  update: NonNullable<Awaited<ReturnType<typeof check>>>
): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
