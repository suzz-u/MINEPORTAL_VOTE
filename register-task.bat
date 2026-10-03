@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MinePortal Vote - Register Task

echo Registering a Windows scheduled task: daily 00:05 (JST)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0register-task.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to register the task.
  echo Try running this file as administrator.
  pause
  exit /b 1
)

echo.
echo Registered. Auto voting runs every day at 00:05 (JST).
echo If the PC is off at that time, it runs at the next startup.
echo To remove it, run unregister-task.bat.
echo.
pause
