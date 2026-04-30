use std::collections::HashMap;

use crate::extensions::plugin::manifest::PluginManifest;

#[derive(Default)]
pub struct PluginRegistry {
    entries: HashMap<String, PluginManifest>,
}

impl PluginRegistry {
    pub fn register(&mut self, manifest: PluginManifest) {
        self.entries.insert(manifest.id.clone(), manifest);
    }
}
