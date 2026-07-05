@echo off
title TV ON - Local Server Launcher (App Mode)
echo ===================================================
echo   TV ON - Local Server Launcher (App Mode)
echo ===================================================
echo.

rem Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

rem Free up port 5173 in case a ghost server process is running in the background
echo [INFO] Freeing up port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

rem Check if node_modules is installed
if not exist node_modules (
    echo [INFO] node_modules folder is missing. Installing packages...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Package installation failed.
        pause
        exit /b 1
    )
)

rem Start dev server in the background
echo [INFO] Starting development server...
start /b "" cmd /c npm run dev

rem Wait 3 seconds for server to initialize
ping 127.0.0.1 -n 4 >nul

rem Try to locate Google Chrome
set CHROME_PATH=
where chrome >nul 2>nul
if %errorlevel% equ 0 set CHROME_PATH=chrome

rem Query registry to find Chrome path dynamically
if not defined CHROME_PATH (
    for /f "tokens=2*" %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set "CHROME_PATH=%%b"
)
if not defined CHROME_PATH (
    for /f "tokens=2*" %%a in ('reg query "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set "CHROME_PATH=%%b"
)

rem Fallback standard paths
if not defined CHROME_PATH if exist "%SystemDrive%\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%SystemDrive%\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "%SystemDrive%\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%SystemDrive%\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"

rem Print status (no block parentheses used here to prevent CMD expansion bugs)
if defined CHROME_PATH echo [INFO] Opening TV ON in Chrome App Mode [standalone]...
if not defined CHROME_PATH echo [WARNING] Google Chrome not found. Opening in default browser...

rem Launch (flat single-line commands are 100% immune to parenthesis parsing bugs)
if defined CHROME_PATH start "" "%CHROME_PATH%" --app=http://localhost:5173/
if not defined CHROME_PATH start http://localhost:5173/

echo.
echo ===================================================
echo   TV ON is running!
echo   Minimize this window, do not close it.
echo   Press Ctrl+C or close this window to stop server.
echo ===================================================
echo.

:loop
ping 127.0.0.1 -n 11 >nul
goto loop
