@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo HIBA: A Node.js nem talalhato.
  echo Telepitsd a Node.js LTS verziot: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo GGrid Theme Studio inditasa...
echo.

start "GGrid Theme Studio Server" cmd /k "cd /d ""%~dp0"" && node theme-studio\server.mjs"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4177"

exit /b 0
