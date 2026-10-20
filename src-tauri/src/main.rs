#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_window_state::StateFlags;

// The only file write is to a destination explicitly chosen in a native dialog.
#[tauri::command]
async fn save_png(app: tauri::AppHandle, name: String, bytes: Vec<u8>) -> Result<bool, String> {
    if bytes.len() > 64 * 1024 * 1024 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("Invalid PNG image".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().set_title("Save Picture")
            .set_file_name(&name).add_filter("PNG Image", &["png"]).blocking_save_file();
        let Some(selected) = selected else { return Ok(false); };
        let mut path = selected.into_path().map_err(|error| error.to_string())?;
        if path.extension().is_none() { path.set_extension("png"); }
        std::fs::write(path, bytes).map_err(|error| error.to_string())?;
        Ok(true)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
async fn save_coloring_book(app: tauri::AppHandle, name: String, text: String) -> Result<bool, String> {
    if text.len() > 20 * 1024 * 1024 {
        return Err("Coloring book is too large".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().set_title("Save Coloring Book")
            .set_file_name(&name).add_filter("Coloring Book JSON", &["json"]).blocking_save_file();
        let Some(selected) = selected else { return Ok(false); };
        let mut path = selected.into_path().map_err(|error| error.to_string())?;
        if path.extension().is_none() { path.set_extension("json"); }
        std::fs::write(path, text).map_err(|error| error.to_string())?;
        Ok(true)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
fn print_picture(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default()
            .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN)
            .build())
        .setup(|app| {
            // Restore the saved geometry/state before displaying the window.
            if let Some(window) = app.get_webview_window("main") { window.show()?; window.set_focus()?; }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_png, save_coloring_book, print_picture])
        .run(tauri::generate_context!())
        .expect("Unable to start Studioodle");
}
