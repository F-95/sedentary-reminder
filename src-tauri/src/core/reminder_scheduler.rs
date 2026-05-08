#[derive(Debug, Clone, Default)]
pub struct ReminderRuntimeState {
    pub reminder_enabled: bool,
    pub mandatory_mode_active: bool,
    pub active_session_id: Option<String>,
    pub next_trigger_at_ms: Option<i64>,
    pub next_trigger_label: Option<String>,
    pub focus_guard_running: bool,
    pub locked_rect: Option<(i32, i32, u32, u32)>,
    pub primary_center_in_window: Option<(f64, f64)>,
}

/// 中文注释：将前端计算后的「下一次触发」写入运行时镜像（第二版免打扰推迟后时刻仍由此入口同步，后端不解析配置）。
pub fn apply_next_trigger_mirror(
    state: &mut ReminderRuntimeState,
    trigger_at_ms: Option<i64>,
    trigger_label: Option<String>,
) {
    state.next_trigger_at_ms = trigger_at_ms;
    state.next_trigger_label = trigger_label;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_next_trigger_mirror_writes_both_fields() {
        let mut s = ReminderRuntimeState::default();
        apply_next_trigger_mirror(&mut s, Some(1_700_000_000_000), Some("14:45".into()));
        assert_eq!(s.next_trigger_at_ms, Some(1_700_000_000_000));
        assert_eq!(s.next_trigger_label.as_deref(), Some("14:45"));
    }

    #[test]
    fn apply_next_trigger_mirror_clears_with_none() {
        let mut s = ReminderRuntimeState::default();
        apply_next_trigger_mirror(&mut s, Some(100), Some("x".into()));
        apply_next_trigger_mirror(&mut s, None, None);
        assert_eq!(s.next_trigger_at_ms, None);
        assert_eq!(s.next_trigger_label, None);
    }
}
