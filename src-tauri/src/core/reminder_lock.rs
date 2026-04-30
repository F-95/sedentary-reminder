#[cfg(target_os = "windows")]
pub fn lock_screen() -> Result<(), String> {
    std::process::Command::new("rundll32.exe")
        .arg("user32.dll,LockWorkStation")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("锁屏调用失败: {error}"))
}

#[cfg(not(target_os = "windows"))]
pub fn lock_screen() -> Result<(), String> {
    Err("当前平台暂不支持锁屏命令".to_string())
}
