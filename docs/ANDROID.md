# Android tester builds

Studioodle uses Tauri 2 with the same offline Vite frontend. Android has its own
identity, `com.studioodle.app`; Windows keeps `com.studioodle.desktop`.

## Build on Windows

Install the project dependencies, Rust stable with `aarch64-linux-android`, and
Android Studio. In its SDK Manager install Android SDK Platform 36, platform tools,
build tools and an NDK (this machine uses 29.0.14206865). The checked-in Gradle
project is under `src-tauri/gen/android/`; do not regenerate it for routine builds.
It targets Android 7/API 24 or later and builds ARM64 for the Redmi 13C.

```powershell
npm run android:build
```

The script discovers Android Studio's Java runtime, the SDK under LocalAppData,
and the newest installed NDK. Existing JAVA_HOME, ANDROID_HOME and NDK_HOME values
take precedence. It builds an optimized release APK, signs it with the existing
`%USERPROFILE%/.android/debug.keystore`, verifies the signature, and writes
`release/Studioodle_0.1.1_arm64-test.apk` (using the current package version).
No development server or computer connection is needed to run the installed app.

This is a private tester APK, signed with a development key, not a Google Play
release. Keep the same key to update existing tester installations without
uninstalling and losing local drawings. A public release needs a separately
managed release key and signing/distribution setup. Never commit signing keys.

## Install on a USB-connected phone

Enable USB debugging, unlock the phone, and authorize the computer. Use the serial
from `adb devices -l` so an emulator cannot accidentally receive the install:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s PHONE_SERIAL install -r release\Studioodle_0.1.1_arm64-test.apk
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s PHONE_SERIAL shell am start -n com.studioodle.app/.MainActivity
```

Redmi/MIUI may also require **Install via USB** in Developer options and approval
of an installation prompt. Other ARM64 testers can sideload the same APK after
allowing installation from their file manager. They do not need developer mode.

## Behavior and tester coverage

Drawing, saved pictures, settings and custom coloring pages stay in the app's
local WebView storage. Updates using the same identity/key preserve that storage;
uninstalling or clearing app data removes it. Browser/Windows saves are separate.
Exports use Android's document picker and content URIs, without broad storage
permissions. The Print action saves a vector PDF for printing from a document
viewer. Desktop window restoration and mouse capture are excluded on Android.

Ask testers to try blank paper and coloring pages; tap fills and brush strokes;
two-finger pan/zoom; stickers; undo; portrait/landscape rotation; background/resume;
and saved-picture reopen after restarting the app. Check PNG/SVG/PDF exports and
page import/share separately. Include a simple page and the detailed Moon Sorceress
to distinguish basic compatibility from dense-art performance.

For each report collect app version, phone model, Android version, steps, expected
and actual behavior, and a screenshot or screen recording. Note slow actions with
the page/sticker and approximate delay. No feedback upload or telemetry is added.

Build prerequisites: [Tauri mobile setup](https://v2.tauri.app/start/prerequisites/).
