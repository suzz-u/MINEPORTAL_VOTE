@echo off
chcp 65001 >nul
title MinePortal Vote - Unregister Task

schtasks /Delete /TN "MinePortalVote" /F
if errorlevel 1 (
  echo.
  echo Task not found or could not be deleted.
) else (
  echo.
  echo Deleted task "MinePortalVote".
)
pause
