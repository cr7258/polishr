#[cfg(target_os = "macos")]
use crate::ax_text;

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct CaptureResult {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
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

/// Capture selected text and its screen position from the focused element.
/// The focused element and app name are stored internally for later use by `replace_text`.
#[tauri::command]
pub async fn capture_and_locate() -> Result<CaptureResult, String> {
    #[cfg(target_os = "macos")]
    {
        let result = ax_text::capture_selection_ax()?;

        // Use bounds if valid (width > 0), otherwise fall back to mouse position
        let (x, y, w, h) = match &result.bounds {
            Some(b) if b.width > 1.0 => (b.x, b.y, b.width, b.height),
            _ => {
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
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not implemented on this platform".to_string())
    }
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
