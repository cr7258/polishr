#[cfg(target_os = "macos")]
mod ax_text;
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
                    if event.state == ShortcutState::Pressed {
                        println!("[Polishr] Cmd+Option+P pressed!");
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            match commands::capture_and_locate().await {
                                Ok(result) => {
                                    println!(
                                        "[Polishr] Captured {} chars at ({}, {})",
                                        result.text.len(),
                                        result.x,
                                        result.y
                                    );

                                    // Position the floating panel ABOVE the selection
                                    if let Some(window) = handle.get_webview_window("main") {
                                        let panel_height = 300.0_f64; // matches tauri.conf.json
                                        let panel_x = result.x;
                                        // Place above: selection top - panel height - gap
                                        let panel_y = result.y - panel_height - 8.0;
                                        // If that would go off the top of the screen, place below instead
                                        let panel_y = if panel_y < 0.0 {
                                            result.y + result.height + 8.0
                                        } else {
                                            panel_y
                                        };

                                        let pos = tauri::LogicalPosition::new(panel_x, panel_y);
                                        let _ = window.set_position(tauri::Position::Logical(pos));
                                        let _ = window.show();
                                        // NOTE: Do NOT call set_focus() here — keep the original app
                                        // focused so it retains the text selection. The user can
                                        // click on the panel when ready (which will naturally focus it).
                                    }

                                    let _ = handle.emit("selection-captured", result);
                                }
                                Err(err) => {
                                    println!("[Polishr] Capture failed: {}", err);
                                    let _ = handle.emit("capture-error", err.clone());
                                    // Still show the window at a reasonable position
                                    if let Some(window) = handle.get_webview_window("main") {
                                        let _ = window.center();
                                        let _ = window.show();
                                    }
                                }
                            }
                        });
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            println!("[Polishr] App started. Global shortcut: Cmd+Option+P");

            // Create system tray
            tray::create_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_and_locate,
            commands::replace_text,
            commands::dismiss,
            commands::check_accessibility_permission,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Polishr");
}
