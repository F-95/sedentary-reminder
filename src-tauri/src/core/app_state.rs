use std::sync::Mutex;

use crate::core::reminder_scheduler::ReminderRuntimeState;

#[derive(Debug, Default)]
pub struct AppState {
    pub loaded_patch_count: usize,
    pub loaded_plugin_count: usize,
    pub reminder_runtime: Mutex<ReminderRuntimeState>,
}
