/**
 * 根据 CHANGELOG.md 批量生成 release-notes/vx.y.z.md，供补登 GitHub Release 说明或 gh CLI 使用。
 */
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outDir = resolve(repoRoot, "release-notes");
mkdirSync(outDir, { recursive: true });

/** 已发布、需与 GitHub Releases 说明对齐的版本（按时间顺序） */
const versions = ["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.1.4", "0.1.5"];

for (const v of versions) {
  const outFile = resolve(outDir, `v${v}.md`);
  const r = spawnSync(process.execPath, [resolve(repoRoot, "scripts/changelog-for-release.mjs"), v, outFile], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log(`[export-release-notes] 已在 release-notes/ 生成 ${versions.length} 个 Markdown 文件。`);
