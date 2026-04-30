use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchMeta {
    pub version: String,
    pub platform: String,
    pub entry: String,
}

#[tauri::command]
pub fn list_patches() -> Vec<PatchMeta> {
    vec![]
}
