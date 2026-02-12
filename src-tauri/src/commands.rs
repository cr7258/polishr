#[cfg(target_os = "macos")]
use crate::ax_text;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

static CACHED_CAPTURE: Mutex<Option<CaptureResult>> = Mutex::new(None);

#[derive(Debug, Serialize, Clone)]
pub struct CaptureResult {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub line_start_x: Option<f64>,
}

pub fn cache_capture(result: Option<CaptureResult>) {
    let mut cached = CACHED_CAPTURE.lock().unwrap();
    *cached = result;
}

pub fn get_cached_capture() -> Option<CaptureResult> {
    let cached = CACHED_CAPTURE.lock().unwrap();
    cached.clone()
}

pub fn show_main_panel(app: &AppHandle, result: &CaptureResult) {
    if let Some(trigger_window) = app.get_webview_window("trigger") {
        let _ = trigger_window.hide();
    }

    if let Some(main_window) = app.get_webview_window("main") {
        let panel_height = 197.0_f64; // matches tauri.conf.json
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
        let _ = main_window.set_position(tauri::Position::Logical(pos));
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}

/// Check if the app has accessibility permission (macOS only).
#[tauri::command]
pub async fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        ax_text::is_accessibility_granted()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

pub fn capture_and_locate_sync() -> Result<CaptureResult, String> {
    #[cfg(target_os = "macos")]
    {
        let result = ax_text::capture_selection_ax()?;
        normalize_capture(result, true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not implemented on this platform".to_string())
    }
}

pub fn peek_and_locate_sync() -> Result<CaptureResult, String> {
    #[cfg(target_os = "macos")]
    {
        let result = ax_text::peek_selection_ax()?;
        // Trigger window must stay attached to real selection bounds.
        // If bounds are unavailable, don't fall back to mouse position.
        normalize_capture(result, false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not implemented on this platform".to_string())
    }
}

#[cfg(target_os = "macos")]
fn normalize_capture(
    result: ax_text::CaptureResult,
    allow_mouse_fallback: bool,
) -> Result<CaptureResult, String> {
    // Prefer true selection bounds for stable positioning.
    let (x, y, w, h) = match &result.bounds {
        Some(b) if b.width > 1.0 => (b.x, b.y, b.width, b.height),
        _ => {
            if !allow_mouse_fallback {
                return Err("no_selection_bounds".to_string());
            }
            let (mx, my) = ax_text::get_mouse_position();
            println!("[Polishr] Bounds invalid, using mouse position ({}, {})", mx, my);
            (mx, my, 0.0, 20.0)
        }
    };

    Ok(CaptureResult {
        text: result.text,
        x,
        y,
        width: w,
        height: h,
        line_start_x: result.line_start_x,
    })
}

/// Capture selected text and its screen position from the focused element.
/// The focused element and app name are stored internally for later use by `replace_text`.
#[tauri::command]
pub async fn capture_and_locate() -> Result<CaptureResult, String> {
    match capture_and_locate_sync() {
        Ok(result) => {
            cache_capture(Some(result.clone()));
            Ok(result)
        }
        Err(err) => {
            cache_capture(None);
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn open_main_from_cached_selection(app: AppHandle) -> Result<(), String> {
    let result = get_cached_capture()
        .ok_or_else(|| "no_cached_selection".to_string())?;

    show_main_panel(&app, &result);
    let _ = app.emit("selection-captured", result);
    Ok(())
}

/// Replace the selected text in the original application.
/// Uses clipboard + paste approach which works universally across all apps.
#[tauri::command]
pub async fn replace_text(text: String) -> Result<(), String> {
    println!("[Polishr] replace_text called with {} chars", text.len());

    #[cfg(target_os = "macos")]
    {
        ax_text::replace_via_clipboard(&text).map_err(|e| {
            println!("[Polishr] Replace failed: {}", e);
            e
        })?;
        println!("[Polishr] Replace succeeded");
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not implemented on this platform".to_string())
    }
}

/// Clear the stored element reference (called on dismiss).
#[tauri::command]
pub async fn dismiss() {
    println!("[Polishr] dismiss: clearing stored capture");
    #[cfg(target_os = "macos")]
    ax_text::clear_stored_element();
}
