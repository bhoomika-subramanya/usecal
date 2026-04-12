use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};
use serde_json;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_active_window,
            commands::capture_screenshot,
            commands::check_accessibility_permission,
            commands::open_accessibility_settings,
            commands::write_native_tag,
        ])
        .setup(|app| {
            setup_global_shortcut(app.handle())?;
            setup_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_global_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // Ctrl+Shift+L on Windows/Linux, Cmd+Shift+L on macOS
    #[cfg(target_os = "macos")]
    let shortcut = "Cmd+Shift+L";
    #[cfg(not(target_os = "macos"))]
    let shortcut = "Ctrl+Shift+L";

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_popup(&app_handle);
            }
        })?;

    Ok(())
}

fn toggle_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("popup") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // Capture the frontmost window BEFORE we steal focus by showing our popup.
            // This gives the frontend accurate source context.
            let source = commands::get_frontmost_window();

            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();

            // Emit event so the frontend can refresh state and re-focus textarea.
            let payload = serde_json::json!({
                "sourceApp": source.as_ref().map(|i| i.app.as_str()),
                "sourceWindowTitle": source.as_ref().map(|i| i.title.as_str()),
            });
            let _ = window.emit("popup-shown", payload);
        }
    }
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "Show Popup").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

    let app_handle = app.clone();
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |_tray, event| match event.id().as_ref() {
            "show" => toggle_popup(&app_handle),
            "quit" => std::process::exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
