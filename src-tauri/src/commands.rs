use std::thread;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

// Direct FFI binding to macOS Accessibility API
#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "macos")]
fn is_accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
fn is_accessibility_granted() -> bool {
    true
}

/// Check if the app has accessibility permission (macOS only).
#[tauri::command]
pub async fn check_accessibility_permission() -> bool {
    is_accessibility_granted()
}

/// Capture the currently selected text from any application.
#[tauri::command]
pub async fn capture_selection(app: tauri::AppHandle) -> Result<String, String> {
    // 0. Check accessibility permission first
    if !is_accessibility_granted() {
        println!("[Polishr] Accessibility permission NOT granted");
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return Err("accessibility_denied".to_string());
    }

    println!("[Polishr] Accessibility permission OK, proceeding with capture");

    // 1. Save current clipboard
    println!("[Polishr] Step 1: Reading clipboard...");
    let original_clipboard = app.clipboard().read_text().unwrap_or_default();
    println!("[Polishr] Step 1 done: clipboard has {} chars", original_clipboard.len());

    // 2. Clear clipboard so we can detect if copy succeeded
    println!("[Polishr] Step 2: Clearing clipboard...");
    let _ = app.clipboard().write_text(String::new());
    println!("[Polishr] Step 2 done");

    // 3. Wait a bit for modifier keys (Cmd+Option) from the hotkey to be released
    println!("[Polishr] Step 3: Waiting for modifier keys to release...");
    thread::sleep(Duration::from_millis(100));
    println!("[Polishr] Step 3 done");

    // 4. Simulate Cmd+C
    println!("[Polishr] Step 4: Simulating Cmd+C...");
    simulate_copy().map_err(|e| {
        println!("[Polishr] simulate_copy failed: {}", e);
        format!("Failed to simulate copy: {}", e)
    })?;

    println!("[Polishr] Step 4 done: Cmd+C simulated, waiting for clipboard...");

    // 5. Wait for clipboard to update
    thread::sleep(Duration::from_millis(200));

    // 6. Read the selected text from clipboard
    let selected_text = app
        .clipboard()
        .read_text()
        .map_err(|e| format!("Failed to read clipboard: {}", e))?;

    // 7. Restore original clipboard
    let _ = app.clipboard().write_text(original_clipboard);

    if selected_text.trim().is_empty() {
        // No text was selected, still show the window for manual input
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return Err("no_selection".to_string());
    }

    // 8. Show and focus the window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    println!(
        "[Polishr] Selection captured successfully: {} chars",
        selected_text.len()
    );
    Ok(selected_text)
}

/// Replace the selected text in the original application with polished text.
#[tauri::command]
pub async fn replace_selection(app: tauri::AppHandle, text: String) -> Result<(), String> {
    println!("[Polishr] replace_selection called with {} chars", text.len());

    if !is_accessibility_granted() {
        println!("[Polishr] Replace: accessibility denied");
        return Err("accessibility_denied".to_string());
    }

    // 1. Write polished text to clipboard
    println!("[Polishr] Replace step 1: Writing to clipboard...");
    app.clipboard()
        .write_text(&text)
        .map_err(|e| format!("Failed to write clipboard: {}", e))?;
    println!("[Polishr] Replace step 1 done");

    // 2. Hide Polishr window so focus returns to original app
    println!("[Polishr] Replace step 2: Hiding window...");
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    // 3. Wait for the original app to regain focus
    println!("[Polishr] Replace step 3: Waiting for focus to return...");
    thread::sleep(Duration::from_millis(500));
    println!("[Polishr] Replace step 3 done");

    // 4. Simulate Cmd+V to paste
    println!("[Polishr] Replace step 4: Simulating Cmd+V...");
    simulate_paste().map_err(|e| {
        println!("[Polishr] Replace: simulate_paste failed: {}", e);
        format!("Failed to simulate paste: {}", e)
    })?;
    println!("[Polishr] Replace step 4 done - paste simulated");

    Ok(())
}

/// Simulate Cmd+C (macOS) or Ctrl+C (others) using platform-native methods.
/// Uses osascript on macOS to avoid enigo crashes.
fn simulate_copy() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("osascript")
            .arg("-e")
            .arg(r#"tell application "System Events" to keystroke "c" using command down"#)
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("osascript failed: {}", stderr));
        }
        println!("[Polishr] osascript Cmd+C succeeded");
    }

    #[cfg(not(target_os = "macos"))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to create Enigo: {}", e))?;
        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(20));
        enigo
            .key(Key::Unicode('c'), Direction::Click)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(20));
        enigo
            .key(Key::Control, Direction::Release)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Simulate Cmd+V (macOS) or Ctrl+V (others) using platform-native methods.
fn simulate_paste() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("osascript")
            .arg("-e")
            .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("osascript failed: {}", stderr));
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to create Enigo: {}", e))?;
        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(20));
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(20));
        enigo
            .key(Key::Control, Direction::Release)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
