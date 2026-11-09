@echo off
setlocal
title TimeTracker - dev
rem Double-click to pull the latest main branch and start the app in
rem development mode: the Angular dev server in its own window, then Electron.

cd /d "%~dp0"

where git >nul 2>&1 || (echo Git not found. Install it from https://git-scm.com & goto :fail)
where npm >nul 2>&1 || (echo Node.js not found. Install Node 22 from https://nodejs.org & goto :fail)

echo.
echo === Updating main ===
git diff --quiet && git diff --cached --quiet || (
  echo There are uncommitted changes. Commit or stash them first.
  goto :fail
)
for /f %%h in ('git rev-parse HEAD:package-lock.json 2^>nul') do set LOCK_BEFORE=%%h
git checkout main || goto :fail
git pull --ff-only origin main || goto :fail
for /f %%h in ('git rev-parse HEAD:package-lock.json') do set LOCK_AFTER=%%h

rem install dependencies on the first run and whenever they changed
if not exist node_modules set NEEDS_INSTALL=1
if not "%LOCK_BEFORE%"=="%LOCK_AFTER%" set NEEDS_INSTALL=1
if defined NEEDS_INSTALL (
  echo.
  echo === Installing dependencies, this can take a few minutes ===
  call npm install || goto :fail
  rem missing because of an npm optional dependency bug; --no-save keeps
  rem package.json unchanged, so the next pull is not blocked
  call npm install --no-save @nx/nx-win32-x64-msvc || goto :fail
)

echo.
echo === Starting the dev server ===
start "TimeTracker - dev server" cmd /k npm run startFrontend

echo Waiting for http://localhost:4200 (the first build takes a few minutes) ...
:wait
timeout /t 5 /nobreak >nul
curl -s -o nul http://localhost:4200 || goto :wait

echo.
echo === Starting the app ===
call npm start
exit /b 0

:fail
echo.
echo Stopped because of the error above.
pause
exit /b 1
