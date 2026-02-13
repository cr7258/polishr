#[cfg(target_os = "macos")]
mod ax_text;
mod commands;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

/// Suppresses the next Reopen event (set when floating panel hides programmatically).
static SUPPRESS_REOPEN: AtomicBool = AtomicBool::new(false);

const TRIGGER_SELECTION_WIDTH: f64 = 16.0;
const TRIGGER_PARAGRAPH_WIDTH: f64 = 4.0;
const TRIGGER_MIN_HEIGHT: f64 = 16.0;
const TRIGGER_WINDOW_GAP: f64 = 12.0;
const SCREEN_EDGE_PADDING: f64 = 4.0;

/// The two modes the trigger window can be in.
#[derive(Debug, Clone, Copy, PartialEq)]
enum TriggerMode {
    /// Blue button — user has selected text.
    Selection,
    /// Gray line — cursor is in a paragraph but no selection.
    Paragraph,
}

#[cfg(target_os = "macos")]
fn start_selection_trigger_poller(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut pinned_selection: Option<(usize, f64, f64, f64, f64, f64)> = None;
        let mut pinned_button: Option<(f64, f64, f64)> = None; // (x, y, height)
        let mut current_mode: Option<TriggerMode> = None;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(350));

            let Some(trigger_window) = app.get_webview_window("trigger") else {
                continue;
            };

            let main_is_visible = app
                .get_webview_window("main")
                .and_then(|window| window.is_visible().ok())
                .unwrap_or(false);
            let settings_is_focused = app
                .get_webview_window("settings")
                .and_then(|window| window.is_focused().ok())
                .unwrap_or(false);
            let trigger_is_focused = trigger_window.is_focused().unwrap_or(false);

            if main_is_visible || settings_is_focused {
                let _ = trigger_window.hide();
                pinned_selection = None;
                pinned_button = None;
                current_mode = None;
                continue;
            }
            if trigger_is_focused {
                continue;
            }

            // --- Try selection mode first ---
            match commands::peek_and_locate_sync() {
                Ok(result) => {
                    commands::cache_capture(Some(result.clone()));
                    commands::cache_paragraph(None);

                    let trigger_width = TRIGGER_SELECTION_WIDTH;
                    let line_anchor_x = result.line_start_x.unwrap_or(result.x);
                    let button_x =
                        (line_anchor_x - trigger_width - TRIGGER_WINDOW_GAP).max(SCREEN_EDGE_PADDING);
                    let trigger_height = result.height.max(TRIGGER_MIN_HEIGHT);
                    let button_y =
                        (result.y + (result.height - trigger_height) / 2.0).max(SCREEN_EDGE_PADDING);

                    let selection_changed = match pinned_selection {
                        Some((text_len, x, y, width, height, anchor_x)) => {
                            text_len != result.text.len()
                                || (x - result.x).abs() > 0.5
                                || (y - result.y).abs() > 0.5
                                || (width - result.width).abs() > 0.5
                                || (height - result.height).abs() > 0.5
                                || (anchor_x - line_anchor_x).abs() > 0.5
                        }
                        None => true,
                    };

                    if selection_changed {
                        if let Err(err) = ax_text::cache_frontmost_app_for_replace() {
                            println!("[Polishr] Failed to cache frontmost app for replace: {}", err);
                        }
                        pinned_selection = Some((
                            result.text.len(),
                            result.x,
                            result.y,
                            result.width,
                            result.height,
                            line_anchor_x,
                        ));
                    }

                    // Emit mode change to frontend
                    if current_mode != Some(TriggerMode::Selection) {
                        current_mode = Some(TriggerMode::Selection);
                        let _ = app.emit_to("trigger", "trigger-mode", "selection");
                    }

                    let button_changed = match pinned_button {
                        Some((x, y, h)) => {
                            (x - button_x).abs() > 0.5
                                || (y - button_y).abs() > 0.5
                                || (h - trigger_height).abs() > 0.5
                        }
                        None => true,
                    };

                    if button_changed {
                        let size = tauri::LogicalSize::new(trigger_width, trigger_height);
                        let _ = trigger_window.set_size(tauri::Size::Logical(size));
                        let pos = tauri::LogicalPosition::new(button_x, button_y);
                        let _ = trigger_window.set_position(tauri::Position::Logical(pos));
                        pinned_button = Some((button_x, button_y, trigger_height));
                    }
                    let _ = trigger_window.show();
                }
                Err(_err) => {
                    commands::cache_capture(None);
                    pinned_selection = None;

                    // --- Fallback: try paragraph mode ---
                    match commands::peek_paragraph_sync() {
                        Ok(para) => {
                            commands::cache_paragraph(Some(para.clone()));

                            // Paragraph mode: thin 4px line
                            let trigger_width = TRIGGER_PARAGRAPH_WIDTH;
                            let line_anchor_x = para.line_start_x.unwrap_or(para.x);
                            let button_x =
                                (line_anchor_x - trigger_width - TRIGGER_WINDOW_GAP).max(SCREEN_EDGE_PADDING);
                            let trigger_height = para.height.max(TRIGGER_MIN_HEIGHT);
                            let button_y =
                                (para.y + (para.height - trigger_height) / 2.0).max(SCREEN_EDGE_PADDING);

                            // Emit mode change to frontend
                            if current_mode != Some(TriggerMode::Paragraph) {
                                current_mode = Some(TriggerMode::Paragraph);
                                let _ = app.emit_to("trigger", "trigger-mode", "paragraph");
                            }

                            let button_changed = match pinned_button {
                                Some((x, y, h)) => {
                                    (x - button_x).abs() > 0.5
                                        || (y - button_y).abs() > 0.5
                                        || (h - trigger_height).abs() > 0.5
                                }
                                None => true,
                            };

                            if button_changed {
                                let size = tauri::LogicalSize::new(trigger_width, trigger_height);
                                let _ = trigger_window.set_size(tauri::Size::Logical(size));
                                let pos = tauri::LogicalPosition::new(button_x, button_y);
                                let _ = trigger_window.set_position(tauri::Position::Logical(pos));
                                pinned_button = Some((button_x, button_y, trigger_height));
                            }
                            let _ = trigger_window.show();
                        }
                        Err(_) => {
                            // No selection and no paragraph — hide everything
                            commands::cache_paragraph(None);
                            pinned_button = None;
                            current_mode = None;
                            let _ = trigger_window.hide();
                        }
                    }
                }
            }
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn start_selection_trigger_poller(_app: tauri::AppHandle) {}

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
                                    commands::show_main_panel(&handle, &result);
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
            start_selection_trigger_poller(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_and_locate,
            commands::open_main_from_cached_selection,
            commands::select_paragraph_and_open,
            commands::expand_trigger,
            commands::shrink_trigger,
            commands::replace_text,
            commands::dismiss,
            commands::check_accessibility_permission,
        ])
        .on_window_event(|window, event| {
            let label = window.label();
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                tauri::WindowEvent::Focused(false) if label == "main" => {
                    // Auto-dismiss floating panel on blur.
                    // Suppress the Reopen event that macOS fires when all windows are hidden.
                    SUPPRESS_REOPEN.store(true, Ordering::SeqCst);
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Polishr")
        .run(|app, event| {
            if let tauri::RunEvent::Reopen { .. } = event {
                // If suppressed (floating panel just hid), skip this one
                if SUPPRESS_REOPEN.swap(false, Ordering::SeqCst) {
                    return;
                }
                // User clicked the Dock icon — open desktop settings
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });
}
