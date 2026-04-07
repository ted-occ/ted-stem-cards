# =============================================================================
# 3D Ball - Windows Portable Setup Script
# =============================================================================
# Usage: Right-click -> "PowerShellで実行" or run in terminal:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$NODE_VERSION = "22.15.0"
$NODE_DIR = "node"
$NODE_ZIP = "node-v${NODE_VERSION}-win-x64.zip"
$NODE_URL = "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ROOT

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  3D Ball - Portable Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- Step 1: Download Node.js portable ----
if (Test-Path "$NODE_DIR\node.exe") {
    Write-Host "[OK] Node.js already exists. Skipping download." -ForegroundColor Green
} else {
    Write-Host "[1/3] Downloading Node.js v${NODE_VERSION} ..." -ForegroundColor Yellow

    $tempZip = Join-Path $env:TEMP $NODE_ZIP
    try {
        Invoke-WebRequest -Uri $NODE_URL -OutFile $tempZip -UseBasicParsing
    } catch {
        Write-Host "[ERROR] Download failed: $_" -ForegroundColor Red
        Write-Host "Check your internet connection and try again." -ForegroundColor Red
        exit 1
    }

    Write-Host "  Extracting ..." -ForegroundColor Yellow
    Expand-Archive -Path $tempZip -DestinationPath $env:TEMP -Force

    # Move extracted folder to ./node
    $extracted = Join-Path $env:TEMP "node-v${NODE_VERSION}-win-x64"
    if (Test-Path $NODE_DIR) { Remove-Item $NODE_DIR -Recurse -Force }
    Move-Item $extracted $NODE_DIR

    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue

    Write-Host "[OK] Node.js installed to .\node\" -ForegroundColor Green
}

# Set PATH for this session
$env:Path = "$ROOT\$NODE_DIR;$ROOT\$NODE_DIR\node_modules\npm\bin;$env:Path"

Write-Host ""
Write-Host "[2/3] Installing dependencies ..." -ForegroundColor Yellow
& "$NODE_DIR\node.exe" "$NODE_DIR\node_modules\npm\bin\npm-cli.js" install --include=optional 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed." -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Building production app ..." -ForegroundColor Yellow
& "$NODE_DIR\node.exe" "$NODE_DIR\node_modules\npm\bin\npm-cli.js" run build 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Build complete." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Cyan
Write-Host "  start.bat をダブルクリックして起動" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tip: このフォルダを ZIP に固めれば" -ForegroundColor Gray
Write-Host "     他の PC にそのまま配布できます。" -ForegroundColor Gray
Write-Host ""

pause
