@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo GGrid Theme Studio szerver indítása...
echo Mappa: %CD%
echo.
node theme-studio\server.mjs
echo.
echo A Theme Studio szerver leállt vagy hibával kilépett.
echo A fenti üzenetet érdemes lefotózni, ha segítség kell.
echo.
pause
