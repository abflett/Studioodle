use std::io::Write;
#[cfg(desktop)]
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FsExt, OpenOptions};
#[cfg(desktop)]
use tauri_plugin_window_state::StateFlags;

fn write_selected_file(
    app: &tauri::AppHandle,
    selected: tauri_plugin_fs::FilePath,
    bytes: &[u8],
) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    app.fs()
        .open(selected, options)
        .and_then(|mut file| file.write_all(bytes))
        .map_err(|error| error.to_string())
}

// The only file write is to a destination explicitly chosen in a native dialog.
#[tauri::command]
async fn save_picture(
    app: tauri::AppHandle,
    name: String,
    format: String,
    bytes: Vec<u8>,
) -> Result<bool, String> {
    let (label, extension, valid) = match format.as_str() {
        "png" => ("PNG Image", "png", bytes.starts_with(b"\x89PNG\r\n\x1a\n")),
        "svg" => (
            "SVG Artwork",
            "svg",
            std::str::from_utf8(&bytes)
                .map(|text| text.starts_with("<svg") && text.contains("http://www.w3.org/2000/svg"))
                .unwrap_or(false),
        ),
        "pdf" => ("PDF Document", "pdf", bytes.starts_with(b"%PDF-")),
        _ => return Err("Unsupported picture format".into()),
    };
    if bytes.len() > 64 * 1024 * 1024 || !valid {
        return Err("Invalid picture file".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("Save Picture")
            .set_file_name(&name)
            .add_filter(label, &[extension])
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(false);
        };
        #[cfg(desktop)]
        let selected = {
            let mut path = selected.into_path().map_err(|error| error.to_string())?;
            if path.extension().is_none() {
                path.set_extension(extension);
            }
            tauri_plugin_fs::FilePath::Path(path)
        };
        write_selected_file(&app, selected, &bytes)?;
        Ok(true)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn save_coloring_book(
    app: tauri::AppHandle,
    name: String,
    text: String,
) -> Result<bool, String> {
    if text.len() > "studioodle-page:3:".len() + 4 * ((20 * 1024 * 1024 + 2) / 3) {
        return Err("Coloring book is too large".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("Save Coloring Book")
            .set_file_name(&name)
            .add_filter("Studioodle Pages", &["studioodle"])
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(false);
        };
        #[cfg(desktop)]
        let selected = {
            let mut path = selected.into_path().map_err(|error| error.to_string())?;
            if path.extension().is_none() {
                path.set_extension("studioodle");
            }
            tauri_plugin_fs::FilePath::Path(path)
        };
        write_selected_file(&app, selected, text.as_bytes())?;
        Ok(true)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(desktop)]
#[tauri::command]
fn print_picture(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

#[cfg(mobile)]
#[tauri::command]
fn print_picture() -> Result<(), String> {
    Err("Please export a PDF and print it from Android's document viewer.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init());
    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(
                StateFlags::SIZE
                    | StateFlags::POSITION
                    | StateFlags::MAXIMIZED
                    | StateFlags::FULLSCREEN,
            )
            .build(),
    );
    builder
        .setup(|_app| {
            // Desktop geometry is restored before displaying the window.
            #[cfg(desktop)]
            if let Some(window) = _app.get_webview_window("main") {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_picture,
            save_coloring_book,
            print_picture
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Studioodle");
}
