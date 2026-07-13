@echo off
setlocal
cd /d "%~dp0"
set PORT=3210
set HOSTNAME=127.0.0.1

if not exist "data" mkdir "data"

echo Starting AI TASK...
echo.
echo The app will open at http://127.0.0.1:%PORT%
echo Keep this window open while using the app.
echo Close this window to stop AI TASK.
echo.

start "" "http://127.0.0.1:%PORT%"
"%~dp0node.exe" "%~dp0app\server.js"

echo.
echo AI TASK has stopped.
pause
