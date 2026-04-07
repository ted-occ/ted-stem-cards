@echo off
chcp 65001 >nul 2>&1
title 3D Ball Server

set ROOT=%~dp0
set PATH=%ROOT%node;%ROOT%node\node_modules\npm\bin;%PATH%

echo.
echo ========================================
echo   3D Ball - Starting Server ...
echo ========================================
echo.

:: Check if Node.js exists
if not exist "%ROOT%node\node.exe" (
    echo [ERROR] Node.js not found.
    echo Run setup first: scripts\setup.ps1
    echo.
    pause
    exit /b 1
)

:: Check if .next build exists
if not exist "%ROOT%.next" (
    echo [INFO] Build not found. Running build ...
    "%ROOT%node\node.exe" "%ROOT%node_modules\next\dist\bin\next" build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

:: Rebuild native modules if needed (cross-platform ZIP support)
if exist "%ROOT%.rebuild-needed" (
    echo [INFO] Rebuilding native modules for this platform ...
    "%ROOT%node\node.exe" "%ROOT%node\node_modules\npm\bin\npm-cli.js" rebuild better-sqlite3 2>nul
    "%ROOT%node\node.exe" "%ROOT%node\node_modules\npm\bin\npm-cli.js" rebuild nfc-pcsc 2>nul
    del "%ROOT%.rebuild-needed" 2>nul
    echo [OK] Native modules rebuilt.
    echo.
)

echo   URL: http://localhost:3000
echo   Stop: Ctrl+C or close this window
echo.

"%ROOT%node\node.exe" "%ROOT%node_modules\next\dist\bin\next" start

pause
