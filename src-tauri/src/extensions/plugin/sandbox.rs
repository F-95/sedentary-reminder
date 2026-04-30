use crate::extensions::plugin::permission::Permission;

pub fn check_permission(allowed: &[Permission], target: &Permission) -> bool {
    allowed.iter().any(|item| item == target)
}
