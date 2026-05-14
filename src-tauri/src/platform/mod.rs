//! 平台相关能力（Windows 企业强控等）

#[cfg(any(windows, target_os = "macos"))]
pub mod session_unlock;

#[cfg(windows)]
pub mod win_enterprise;
