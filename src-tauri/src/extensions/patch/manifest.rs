use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchManifest {
    pub version: String,
    pub platform: String,
    pub base_version: String,
    pub entry: String,
    pub order: u32,
}
