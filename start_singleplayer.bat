@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Voxel Creative Single Player

echo Starting single-player static server...
echo Open http://localhost:8000
echo LAN multiplayer is not available in this mode.
echo.
python -m http.server 8000
pause
