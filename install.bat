@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MinePortal Vote - Setup

echo ==================================================
echo   MinePortal Auto Vote - Setup
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install Node.js from https://nodejs.org/ and run this again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo Node.js : %%v
echo.

echo [1/3] Installing dependencies (npm install)...
call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed. Check your network connection.
  pause
  exit /b 1
)
echo.

echo [2/3] Checking config.json...
if not exist config.json (
  copy config.example.json config.json >nul
  echo Created config.json
) else (
  echo config.json already exists.
)
echo.

echo [3/3] Checking Google Chrome...
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" goto chrome_ok
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" goto chrome_ok
echo [WARN] Google Chrome was not found in the default location.
echo        Set executablePath in config.json if it is installed elsewhere.
goto chrome_done
:chrome_ok
echo Google Chrome : OK
:chrome_done
echo.

echo ==================================================
echo   Setup complete
echo.
echo   Next steps:
echo     1) Open config.json and set your MCID in "mcids"
echo     2) Run dry-run.bat to test (no vote is sent)
echo     3) Run start.bat to start auto voting
echo.
echo   For daily auto voting at 00:05 JST:
echo     Run register-task.bat
echo ==================================================
echo.
pause
