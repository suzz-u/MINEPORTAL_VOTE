@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MinePortal Vote - Dry Run (no vote sent)

echo Running dry-run (the vote button will not be pressed)...
echo.
node index.js --once --dry-run
echo.
echo Done.
pause
