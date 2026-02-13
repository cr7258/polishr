#[cfg(target_os = "macos")]
use crate::ax_text;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

static CACHED_CAPTURE: Mutex<Option<CaptureResult>> = Mutex::new(None);
static CACHED_PARAGRAPH: Mutex<Option<ParagraphInfo>> = Mutex::new(None);

#[derive(Debug, Serialize, Clone)]
pub struct CaptureResult {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub line_start_x: Option<f64>,
}

/// Cached paragraph info for the "select paragraph and open" flow.
#[derive(Debug, Clone)]
pub struct ParagraphInfo {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub line_start_x: Option<f64>,
    pub range_location: isize,
    pub range_length: isize,
}

pub fn cache_capture(result: Option<CaptureResult>) {
    let mut cached = CACHED_CAPTURE.lock().unwrap();
    *cached = result;
}

pub fn get_cached_capture() -> Option<CaptureResult> {
    let cached = CACHED_CAPTURE.lock().unwrap();
    cached.clone()
}

pub fn cache_paragraph(info: Option<ParagraphInfo>) {
    let mut cached = CACHED_PARAGRAPH.lock().unwrap();
    *cached = info;
}

fn get_cached_paragraph() -> Option<ParagraphInfo> {
    let cached = CACHED_PARAGRAPH.lock().unwrap();
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

pub fn peek_paragraph_sync() -> Result<ParagraphInfo, String> {
    #[cfg(target_os = "macos")]
    {
        let result = ax_text::peek_paragraph_ax()?;
        let (x, y, w, h) = match &result.bounds {
            Some(b) if b.height > 1.0 => (b.x, b.y, b.width, b.height),
            _ => return Err("no_paragraph_bounds".to_string()),
        };

        Ok(ParagraphInfo {
            text: result.text,
            x,
            y,
            width: w,
            height: h,
            line_start_x: result.line_start_x,
            range_location: result.range_location,
            range_length: result.range_length,
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not implemented on this platform".to_string())
    }
}

/// Select the cached paragraph text and open the main panel.
#[tauri::command]
pub async fn select_paragraph_and_open(app: AppHandle) -> Result<(), String> {
    let para = get_cached_paragraph()
        .ok_or_else(|| "no_cached_paragraph".to_string())?;

    // Cache frontmost app for later replacement
    #[cfg(target_os = "macos")]
    {
        if let Err(err) = ax_text::cache_frontmost_app_for_replace() {
            println!("[Polishr] Failed to cache frontmost app: {}", err);
        }
    }

    // Select the paragraph text in the source app
    #[cfg(target_os = "macos")]
    ax_text::select_text_range(para.range_location, para.range_length)?;

    // Build a CaptureResult from the paragraph info
    let capture = CaptureResult {
        text: para.text,
        x: para.x,
        y: para.y,
        width: para.width,
        height: para.height,
        line_start_x: para.line_start_x,
    };

    cache_capture(Some(capture.clone()));
    show_main_panel(&app, &capture);
    let _ = app.emit("selection-captured", capture);
    Ok(())
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

/// Generation counter: bumped each time a new animation starts, so stale animations stop.
static TRIGGER_ANIM_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Animate the trigger window width from current to target, expanding/shrinking from center.
fn animate_trigger_width(app: &AppHandle, target_w: f64) {
    // Bump generation so any running animation stops at its next iteration.
    let gen = TRIGGER_ANIM_GEN.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;

    let app = app.clone();
    std::thread::spawn(move || {
        const STEPS: usize = 8;
        const STEP_MS: u64 = 30;

        let Some(win) = app.get_webview_window("trigger") else { return; };
        let Ok(size) = win.inner_size() else { return; };
        let scale = win.scale_factor().unwrap_or(1.0);
        let start_w = size.width as f64 / scale;
        let logical_h = size.height as f64 / scale;
        let Ok(start_pos) = win.outer_position() else { return; };
        let start_x = start_pos.x as f64 / scale;
        let start_y = start_pos.y as f64 / scale;

        for i in 1..=STEPS {
            // If a newer animation started, abort this one.
            if TRIGGER_ANIM_GEN.load(std::sync::atomic::Ordering::SeqCst) != gen {
                return;
            }
            let t = i as f64 / STEPS as f64;
            // Ease-out: t' = 1 - (1 - t)^2
            let t_ease = 1.0 - (1.0 - t) * (1.0 - t);
            let w = start_w + (target_w - start_w) * t_ease;
            let x = start_x - (w - start_w) / 2.0;

            let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(w, logical_h)));
            let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, start_y)));

            std::thread::sleep(std::time::Duration::from_millis(STEP_MS));
        }
    });
}

/// Expand the trigger window width (paragraph hover).
#[tauri::command]
pub async fn expand_trigger(app: AppHandle) {
    animate_trigger_width(&app, 16.0);
}

/// Shrink the trigger window width back to paragraph line.
#[tauri::command]
pub async fn shrink_trigger(app: AppHandle) {
    animate_trigger_width(&app, 4.0);
}

/// Clear the stored element reference (called on dismiss).
#[tauri::command]
pub async fn dismiss() {
    println!("[Polishr] dismiss: clearing stored capture");
    #[cfg(target_os = "macos")]
    ax_text::clear_stored_element();
}
