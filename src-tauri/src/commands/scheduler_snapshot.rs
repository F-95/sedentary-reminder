//! 中文注释：第十版——久坐/补水「下一拍」绝对时间快照，存应用数据目录，供重启或就地升级后延续倒计时。

use serde::{Deserialize, Serialize};
use tauri::Manager;

const SNAPSHOT_FILE: &str = "scheduler_snapshot.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerSnapshot {
    pub schema_version: u32,
    pub fingerprint: String,
    pub sedentary_next_at_ms: Option<i64>,
    pub hydration_next_at_ms: Option<i64>,
}

fn snapshot_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("解析应用数据目录失败: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建应用数据目录失败: {e}"))?;
    Ok(dir.join(SNAPSHOT_FILE))
}

/// 中文注释：读取调度快照；文件不存在或损坏时返回 None。
#[tauri::command]
pub fn load_scheduler_snapshot(app: tauri::AppHandle) -> Result<Option<SchedulerSnapshot>, String> {
    let path = snapshot_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("读取调度快照失败: {e}"))?;
    if bytes.is_empty() {
        return Ok(None);
    }
    serde_json::from_slice::<SchedulerSnapshot>(&bytes)
        .map(Some)
        .map_err(|e| format!("解析调度快照失败: {e}"))
}

/// 中文注释：覆盖写入调度快照（前端在每次算出下一拍后调用）。
#[tauri::command]
pub fn save_scheduler_snapshot(app: tauri::AppHandle, snapshot: SchedulerSnapshot) -> Result<(), String> {
    let path = snapshot_path(&app)?;
    let json = serde_json::to_vec_pretty(&snapshot).map_err(|e| format!("序列化调度快照失败: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("写入调度快照失败: {e}"))?;
    Ok(())
}
