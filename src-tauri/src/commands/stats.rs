//! 中文注释：本地提醒统计事件（JSONL），仅存应用数据目录，保留约 400 天，不上报远端。

use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::io::{BufRead, BufReader, Write};
use std::time::{SystemTime, UNIX_EPOCH};

const STATS_FILE: &str = "reminder_stats.jsonl";
const RETENTION_MS: i64 = 400_i64 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatEventRecord {
    pub kind: String,
    pub at_ms: i64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn app_stats_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("解析应用数据目录失败: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建应用数据目录失败: {e}"))?;
    Ok(dir.join(STATS_FILE))
}

fn load_events(path: &std::path::Path) -> Result<Vec<StatEventRecord>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = std::fs::File::open(path).map_err(|e| format!("打开统计文件失败: {e}"))?;
    let mut out = Vec::new();
    for line in BufReader::new(file).lines() {
        let line = line.map_err(|e| format!("读取统计文件失败: {e}"))?;
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if let Ok(rec) = serde_json::from_str::<StatEventRecord>(t) {
            out.push(rec);
        }
    }
    Ok(out)
}

fn prune_events(mut events: Vec<StatEventRecord>) -> Vec<StatEventRecord> {
    let cutoff = now_ms() - RETENTION_MS;
    events.retain(|e| e.at_ms >= cutoff);
    events.sort_by_key(|e| e.at_ms);
    events
}

fn rewrite_file(path: &std::path::Path, events: &[StatEventRecord]) -> Result<(), String> {
    let mut file = std::fs::File::create(path).map_err(|e| format!("重写统计文件失败: {e}"))?;
    for e in events {
        let line = serde_json::to_string(e).map_err(|e| format!("序列化统计事件失败: {e}"))?;
        writeln!(file, "{line}").map_err(|e| format!("写入统计文件失败: {e}"))?;
    }
    Ok(())
}

/// 中文注释：写入一条统计事件；读入后裁剪保留期并整文件回写，避免文件无限增长。
#[tauri::command]
pub fn record_stat_event(app: tauri::AppHandle, kind: String, at_ms: Option<i64>) -> Result<(), String> {
    let at = at_ms.unwrap_or_else(now_ms);
    let path = app_stats_path(&app)?;
    let mut events = prune_events(load_events(&path)?);
    events.push(StatEventRecord { kind, at_ms: at });
    events.sort_by_key(|e| e.at_ms);
    rewrite_file(&path, &events)?;
    Ok(())
}

/// 中文注释：按时间窗查询事件（闭区间 [from_ms, to_ms]），返回前已做保留期裁剪。
#[tauri::command]
pub fn query_stat_events(app: tauri::AppHandle, from_ms: i64, to_ms: i64) -> Result<Vec<StatEventRecord>, String> {
    let path = app_stats_path(&app)?;
    let events = prune_events(load_events(&path)?);
    Ok(events
        .into_iter()
        .filter(|e| e.at_ms >= from_ms && e.at_ms <= to_ms)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prune_drops_old() {
        let now = now_ms();
        let old = now - RETENTION_MS - 1000;
        let events = vec![
            StatEventRecord {
                kind: "a".into(),
                at_ms: old,
            },
            StatEventRecord {
                kind: "b".into(),
                at_ms: now,
            },
        ];
        let events = prune_events(events);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "b");
    }
}
