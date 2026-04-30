#[derive(Debug, Clone, Default)]
pub struct ReminderRuntimeState {
    pub mandatory_mode_active: bool,
    pub active_session_id: Option<String>,
    pub next_trigger_at_ms: Option<i64>,
    pub focus_guard_running: bool,
    pub locked_rect: Option<(i32, i32, u32, u32)>,
    pub primary_center_in_window: Option<(f64, f64)>,
}
