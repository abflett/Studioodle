# Windows Desktop Builds

Studioodle uses Tauri 2 with the existing Vite frontend and the Windows WebView2 runtime. The frontend and all artwork are bundled into the executable; normal drawing works offline. This is an unsigned 0.1.1 tester build for Windows 10/11 x64.

## Build And Run

Prerequisites: the project-supported Node version, Rust stable with the MSVC toolchain, Visual Studio C++ build tools/Windows SDK, and WebView2. This machine uses Rust 1.91.1 and Visual Studio 18 C++ tools. Dependency versions are locked in package-lock.json and src-tauri/Cargo.lock.

```powershell
npm ci
npm run desktop:dev
npm run desktop:build
```

Development runs Vite on port 1420, failing if the port is occupied. The build command bundles the frontend, compiles the Rust application, and produces an NSIS installer under `src-tauri/target/release/bundle/nsis/`. The standalone executable is `src-tauri/target/release/Studioodle.exe`. Compiler output, installers and local release copies are ignored by Git; configuration, Rust sources, lockfile and Windows icons are tracked source files.

## Share With Testers

Share `Studioodle_0.1.1_x64-setup.exe` (or the current version's equivalent). The installer installs for the current Windows user and supplies Start Menu/uninstall entries. It checks for WebView2 and downloads its bootstrapper if missing, so that first installation may require internet access. Testers do not need Node, Rust, or Visual Studio. The standalone EXE requires WebView2 to already be installed.

The installer is not code-signed. Windows may show an unknown-publisher or SmartScreen prompt. Only distribute your known build directly to invited testers; signing can be configured for a public release later.

## Desktop Behavior

- Exit closes the app window. Closing the editor through the window's X saves the drawing first; a save failure keeps it open with an error notice.
- Fullscreen uses the native window rather than browser fullscreen. Window size, position, maximized and fullscreen states are saved on exit and restored before the window is shown. Visibility/minimized state is not restored, so the app remains accessible. The official window-state plugin handles a missing monitor by leaving placement to the OS.
- PNG, SVG and PDF export use the format overlay followed by a native Save Picture dialog. PNG retains the chosen DPI metadata; SVG/PDF retain vectors. The `save_picture` backend validates and writes only to the selected destination; no general filesystem access is exposed. This adapter change awaits the next requested native build.
- Print supplies inline SVG for only the picture and opens the native WebView2 print UI, including available PDF printers. The app interface is excluded through print CSS; the browser version keeps its existing print-window path.
- Pictures, custom coloring pages, settings and theme remain local to this desktop app's per-user WebView2 profile. Browser saves are separate; this build does not automatically migrate them. App identity `com.studioodle.desktop` stays stable across updates so local data can persist.
- Mouse speed is saved immediately when adjusted. The enabled mouse-control preference is also remembered on desktop: after reopening, it resumes at that speed on the first completed mouse click, as WebView2 requires a user gesture for pointer lock. It does not capture halfway through a stroke. Escape, Space-off and Use normal mouse disable the remembered preference; window focus loss, native dialogs and Exit only suspend capture. Touch input does not trigger mouse capture.

Tauri capabilities are restricted to the local main window's standard events/window reads, close/destroy (required by the save-on-close handler) and fullscreen. Content Security Policy permits bundled code/fonts, inline UI styling, data/blob artwork and local IPC, with no remote-content access.

References: https://v2.tauri.app/start/prerequisites/ and https://v2.tauri.app/distribute/windows-installer/.

Build validation: the Windows NSIS build completed. An isolated WebView2 profile launched the release app, rendered the Safari picker/editor without runtime or CSP errors, saved/reopened a picture and exercised native fullscreen. The final executable was also observed saving before a native editor-window close. PNG payload validation reached the Rust backend. Native printer and file-dialog interaction still need hands-on tester coverage.

Version 0.1.1 restart validation: the release build restored a 900 x 700 window at (120, 90), reopened maximized, and reopened fullscreen. An isolated WebView2 profile retained 35% mouse speed and enabled control; a trusted first click successfully resumed pointer lock. The temporary native window-state fixture was removed after verification.
