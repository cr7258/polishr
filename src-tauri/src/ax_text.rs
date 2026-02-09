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

/// Get the screen bounds of the current text selection.
fn get_selection_bounds(element: AXUIElementRef) -> Option<SelectionBounds> {
    unsafe {
        let range_attr = ax_attr("AXSelectedTextRange");
        let mut range_value: CFTypeRef = ptr::null();
        let err = AXUIElementCopyAttributeValue(element, range_attr, &mut range_value);
        CFRelease(range_attr);
        if err != K_AX_ERROR_SUCCESS || range_value.is_null() {
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
            bounds_value,
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
}

/// Check if the process has accessibility permission.
pub fn is_accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

/// Capture selected text and its screen position from the currently focused element.
/// Also stores the frontmost app name for later replacement via clipboard+paste.
pub fn capture_selection_ax() -> Result<CaptureResult, String> {
    if !is_accessibility_granted() {
        return Err("accessibility_denied".to_string());
    }

    // Get the frontmost app name BEFORE any focus changes
    let app_name = get_frontmost_app_name();
    println!("[Polishr] Frontmost app: {:?}", app_name);

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

    // Store the app name for later replacement
    store_app_name(app_name);

    unsafe { CFRelease(element); }

    println!(
        "[Polishr] AX capture: {} chars, bounds={:?}",
        text.len(),
        bounds
    );

    Ok(CaptureResult { text, bounds })
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
