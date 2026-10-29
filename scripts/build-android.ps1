# Build an optimized, sideloadable ARM64 tester APK using the local Android debug key.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $env:NDK_HOME) {
    $ndk = Get-ChildItem (Join-Path $env:ANDROID_HOME 'ndk') -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
    if (-not $ndk) { throw 'Install Android NDK (side by side) in Android Studio first.' }
    $env:NDK_HOME = $ndk.FullName
}
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
& .\node_modules\.bin\tauri.cmd android build --apk --target aarch64 --ci
if ($LASTEXITCODE) { throw 'Android build failed.' }
$unsigned = Get-ChildItem src-tauri\gen\android\app\build\outputs\apk -Recurse -Filter '*release-unsigned.apk' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $unsigned) { throw 'Unsigned release APK was not found.' }
$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
$key = Join-Path $env:USERPROFILE '.android\debug.keystore'
if (-not (Test-Path -LiteralPath $key)) { throw 'Create the local Android debug keystore by building a debug app in Android Studio first.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
New-Item -ItemType Directory -Force release | Out-Null
$apk = Join-Path (Get-Location) "release\Studioodle_${version}_arm64-test.apk"
& "$($buildTools.FullName)\apksigner.bat" sign --ks $key --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $apk $unsigned.FullName
if ($LASTEXITCODE) { throw 'APK signing failed.' }
& "$($buildTools.FullName)\apksigner.bat" verify --verbose $apk
if ($LASTEXITCODE) { throw 'APK signature verification failed.' }
Write-Output "Tester APK: $apk"
