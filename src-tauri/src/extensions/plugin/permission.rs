#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Permission {
    NetworkFetch,
    FsRead,
    FsWrite,
    Custom(String),
}

impl From<&str> for Permission {
    fn from(value: &str) -> Self {
        match value {
            "network:fetch" => Self::NetworkFetch,
            "fs:read" => Self::FsRead,
            "fs:write" => Self::FsWrite,
            other => Self::Custom(other.to_string()),
        }
    }
}
