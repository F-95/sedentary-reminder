/**
 * 中文注释：将语义化版本号同步写入 package.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json。
 * 用法：node scripts/version.mjs 0.1.9
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const next = process.argv[2]?.trim();
if (!next || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error("用法: node scripts/version.mjs <semver>   例如: node scripts/version.mjs 0.1.9");
  process.exit(1);
}

function writeJson(file, mutator) {
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  mutator(data);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const pkgPath = path.join(root, "package.json");
writeJson(pkgPath, (p) => {
  p.version = next;
});

const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = "[^"]+"/m, `version = "${next}"`);
fs.writeFileSync(cargoPath, cargo, "utf8");

const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
writeJson(tauriPath, (t) => {
  t.version = next;
});

console.log(`[version] 已同步版本号为 ${next}`);
