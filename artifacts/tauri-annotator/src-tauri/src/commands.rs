use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActiveWindowInfo {
    pub app: String,
    pub title: String,
}

/// Synchronous helper used by both the Tauri command and toggle_popup (lib.rs).
pub fn get_frontmost_window() -> Option<ActiveWindowInfo> {
    #[cfg(target_os = "macos")]
    return get_active_window_macos().ok().flatten();

    #[cfg(target_os = "windows")]
    return get_active_window_windows().ok().flatten();

    #[cfg(target_os = "linux")]
    return get_active_window_linux().ok().flatten();

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    None
}

/// Returns the name and title of the currently active (focused) window
/// before our popup stole focus.
#[tauri::command]
pub async fn get_active_window() -> Result<Option<ActiveWindowInfo>, String> {
    Ok(get_frontmost_window())
}

#[cfg(target_os = "macos")]
fn get_active_window_macos() -> Result<Option<ActiveWindowInfo>, String> {
    use std::process::Command;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(
            r#"
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                set appName to name of frontApp
                try
                    set windowTitle to name of first window of frontApp
                on error
                    set windowTitle to ""
                end try
                return appName & "|" & windowTitle
            end tell
            "#,
        )
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || !output.status.success() {
        return Ok(None);
    }

    let parts: Vec<&str> = stdout.splitn(2, '|').collect();
    Ok(Some(ActiveWindowInfo {
        app: parts.first().unwrap_or(&"").trim().to_string(),
        title: parts.get(1).unwrap_or(&"").trim().to_string(),
    }))
}

#[cfg(target_os = "windows")]
fn get_active_window_windows() -> Result<Option<ActiveWindowInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextW(hwnd: isize, lpstring: *mut u16, nmaxcount: i32) -> i32;
        fn GetWindowThreadProcessId(hwnd: isize, lpdwprocessid: *mut u32) -> u32;
        fn OpenProcess(dwdesiredaccess: u32, binherithandle: i32, dwprocessid: u32) -> isize;
        fn CloseHandle(hobject: isize) -> i32;
        fn QueryFullProcessImageNameW(
            hprocess: isize,
            dwflags: u32,
            lpexename: *mut u16,
            lpdwsize: *mut u32,
        ) -> i32;
    }

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return Ok(None);
        }

        let mut title_buf = vec![0u16; 256];
        let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
        let title = OsString::from_wide(&title_buf[..title_len as usize])
            .to_string_lossy()
            .to_string();

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let process_handle = OpenProcess(0x1000, 0, pid);
        let app = if process_handle != 0 {
            let mut path_buf = vec![0u16; 512];
            let mut path_len = path_buf.len() as u32;
            QueryFullProcessImageNameW(process_handle, 0, path_buf.as_mut_ptr(), &mut path_len);
            CloseHandle(process_handle);
            let full_path = OsString::from_wide(&path_buf[..path_len as usize])
                .to_string_lossy()
                .to_string();
            std::path::Path::new(&full_path)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or(full_path)
        } else {
            "Unknown".to_string()
        };

        Ok(Some(ActiveWindowInfo { app, title }))
    }
}

#[cfg(target_os = "linux")]
fn get_active_window_linux() -> Result<Option<ActiveWindowInfo>, String> {
    use std::process::Command;

    let wid = Command::new("xdotool")
        .args(["getactivewindow"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok());

    if let Some(wid) = wid {
        let title = Command::new("xdotool")
            .args(["getwindowname", &wid.to_string()])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let pid_str = Command::new("xdotool")
            .args(["getwindowpid", &wid.to_string()])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let app = Command::new("cat")
            .arg(format!("/proc/{}/comm", pid_str))
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|_| "Unknown".to_string());

        return Ok(Some(ActiveWindowInfo { app, title }));
    }

    Ok(None)
}

// ── Accessibility permission ─────────────────────────────────────────────────

/// On macOS: returns true if Accessibility permission is granted.
/// On all other platforms: always returns true (not needed).
#[tauri::command]
pub fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        unsafe { AXIsProcessTrusted() }
    }
    #[cfg(not(target_os = "macos"))]
    true
}

/// Opens the system accessibility settings panel.
#[tauri::command]
pub async fn open_accessibility_settings(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    #[cfg(target_os = "macos")]
    app.shell()
        .open(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            None,
        )
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    app.shell()
        .open("ms-settings:privacy-accessibilityonboard", None)
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    {
        let _ = app;
    }

    Ok(())
}

// ── Screenshot capture ────────────────────────────────────────────────────────

/// Captures the primary screen and returns a base64-encoded PNG data URL
#[tauri::command]
pub async fn capture_screenshot() -> Result<String, String> {
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.into_iter().next().ok_or("No screens found")?;
    let image = screen.capture().map_err(|e| e.to_string())?;
    let png_data = image.to_png(None).map_err(|e| e.to_string())?;

    let mut out = String::from("data:image/png;base64,");
    out.push_str(&base64_encode(&png_data));
    Ok(out)
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        result.push(CHARS[(b0 >> 2) & 0x3F] as char);
        result.push(CHARS[((b0 << 4) | (b1 >> 4)) & 0x3F] as char);
        result.push(if chunk.len() > 1 {
            CHARS[((b1 << 2) | (b2 >> 6)) & 0x3F] as char
        } else {
            '='
        });
        result.push(if chunk.len() > 2 {
            CHARS[b2 & 0x3F] as char
        } else {
            '='
        });
    }
    result
}
