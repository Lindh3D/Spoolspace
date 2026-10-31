@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS from https://nodejs.org first.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Starting Spoolspace. Keep this window open while using the app.
echo Open http://localhost:4173 on this computer.
node --env-file-if-exists=.env server.mjs
pause
