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
    #[cfg(target_os = "macos")]
    {
        use tauri_plugin_shell::ShellExt;
        app.shell()
            .open(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
                None,
            )
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use tauri_plugin_shell::ShellExt;
        app.shell()
            .open("ms-settings:privacy-accessibilityonboard", None)
            .map_err(|e| e.to_string())?;
    }

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
    use screenshots::image::{DynamicImage, ImageFormat};
    use std::io::Cursor;

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.into_iter().next().ok_or("No screens found")?;
    let image = screen.capture().map_err(|e| e.to_string())?;

    let mut png_data: Vec<u8> = Vec::new();
    DynamicImage::ImageRgba8(image)
        .write_to(&mut Cursor::new(&mut png_data), ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let mut out = String::from("data:image/png;base64,");
    out.push_str(&base64_encode(&png_data));
    Ok(out)
}

// ── Native OS tag writing ─────────────────────────────────────────────────────

/// Writes a tag to the file/folder using the native OS metadata store.
///
/// • macOS  – `com.apple.metadata:_kMDItemUserTags` (xattr, binary plist)
/// • Windows – Windows.Storage WinRT via PowerShell
/// • Linux  – `user.xdg.tags` (xattr, comma-separated)
#[tauri::command]
pub async fn write_native_tag(
    local_file_path: String,
    tag_name: String,
    color: Option<String>,
) -> Result<(), String> {
    if local_file_path.trim().is_empty() {
        return Err("No file path provided".to_string());
    }
    if tag_name.trim().is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    #[cfg(target_os = "macos")]
    return write_tag_macos(&local_file_path, &tag_name, color.as_deref());

    #[cfg(target_os = "windows")]
    return write_tag_windows(&local_file_path, &tag_name);

    #[cfg(target_os = "linux")]
    return write_tag_linux(&local_file_path, &tag_name);

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    Err("Native tags not supported on this platform".to_string())
}

// ── macOS implementation ──────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn macos_color_index(color: Option<&str>) -> u8 {
    match color.map(|s| s.to_lowercase()).as_deref() {
        Some("gray") | Some("grey") => 1,
        Some("green") => 2,
        Some("purple") => 3,
        Some("blue") => 4,
        Some("yellow") => 5,
        Some("red") => 6,
        Some("orange") => 7,
        _ => 0,
    }
}

#[cfg(target_os = "macos")]
fn write_tag_macos(path: &str, tag: &str, color: Option<&str>) -> Result<(), String> {
    const ATTR: &str = "com.apple.metadata:_kMDItemUserTags";

    // Read existing tags (binary plist array of strings)
    let mut tags: Vec<String> = match xattr::get(path, ATTR).map_err(|e| e.to_string())? {
        Some(data) if !data.is_empty() => {
            plist::from_bytes::<Vec<String>>(&data).unwrap_or_default()
        }
        _ => vec![],
    };

    let color_idx = macos_color_index(color);

    // macOS tag format: "TagName\nColorIndex" (color 0 → no suffix needed)
    let tag_str = if color_idx > 0 {
        format!("{}\n{}", tag, color_idx)
    } else {
        tag.to_string()
    };

    // Deduplicate by name (ignore color differences)
    let already_exists = tags
        .iter()
        .any(|t| t.split('\n').next().unwrap_or("") == tag);

    if !already_exists {
        tags.push(tag_str);
    }

    // Encode as binary plist and write back
    let mut buf = Vec::new();
    plist::to_writer_binary(std::io::Cursor::new(&mut buf), &tags)
        .map_err(|e| e.to_string())?;

    xattr::set(path, ATTR, &buf).map_err(|e| e.to_string())?;

    Ok(())
}

// ── Windows implementation ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn write_tag_windows(path: &str, tag: &str) -> Result<(), String> {
    use std::process::Command;

    // Escape single quotes for PowerShell
    let safe_path = path.replace('\'', "''");
    let safe_tag = tag.replace('\'', "''");

    // Use WinRT Windows.Storage API (Windows 10+) via PowerShell
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
$filePath = '{path}'
$newTag   = '{tag}'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Helper to convert WinRT IAsyncOperation to .NET Task
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {{
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    }})[0]

function Await($winRtTask, $type) {{
    $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($winRtTask))
    $task.Wait(-1) | Out-Null
    $task.Result
}}

# Load WinRT types
$null = [Windows.Storage.StorageFile,         Windows.Storage,           ContentType=WindowsRuntime]
$null = [Windows.Storage.FileProperties.DocumentProperties,
         Windows.Storage.FileProperties, ContentType=WindowsRuntime]

$absPath = [System.IO.Path]::GetFullPath($filePath)
$file    = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($absPath)) ([Windows.Storage.StorageFile])
$props   = Await ($file.Properties.GetDocumentPropertiesAsync()) ([Windows.Storage.FileProperties.DocumentProperties])

if ($props.Keywords -notcontains $newTag) {{
    $props.Keywords.Add($newTag)
    Await ($props.SavePropertiesAsync()) ([System.Object]) | Out-Null
}}

Write-Host 'OK'
"#,
        path = safe_path,
        tag = safe_tag
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PowerShell tag error: {}", stderr.trim()))
    }
}

// ── Linux implementation ──────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn write_tag_linux(path: &str, tag: &str) -> Result<(), String> {
    const ATTR: &str = "user.xdg.tags";

    // Read existing tags (comma-separated plain text)
    let existing_raw = xattr::get(path, ATTR).map_err(|e| e.to_string())?;
    let existing_str = existing_raw
        .as_deref()
        .and_then(|b| std::str::from_utf8(b).ok())
        .unwrap_or("")
        .to_string();

    let mut tags: Vec<String> = existing_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if !tags.iter().any(|t| t == tag) {
        tags.push(tag.to_string());
    }

    let new_val = tags.join(",");
    xattr::set(path, ATTR, new_val.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
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
