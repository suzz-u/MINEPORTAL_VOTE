@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MinePortal Auto Vote - Running (Ctrl+C to stop)

if not exist node_modules (
  echo node_modules not found. Run install.bat first.
  echo.
  pause
  exit /b 1
)
if not exist config.json (
  echo config.json not found. Run install.bat first.
  echo.
  pause
  exit /b 1
)

echo Starting MinePortal auto vote...
echo It tries once now, then follows the schedule in config.json.
echo Press Ctrl+C to stop.
echo.

node index.js

echo.
echo Stopped. Log: vote.log
pause
