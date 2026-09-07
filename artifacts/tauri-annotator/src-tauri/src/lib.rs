use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
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
            // Non-fatal: if another app owns the shortcut, the tray icon still works.
            if let Err(e) = setup_global_shortcut(app.handle()) {
                eprintln!("[annotator] global shortcut registration failed: {e}");
            }
            setup_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_global_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // Ctrl+Alt+L for annotation capture. Cmd+Option+L on macOS.
    // We register both; whichever succeeds first wins.
    #[cfg(target_os = "macos")]
    let shortcuts = ["Cmd+Option+L", "Cmd+Shift+Space"];
    #[cfg(not(target_os = "macos"))]
    let shortcuts = ["Ctrl+Alt+L", "Ctrl+Shift+Space"];

    let mut registered = false;
    for shortcut in shortcuts {
        let app_handle2 = app_handle.clone();
        match app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_popup(&app_handle2);
            }
        }) {
            Ok(_) => {
                eprintln!("[annotator] registered global shortcut: {shortcut}");
                registered = true;
                break;
            }
            Err(e) => eprintln!("[annotator] shortcut {shortcut} unavailable: {e}"),
        }
    }

    if !registered {
        eprintln!("[annotator] no global shortcut could be registered — use the tray icon");
    }

    Ok(())
}

fn toggle_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("popup") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // Capture the frontmost window BEFORE we steal focus by showing our popup.
            let source = commands::get_frontmost_window();

            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();

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

    let app_handle_menu = app.clone();
    let app_handle_click = app.clone();

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Universal Annotator — click to open")
        .on_menu_event(move |_tray, event| match event.id().as_ref() {
            "show" => toggle_popup(&app_handle_menu),
            "quit" => std::process::exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            // Left-click (or single tap on macOS) toggles the popup directly.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_popup(&app_handle_click);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;

    Ok(())
}
