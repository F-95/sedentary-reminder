use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("manifest 格式无效: {0}")]
    InvalidManifest(String),
    #[error("权限不足: {0}")]
    PermissionDenied(String),
}
