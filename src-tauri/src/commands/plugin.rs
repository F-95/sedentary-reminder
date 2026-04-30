use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMeta {
    pub id: String,
    pub version: String,
    pub permissions: Vec<String>,
}

#[tauri::command]
pub fn list_plugins() -> Vec<PluginMeta> {
    vec![]
}
