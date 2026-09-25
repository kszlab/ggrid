@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo HIBA: A Node.js nem található.
  echo Telepítsd a Node.js LTS verziót: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo GGrid Theme Studio indítása...
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo FIGYELEM: Python nem található.
  echo A Theme Studio megnyílik, de a TÉMA ÉPÍTÉSE funkció nem fog működni.
  echo A buildhez Python 3.12+ és a Pillow/Playwright csomagok szükségesek.
  echo.
) else (
  python -c "import PIL, playwright" >nul 2>nul
  if errorlevel 1 (
    echo FIGYELEM: Python megvan, de a Pillow vagy Playwright hiányzik.
    echo A buildhez futtasd:
    echo   python -m pip install pillow playwright
    echo   python -m playwright install chromium
    echo.
  ) else (
    echo Build környezet: rendben.
    echo.
  )
)

start "GGrid Theme Studio Server" cmd /k "chcp 65001 >nul && cd /d ""%~dp0"" && node theme-studio\server.mjs"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4177"

exit /b 0
