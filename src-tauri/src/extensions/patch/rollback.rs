use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackPlan {
    pub target_version: String,
    pub steps: Vec<String>,
}
