# ════════════════════════════════════════════════════════════════════════
#  RPSLS — Dev Console
#  Build → package → install → launch → LIVE colourised logcat.
#  Double-click the desktop launcher (RPSLS-DevConsole.bat) to run.
# ════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir   = Join-Path $RepoRoot "app"
$GenDir   = Join-Path $AppDir "src-tauri\gen\android"
$Pkg      = "com.alex.rpsls"
$Activity = "$Pkg/.MainActivity"
$SoSrc    = Join-Path $RepoRoot "target\aarch64-linux-android\debug\libapp_lib.so"
$SoDst    = Join-Path $AppDir "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so"
$ApkPath  = Join-Path $AppDir "src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
$Adb      = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"

# ── pretty helpers ──────────────────────────────────────────────────────
$E = [char]27
function Hr   { Write-Host ("─" * 74) -ForegroundColor DarkGray }
function Stamp { return (Get-Date -Format "HH:mm:ss") }
function Section($t) {
  Write-Host ""
  Write-Host ("┏━━ " + $t + " ") -NoNewline -ForegroundColor Cyan
  Write-Host ("━" * [Math]::Max(0, 68 - $t.Length)) -ForegroundColor Cyan
}
function Step($t) { Write-Host ("  $(Stamp) ▶ " + $t) -ForegroundColor White }
function Ok($t)   { Write-Host ("  $(Stamp) ✔ " + $t) -ForegroundColor Green }
function Warn($t) { Write-Host ("  $(Stamp) ⚠ " + $t) -ForegroundColor Yellow }
function Die($t)  { Write-Host ("  $(Stamp) [X] " + $t) -ForegroundColor Red; Write-Host ""; Read-Host "Appuie sur Entree pour fermer"; exit 1 }

function Banner {
  Clear-Host
  $Host.UI.RawUI.WindowTitle = "RPSLS Dev Console"
  Write-Host ""
  Write-Host "  ██████╗ ██████╗ ███████╗██╗     ███████╗" -ForegroundColor Magenta
  Write-Host "  ██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝" -ForegroundColor Magenta
  Write-Host "  ██████╔╝██████╔╝███████╗██║     ███████╗" -ForegroundColor Magenta
  Write-Host "  ██╔══██╗██╔═══╝ ╚════██║██║     ╚════██║" -ForegroundColor DarkMagenta
  Write-Host "  ██║  ██║██║     ███████║███████╗███████║" -ForegroundColor DarkMagenta
  Write-Host "  ╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝  Dev Console" -ForegroundColor DarkMagenta
  Write-Host ""
}

# ── preflight ───────────────────────────────────────────────────────────
function Require-Adb {
  if (-not (Test-Path $Adb)) { Die "adb introuvable: $Adb" }
}
function Wait-Device {
  Step "Recherche du téléphone…"
  $devs = & $Adb devices 2>$null | Select-String -Pattern "\tdevice$"
  if (-not $devs) { Die "Aucun appareil ADB connecté. Branche le tél (USB debugging ON)." }
  Ok ("Appareil: " + (($devs[0] -split "\t")[0]))
}

# ── build steps ─────────────────────────────────────────────────────────
function Build-Front {
  Section "BUILD FRONTEND (vite)"
  Push-Location $AppDir
  Step "pnpm build…"
  & pnpm build 2>&1 | ForEach-Object { Write-Host ("    " + $_) -ForegroundColor DarkGray }
  if ($LASTEXITCODE -ne 0) { Pop-Location; Die "pnpm build a échoué." }
  Pop-Location
  Ok "Frontend bundle prêt (dist/)."
}

function Build-Rust {
  Section "COMPILE RUST + EMBED FRONT (.so)"
  Push-Location $AppDir
  $env:ANDROID_NDK_ROOT = $env:NDK_HOME
  Step "tauri android build (l'échec symlink Windows en fin est NORMAL)…"
  # The last symlink step fails on Windows w/o Developer Mode, but the .so is
  # already compiled by then — we copy it manually below.
  & npx tauri android build --debug --apk --target aarch64 2>&1 |
    ForEach-Object { Write-Host ("    " + $_) -ForegroundColor DarkGray }
  Pop-Location
  if (-not (Test-Path $SoSrc)) { Die ".so introuvable après build: $SoSrc" }
  $age = (Get-Date) - (Get-Item $SoSrc).LastWriteTime
  Ok (".so compilé ({0:N1} Mo, il y a {1:N0}s)." -f ((Get-Item $SoSrc).Length/1MB), $age.TotalSeconds)
}

function Copy-So {
  Step "Copie du .so frais → jniLibs…"
  Copy-Item -Force $SoSrc $SoDst
  Ok "Copié."
}

function Package-Apk {
  Section "PACKAGE APK (gradle)"
  Push-Location $GenDir
  Step "gradlew assembleArm64Debug…"
  & .\gradlew assembleArm64Debug -x rustBuildArm64Debug 2>&1 |
    ForEach-Object {
      if ($_ -match "BUILD SUCCESSFUL") { Write-Host ("    " + $_) -ForegroundColor Green }
      elseif ($_ -match "FAILED|error") { Write-Host ("    " + $_) -ForegroundColor Red }
      else { Write-Host ("    " + $_) -ForegroundColor DarkGray }
    }
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Die "gradle a échoué." }
  if (-not (Test-Path $ApkPath)) { Die "APK introuvable: $ApkPath" }
  Ok ("APK prêt ({0:N1} Mo)." -f ((Get-Item $ApkPath).Length/1MB))
}

function Install-Apk {
  Section "INSTALL SUR LE TÉLÉPHONE"
  Step "adb install -r…"
  $out = & $Adb install -r $ApkPath 2>&1
  $out | ForEach-Object {
    if ($_ -match "Success") { Write-Host ("    " + $_) -ForegroundColor Green }
    elseif ($_ -match "Failure|failed") { Write-Host ("    " + $_) -ForegroundColor Red }
    else { Write-Host ("    " + $_) -ForegroundColor DarkGray }
  }
  if ($out -match "Failure|failed") { Die "Installation refusée (regarde le tél : autoriser l'install ?)." }
  Ok "Installée."
}

function Relaunch {
  Step "force-stop + start (vide le vieux JS en mémoire)…"
  & $Adb shell am force-stop $Pkg 2>$null
  Start-Sleep -Milliseconds 600
  & $Adb shell am start -n $Activity 2>$null | Out-Null
  Start-Sleep -Seconds 3
  $appPid = (& $Adb shell pidof $Pkg 2>$null).Trim()
  if ($appPid) { Ok "Lancée (PID $appPid)." } else { Warn "Lancée mais PID introuvable." }
  return $appPid
}

# ── live logs ───────────────────────────────────────────────────────────
function Stream-Logs {
  Section "LOGS EN DIRECT  (Ctrl+C pour quitter)"
  Write-Host "  Filtre: process de l'app + console JS (chromium) + erreurs natives." -ForegroundColor DarkGray
  Hr
  & $Adb logcat -c 2>$null
  # Colourise each line by android level letter and by tag of interest.
  & $Adb logcat -v time 2>$null | ForEach-Object {
    $l = $_
    if ($l -notmatch "($Pkg|chromium|CONSOLE|Console|FATAL|AndroidRuntime|tauri|RPSLS|libapp)") { return }
    if ($l -match "FATAL|AndroidRuntime|\sE/|\sE\s") { Write-Host $l -ForegroundColor Red }
    elseif ($l -match "\sW/|\sW\s|WARN")             { Write-Host $l -ForegroundColor Yellow }
    elseif ($l -match "CONSOLE|chromium")            { Write-Host $l -ForegroundColor Cyan }
    elseif ($l -match "\sI/|\sI\s")                  { Write-Host $l -ForegroundColor Gray }
    else                                             { Write-Host $l -ForegroundColor DarkGray }
  }
}

# ── menu ────────────────────────────────────────────────────────────────
Banner
Require-Adb
Write-Host "  Que veux-tu faire ?" -ForegroundColor White
Write-Host ""
Write-Host "   [1] " -NoNewline -ForegroundColor Green;   Write-Host "Build complet + Install + Logs live   (front + rust + apk)"
Write-Host "   [2] " -NoNewline -ForegroundColor Cyan;    Write-Host "Logs live seulement                   (app déjà installée)"
Write-Host "   [3] " -NoNewline -ForegroundColor Yellow;  Write-Host "Re-deploy rapide + Logs               (front + rust + apk, pareil que 1)"
Write-Host "   [Q] " -NoNewline -ForegroundColor DarkGray;Write-Host "Quitter"
Write-Host ""
$choice = Read-Host "  Choix"

switch ($choice.ToUpper()) {
  "1" { Wait-Device; Build-Front; Build-Rust; Copy-So; Package-Apk; Install-Apk; Relaunch | Out-Null; Stream-Logs }
  "3" { Wait-Device; Build-Front; Build-Rust; Copy-So; Package-Apk; Install-Apk; Relaunch | Out-Null; Stream-Logs }
  "2" { Wait-Device; Relaunch | Out-Null; Stream-Logs }
  "Q" { exit 0 }
  default { Warn "Choix inconnu — logs seulement."; Wait-Device; Stream-Logs }
}
