@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Voxel Creative Server

where node >nul 2>nul
if errorlevel 1 goto STATIC_ONLY

for /f "usebackq delims=" %%V in (`node -p "process.versions.node.split('.')[0]" 2^>nul`) do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto STATIC_ONLY
if %NODE_MAJOR% LSS 18 goto STATIC_ONLY

echo Node.js detected. Starting the full HTTP and WebSocket LAN server...
echo.
node "%~dp0lan-server.js"
set "SERVER_EXIT=%ERRORLEVEL%"
echo.
if not "%SERVER_EXIT%"=="0" echo Server stopped with error code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%

:STATIC_ONLY
echo.
echo WARNING: Node.js 18 or newer was not found.
echo Starting a single-player static server on http://localhost:8000
echo LAN multiplayer will not work in this mode.
echo.
python -m http.server 8000
pause
