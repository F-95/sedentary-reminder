/**
 * 从根目录 CHANGELOG.md 提取指定语义化版本（x.y.z）的小节正文，供 CI Release 或 gh CLI 使用。
 * 若缺少对应 ## [x.y.z] 标题则退出码 1（强制发布前维护变更日志）。
 *
 * 用法：node scripts/changelog-for-release.mjs <x.y.z> [输出文件路径]
 * 默认写入仓库根目录 release-body.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const version = process.argv[2];
const outPathArg = process.argv[3];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("[changelog-for-release] 用法: node scripts/changelog-for-release.mjs <x.y.z> [输出文件路径]");
  process.exit(1);
}

const changelogPath = resolve(repoRoot, "CHANGELOG.md");
let text;
try {
  text = readFileSync(changelogPath, "utf8");
} catch (e) {
  console.error("[changelog-for-release] 无法读取 CHANGELOG.md:", e.message);
  process.exit(1);
}

const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headerRe = new RegExp(`^## \\[${escaped}\\][^\\n]*\\r?\\n`, "m");
const match = text.match(headerRe);
if (!match) {
  console.error(`[changelog-for-release] CHANGELOG.md 中未找到版本小节: ## [${version}]`);
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = text.slice(start);
const nextIdx = rest.search(/^## \[/m);
const section = (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).trimEnd();

const FOOTER = `

---

Windows 安装包见下方 **Assets**。NSIS（\`*-setup.exe\`）为安装向导，MSI（\`*.msi\`）为企业/静默部署常用格式。SmartScreen 等与安装相关说明见本仓库 README「Windows 安装包（GitHub Releases）」一节。`;

const out = section + FOOTER;
const outFile = outPathArg ? resolve(outPathArg) : resolve(repoRoot, "release-body.md");

writeFileSync(outFile, out, "utf8");
console.log(`[changelog-for-release] 已写入 ${outFile}（${out.length} 字符）`);
