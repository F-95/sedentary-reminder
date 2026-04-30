#[derive(Debug, Clone)]
pub struct AppConfig {
    pub patch_root: String,
    pub plugin_root: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            patch_root: "patches".to_string(),
            plugin_root: "plugins".to_string(),
        }
    }
}
