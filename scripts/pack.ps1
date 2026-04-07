# =============================================================================
# 3D Ball - Pack for Distribution
# =============================================================================
# Creates a ZIP file ready to distribute to other Windows PCs.
# Run this AFTER setup.ps1 has completed successfully.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\pack.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ROOT

$DIST_NAME = "3dball-portable"
$ZIP_NAME = "${DIST_NAME}.zip"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  3D Ball - Pack for Distribution" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify setup is complete
if (-not (Test-Path "node\node.exe")) {
    Write-Host "[ERROR] Node.js not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path ".next")) {
    Write-Host "[ERROR] Build not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Packing distributable ZIP ..." -ForegroundColor Yellow

# Create a temporary file list for robocopy
$tempDir = Join-Path $env:TEMP $DIST_NAME
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# Use robocopy to copy files excluding unnecessary ones
$excludeDirs = @(".git", ".vercel", "data", ".next\cache")
$excludeFiles = @(".DS_Store", "*.tsbuildinfo", ".env*", "tsconfig.tsbuildinfo")

# Copy essential directories and files
$dirs = @("node", "node_modules", ".next", "app", "lib", "public", "types", "scripts")
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        $dest = Join-Path $tempDir $dir
        robocopy $dir $dest /E /NFL /NDL /NJH /NJS /NC /NS /NP /XD .git .vercel cache 2>$null | Out-Null
    }
}

# Copy root files
$rootFiles = @(
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "middleware.ts",
    "next-env.d.ts",
    "start.bat"
)
foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Copy-Item $file $tempDir
    }
}

# Create empty data directory
New-Item -ItemType Directory -Path (Join-Path $tempDir "data") -Force | Out-Null

# Create the ZIP
$zipPath = Join-Path $ROOT $ZIP_NAME
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath

# Cleanup
Remove-Item $tempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)

Write-Host ""
Write-Host "[OK] Created: $ZIP_NAME ($sizeMB MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Distribution instructions:" -ForegroundColor Cyan
Write-Host "  1. Copy $ZIP_NAME to target PC" -ForegroundColor White
Write-Host "  2. Extract ZIP to any folder" -ForegroundColor White
Write-Host "  3. Double-click start.bat" -ForegroundColor White
Write-Host ""

pause
