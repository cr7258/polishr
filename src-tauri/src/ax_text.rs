//! macOS Accessibility API bindings for reading selected text
//! and getting the screen position of the text selection.
//!
//! Uses raw FFI to ApplicationServices.framework for capture,
//! and clipboard + osascript for replacement (universally reliable).

use std::ffi::c_void;
use std::process::Command;
use std::ptr;
use std::sync::Mutex;

use serde::Serialize;

// --- Core Foundation types ---

type CFTypeRef = *const c_void;
type CFStringRef = *const c_void;
type AXUIElementRef = CFTypeRef;
type AXValueRef = CFTypeRef;
type AXError = i32;

const K_AX_ERROR_SUCCESS: AXError = 0;
const K_AX_VALUE_CF_RANGE_TYPE: i32 = 4;

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct CGPoint {
    x: f64,
    y: f64,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct CGSize {
    width: f64,
    height: f64,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct CGRect {
    origin: CGPoint,
    size: CGSize,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct CFRange {
    location: isize,
    length: isize,
}

const K_AX_VALUE_CG_RECT_TYPE: i32 = 3;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXUIElementCreateSystemWide() -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementCopyParameterizedAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        parameter: CFTypeRef,
        result: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> AXError;
    fn AXValueCreate(value_type: i32, value_ptr: *const c_void) -> AXValueRef;
    fn AXValueGetValue(value: AXValueRef, value_type: i32, value_out: *mut c_void) -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRelease(cf: CFTypeRef);
    fn CFStringCreateWithCString(
        alloc: CFTypeRef,
        c_str: *const u8,
        encoding: u32,
    ) -> CFStringRef;
    fn CFStringGetLength(the_string: CFStringRef) -> i64;
    fn CFStringGetCString(
        the_string: CFStringRef,
        buffer: *mut u8,
        buffer_size: i64,
        encoding: u32,
    ) -> bool;
}

const K_CF_STRING_ENCODING_UTF8: u32 = 0x08000100;

// --- Stored app name for clipboard+paste replacement ---

static STORED_APP_NAME: Mutex<Option<String>> = Mutex::new(None);

fn store_app_name(name: Option<String>) {
    let mut stored = STORED_APP_NAME.lock().unwrap();
    *stored = name;
}

fn get_stored_app_name() -> Option<String> {
    let stored = STORED_APP_NAME.lock().unwrap();
    stored.clone()
}

/// Clear the stored state (e.g. on dismiss).
pub fn clear_stored_element() {
    let mut stored = STORED_APP_NAME.lock().unwrap();
    *stored = None;
}

/// Cache the current frontmost application for later replacement.
/// Intended for passive trigger flow where we avoid full capture.
pub fn cache_frontmost_app_for_replace() -> Result<(), String> {
    let app_name = get_frontmost_app_name()
        .ok_or_else(|| "no_frontmost_app".to_string())?;
    store_app_name(Some(app_name));
    Ok(())
}

// --- AX Attribute key helpers ---

fn ax_attr(name: &str) -> CFStringRef {
    let c_str = std::ffi::CString::new(name).unwrap();
    unsafe { CFStringCreateWithCString(ptr::null(), c_str.as_ptr() as *const u8, K_CF_STRING_ENCODING_UTF8) }
}

fn cfstring_to_rust(cf_str: CFStringRef) -> Option<String> {
    if cf_str.is_null() {
        return None;
    }
    unsafe {
        let len = CFStringGetLength(cf_str);
        let buf_size = (len * 4 + 1) as usize;
        let mut buf = vec![0u8; buf_size];
        let ok = CFStringGetCString(cf_str, buf.as_mut_ptr(), buf_size as i64, K_CF_STRING_ENCODING_UTF8);
        if ok {
            let nul_pos = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
            Some(String::from_utf8_lossy(&buf[..nul_pos]).to_string())
        } else {
            None
        }
    }
}

// --- Frontmost app & replacement helpers ---

/// Get the name of the frontmost application via osascript.
fn get_frontmost_app_name() -> Option<String> {
    let output = Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to get name of first application process whose frontmost is true"])
        .output()
        .ok()?;

    if output.status.success() {
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() { None } else { Some(name) }
    } else {
        None
    }
}

/// Activate an application by name via osascript.
fn activate_app(app_name: &str) -> Result<(), String> {
    let script = format!(
        "tell application \"{}\" to activate",
        app_name.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("osascript failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("activate_app failed: {}", stderr))
    }
}

/// Simulate Cmd+V (paste) via osascript.
fn simulate_paste() -> Result<(), String> {
    let output = Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to keystroke \"v\" using command down"])
        .output()
        .map_err(|e| format!("osascript failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("simulate_paste failed: {}", stderr))
    }
}

/// Set the system clipboard content via pbcopy.
fn set_clipboard(text: &str) -> Result<(), String> {
    use std::io::Write;
    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("pbcopy spawn failed: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("pbcopy write failed: {}", e))?;
    }

    let status = child.wait().map_err(|e| format!("pbcopy wait failed: {}", e))?;
    if status.success() {
        Ok(())
    } else {
        Err("pbcopy failed".to_string())
    }
}

// --- AX read helpers ---

/// Get the currently focused UI element via the system-wide accessibility element.
fn get_focused_element() -> Option<AXUIElementRef> {
    unsafe {
        let system_wide = AXUIElementCreateSystemWide();
        let attr = ax_attr("AXFocusedUIElement");
        let mut value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyAttributeValue(system_wide, attr, &mut value);
        CFRelease(attr);
        CFRelease(system_wide);
        if err == K_AX_ERROR_SUCCESS && !value.is_null() {
            Some(value)
        } else {
            None
        }
    }
}

/// Read the selected text from a UI element.
fn read_selected_text(element: AXUIElementRef) -> Option<String> {
    unsafe {
        let attr = ax_attr("AXSelectedText");
        let mut value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyAttributeValue(element, attr, &mut value);
        CFRelease(attr);
        if err == K_AX_ERROR_SUCCESS && !value.is_null() {
            let result = cfstring_to_rust(value as CFStringRef);
            CFRelease(value);
            return result;
        }
    }
    None
}

/// Read full text value from a UI element.
fn read_element_value_text(element: AXUIElementRef) -> Option<String> {
    unsafe {
        let attr = ax_attr("AXValue");
        let mut value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyAttributeValue(element, attr, &mut value);
        CFRelease(attr);
        if err == K_AX_ERROR_SUCCESS && !value.is_null() {
            let result = cfstring_to_rust(value as CFStringRef);
            CFRelease(value);
            return result;
        }
    }
    None
}

/// Read selected text range from a UI element.
fn get_selected_text_range(element: AXUIElementRef) -> Option<CFRange> {
    unsafe {
        let attr = ax_attr("AXSelectedTextRange");
        let mut value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyAttributeValue(element, attr, &mut value);
        CFRelease(attr);
        if err != K_AX_ERROR_SUCCESS || value.is_null() {
            return None;
        }

        let mut range = CFRange {
            location: 0,
            length: 0,
        };
        let ok = AXValueGetValue(
            value as AXValueRef,
            K_AX_VALUE_CF_RANGE_TYPE,
            &mut range as *mut CFRange as *mut c_void,
        );
        CFRelease(value);

        if ok { Some(range) } else { None }
    }
}

fn get_bounds_for_range(
    element: AXUIElementRef,
    location: isize,
    length: isize,
) -> Option<SelectionBounds> {
    unsafe {
        let range = CFRange { location, length };
        let range_value = AXValueCreate(
            K_AX_VALUE_CF_RANGE_TYPE,
            &range as *const CFRange as *const c_void,
        );
        if range_value.is_null() {
            return None;
        }

        let bounds_attr = ax_attr("AXBoundsForRange");
        let mut bounds_value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyParameterizedAttributeValue(
            element,
            bounds_attr,
            range_value,
            &mut bounds_value,
        );
        CFRelease(bounds_attr);
        CFRelease(range_value);

        if err != K_AX_ERROR_SUCCESS || bounds_value.is_null() {
            return None;
        }

        let mut rect = CGRect {
            origin: CGPoint { x: 0.0, y: 0.0 },
            size: CGSize { width: 0.0, height: 0.0 },
        };
        let ok = AXValueGetValue(
            bounds_value as AXValueRef,
            K_AX_VALUE_CG_RECT_TYPE,
            &mut rect as *mut CGRect as *mut c_void,
        );
        CFRelease(bounds_value);

        if ok {
            Some(SelectionBounds {
                x: rect.origin.x,
                y: rect.origin.y,
                width: rect.size.width,
                height: rect.size.height,
            })
        } else {
            None
        }
    }
}

/// Find the leftmost x of the current wrapped line.
fn get_current_line_start_x(element: AXUIElementRef) -> Option<f64> {
    let range = get_selected_text_range(element)?;
    let value = read_element_value_text(element)?;
    let value_utf16: Vec<u16> = value.encode_utf16().collect();
    let text_len = value_utf16.len() as isize;
    let mut cursor = range.location.max(0).min(text_len);

    // Some apps cannot return bounds for the exact selection start (for example,
    // when the caret is at the end). Step back one UTF-16 code unit as fallback.
    let current_bounds = get_bounds_for_range(element, cursor, 0).or_else(|| {
        if cursor > 0 {
            get_bounds_for_range(element, cursor - 1, 0)
        } else {
            None
        }
    })?;
    let current_line_y = current_bounds.y;

    // Walk backward until the previous glyph is on a different visual row.
    // This handles soft-wrapped lines where there is no '\n'.
    let mut steps = 0usize;
    const MAX_BACKTRACK_STEPS: usize = 512;
    while cursor > 0 && steps < MAX_BACKTRACK_STEPS {
        let prev_cursor = cursor - 1;
        let Some(prev_bounds) = get_bounds_for_range(element, prev_cursor, 0) else {
            break;
        };
        if (prev_bounds.y - current_line_y).abs() > 1.0 {
            break;
        }
        cursor = prev_cursor;
        steps += 1;
    }

    let line_bounds = get_bounds_for_range(element, cursor, 0)?;
    Some(line_bounds.x)
}

/// Get the screen bounds of the current text selection.
fn get_selection_bounds(element: AXUIElementRef) -> Option<SelectionBounds> {
    let range = get_selected_text_range(element)?;
    get_bounds_for_range(element, range.location, range.length)
}

// --- Public API ---

#[derive(Debug, Serialize, Clone)]
pub struct SelectionBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct CaptureResult {
    pub text: String,
    pub bounds: Option<SelectionBounds>,
    pub line_start_x: Option<f64>,
}

/// Check if the process has accessibility permission.
pub fn is_accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

/// Capture selected text and its screen position from the currently focused element.
/// Also stores the frontmost app name for later replacement via clipboard+paste.
pub fn capture_selection_ax() -> Result<CaptureResult, String> {
    capture_selection_ax_internal(true)
}

/// Lightweight capture for passive polling.
/// Does not query/store frontmost app name to avoid frequent osascript calls.
pub fn peek_selection_ax() -> Result<CaptureResult, String> {
    capture_selection_ax_internal(false)
}

fn capture_selection_ax_internal(should_store_app: bool) -> Result<CaptureResult, String> {
    if !is_accessibility_granted() {
        return Err("accessibility_denied".to_string());
    }

    // Get the frontmost app name BEFORE any focus changes.
    // Only needed when we intend to replace text later.
    let app_name = if should_store_app {
        get_frontmost_app_name()
    } else {
        None
    };

    if should_store_app {
        println!("[Polishr] Frontmost app: {:?}", app_name);
    }

    let element = get_focused_element()
        .ok_or_else(|| "no_focused_element".to_string())?;

    let text = read_selected_text(element)
        .ok_or_else(|| {
            unsafe { CFRelease(element); }
            "no_selection".to_string()
        })?;

    if text.trim().is_empty() {
        unsafe { CFRelease(element); }
        return Err("no_selection".to_string());
    }

    let bounds = get_selection_bounds(element);
    let line_start_x = get_current_line_start_x(element);

    // Store the app name for later replacement
    if should_store_app {
        store_app_name(app_name);
    }

    unsafe { CFRelease(element); }

    if should_store_app {
        println!(
            "[Polishr] AX capture: {} chars, bounds={:?}",
            text.len(),
            bounds
        );
    }

    Ok(CaptureResult {
        text,
        bounds,
        line_start_x,
    })
}

/// Result of detecting the paragraph around the cursor (no selection).
#[derive(Debug, Serialize, Clone)]
pub struct ParagraphResult {
    /// The full paragraph text (between newlines).
    pub text: String,
    /// Visual bounds of the paragraph.
    pub bounds: Option<SelectionBounds>,
    /// Leftmost x of the first line in the paragraph.
    pub line_start_x: Option<f64>,
    /// UTF-16 offset of the paragraph start within the element's AXValue.
    pub range_location: isize,
    /// UTF-16 length of the paragraph.
    pub range_length: isize,
}

/// Detect the paragraph around the current cursor position.
/// Only works when there is no active selection (caret only).
/// Finds paragraph boundaries by scanning for `\n` in AXValue.
pub fn peek_paragraph_ax() -> Result<ParagraphResult, String> {
    if !is_accessibility_granted() {
        return Err("accessibility_denied".to_string());
    }

    let element = get_focused_element()
        .ok_or_else(|| "no_focused_element".to_string())?;

    // Check that there is a caret but no selection
    let range = match get_selected_text_range(element) {
        Some(r) => r,
        None => {
            unsafe { CFRelease(element); }
            return Err("no_text_range".to_string());
        }
    };

    // If there is a non-empty selection, this is not a "no selection" scenario
    if range.length != 0 {
        unsafe { CFRelease(element); }
        return Err("has_selection".to_string());
    }

    // Read the full text to find paragraph boundaries
    let full_text = match read_element_value_text(element) {
        Some(t) if !t.is_empty() => t,
        _ => {
            unsafe { CFRelease(element); }
            return Err("no_text_value".to_string());
        }
    };

    let utf16: Vec<u16> = full_text.encode_utf16().collect();
    let text_len = utf16.len() as isize;
    let cursor = range.location.max(0).min(text_len);

    // Scan backward for paragraph start (after a \n, or start of text)
    let mut para_start = cursor;
    while para_start > 0 {
        if utf16[(para_start - 1) as usize] == b'\n' as u16 {
            break;
        }
        para_start -= 1;
    }

    // Scan forward for paragraph end (before a \n, or end of text)
    let mut para_end = cursor;
    while para_end < text_len {
        if utf16[para_end as usize] == b'\n' as u16 {
            break;
        }
        para_end += 1;
    }

    let para_length = para_end - para_start;
    if para_length == 0 {
        unsafe { CFRelease(element); }
        return Err("empty_paragraph".to_string());
    }

    // Extract paragraph text
    let para_text = String::from_utf16_lossy(&utf16[para_start as usize..para_end as usize]);
    if para_text.trim().is_empty() {
        unsafe { CFRelease(element); }
        return Err("empty_paragraph".to_string());
    }

    // Get visual bounds for the paragraph range
    let bounds = get_bounds_for_range(element, para_start, para_length);

    // Get leftmost x of the first line of the paragraph
    let line_start_x = get_bounds_for_range(element, para_start, 0)
        .map(|b| b.x);

    unsafe { CFRelease(element); }

    Ok(ParagraphResult {
        text: para_text,
        bounds,
        line_start_x,
        range_location: para_start,
        range_length: para_length,
    })
}

/// Select a text range in the currently focused element by setting AXSelectedTextRange.
pub fn select_text_range(location: isize, length: isize) -> Result<(), String> {
    if !is_accessibility_granted() {
        return Err("accessibility_denied".to_string());
    }

    let element = get_focused_element()
        .ok_or_else(|| "no_focused_element".to_string())?;

    let range = CFRange { location, length };
    unsafe {
        let range_value = AXValueCreate(
            K_AX_VALUE_CF_RANGE_TYPE,
            &range as *const CFRange as *const c_void,
        );
        if range_value.is_null() {
            CFRelease(element);
            return Err("failed_to_create_range_value".to_string());
        }

        let attr = ax_attr("AXSelectedTextRange");
        let err = AXUIElementSetAttributeValue(element, attr, range_value);
        CFRelease(attr);
        CFRelease(range_value);
        CFRelease(element);

        if err == K_AX_ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format!("set_selected_range_failed: {}", err))
        }
    }
}

/// Replace the selected text using clipboard + paste.
/// This is the most reliable method that works across all apps.
///
/// Flow:
/// 1. Set clipboard to replacement text
/// 2. Activate the original app
/// 3. Wait for app to become active
/// 4. Simulate Cmd+V
pub fn replace_via_clipboard(text: &str) -> Result<(), String> {
    let app_name = get_stored_app_name()
        .ok_or_else(|| "no_stored_app: capture first".to_string())?;

    println!("[Polishr] Replace via clipboard+paste to app: {}", app_name);

    // Step 1: Set clipboard
    set_clipboard(text)?;
    println!("[Polishr] Clipboard set ({} chars)", text.len());

    // Step 2: Activate the original app
    activate_app(&app_name)?;
    println!("[Polishr] App '{}' activated", app_name);

    // Step 3: Wait for the app to become active
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Step 4: Paste
    simulate_paste()?;
    println!("[Polishr] Cmd+V simulated");

    // Clear stored state
    clear_stored_element();

    Ok(())
}

/// Get the mouse cursor position (fallback for when selection bounds aren't available).
pub fn get_mouse_position() -> (f64, f64) {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventCreate(source: CFTypeRef) -> CFTypeRef;
        fn CGEventGetLocation(event: CFTypeRef) -> CGPoint;
    }

    unsafe {
        let event = CGEventCreate(ptr::null());
        let point = CGEventGetLocation(event);
        CFRelease(event);
        (point.x, point.y)
    }
}
