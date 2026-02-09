mod commands;
mod tray;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["alt+super+KeyP"])
                .expect("Failed to register shortcuts")
                .with_handler(|app, _shortcut, event| {
                    // We only registered one shortcut, so any event is Cmd+Option+P
                    if event.state == ShortcutState::Pressed {
                        println!("[Polishr] Cmd+Option+P pressed! Capturing selection...");
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            match commands::capture_selection(handle.clone()).await {
                                Ok(text) => {
                                    println!("[Polishr] Selection captured: {} chars", text.len());
                                    let _ = handle.emit("selection-captured", text);
                                }
                                Err(err) => {
                                    println!("[Polishr] Failed to capture selection: {}", err);
                                    // Emit error event so frontend can handle it
                                    let _ = handle.emit("capture-error", err.clone());
                                    // Show the window
                                    if let Some(window) = handle.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.unminimize();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        });
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            println!("[Polishr] App started. Global shortcut: Cmd+Option+P (macOS) / Ctrl+Alt+P (Win/Linux)");

            // Create system tray
            tray::create_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_selection,
            commands::replace_selection,
            commands::check_accessibility_permission,
        ])
        .on_window_event(|window, event| {
            // Minimize to tray on close instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Polishr");
}
