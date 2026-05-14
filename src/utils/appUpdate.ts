import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

const CHECK_TIMEOUT_MS = 60_000;

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
