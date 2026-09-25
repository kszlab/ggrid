@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo Starting GGrid Theme Studio...
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo WARNING: Python was not found.
  echo Theme Studio will open, but BUILD will not work.
  echo Python 3.12+ plus Pillow and Playwright are required for BUILD.
  echo.
) else (
  python -c "import PIL, playwright" >nul 2>nul
  if errorlevel 1 (
    echo WARNING: Python exists, but Pillow or Playwright is missing.
    echo Run:
    echo   python -m pip install pillow playwright
    echo   python -m playwright install chromium
    echo.
  ) else (
    echo Build environment: OK.
    echo.
  )
)

start "GGrid Theme Studio Server" "%~dp0START_THEME_STUDIO_SERVER.bat"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4177"
exit /b 0
