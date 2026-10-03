@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MinePortal Vote - Vote Once

node index.js --once
if /i not "%~1"=="--no-pause" pause
