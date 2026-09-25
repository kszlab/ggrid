@echo off
cd /d "%~dp0"
echo.
echo Starting GGrid Theme Studio server...
echo Working directory: %CD%
echo.
node theme-studio\server.mjs
echo.
echo Theme Studio server stopped or exited with an error.
echo If you need help, take a screenshot of the error shown above.
echo.
pause
