@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Voxel Creative LAN Server

where node >nul 2>nul
if errorlevel 1 goto NO_NODE

for /f "usebackq delims=" %%V in (`node -p "process.versions.node.split('.')[0]" 2^>nul`) do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto NO_NODE
if %NODE_MAJOR% LSS 18 goto OLD_NODE

echo Starting Voxel Creative HTTP and WebSocket LAN server...
echo Keep this window open while playing.
echo.
node "%~dp0lan-server.js"
set "SERVER_EXIT=%ERRORLEVEL%"
echo.
if not "%SERVER_EXIT%"=="0" (
  echo Server stopped with error code %SERVER_EXIT%.
  echo If port 8080 is busy, close the old Python or Node server first.
)
pause
exit /b %SERVER_EXIT%

:NO_NODE
echo.
echo ERROR: Node.js was not found.
echo Install Node.js 18 or newer, then run this file again.
echo Python http.server cannot provide the WebSocket endpoint required for LAN play.
echo.
pause
exit /b 1

:OLD_NODE
echo.
echo ERROR: Node.js 18 or newer is required. Detected major version: %NODE_MAJOR%
echo Update Node.js, then run this file again.
echo.
pause
exit /b 1
