@echo off
title NoteWeb Mobile Sync
echo [NoteWeb] Switching to project drive...
d:
echo [NoteWeb] Navigating to project directory...
cd "D:\ANTIGRAVITY PROJECT\note app"

echo.
echo [NoteWeb] 1. Installing NPM dependencies...
call npm.cmd install

echo.
echo [NoteWeb] 2. Building React web application...
call npm.cmd run build

echo.
echo [NoteWeb] 3. Syncing assets with Capacitor Android...
call npx.cmd cap sync

echo.
echo =========================================================
echo [NoteWeb] Mobile sync completed successfully!
echo You can now rebuild the app in Android Studio or run:
echo npx.cmd cap run android
echo =========================================================
echo.
pause
