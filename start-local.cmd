@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  )
)
where pnpm >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;%PATH%"
  )
)

where node >nul 2>nul
if errorlevel 1 goto missing_tools
where pnpm >nul 2>nul
if errorlevel 1 goto missing_tools

if not exist "node_modules\vinext\dist\cli.js" (
  echo Installing dependencies for the first local run...
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto failed
)

echo Building the current local version...
call pnpm run build
if errorlevel 1 goto failed

echo.
echo mypaperread local address: http://127.0.0.1:8787/
echo Keep this window open while reading. Press Ctrl+C to stop.
echo.
call pnpm run start
exit /b %errorlevel%

:missing_tools
echo Node.js 22.13+ and pnpm are required.
echo Install them, then run this file again.
pause
exit /b 1

:failed
echo Local setup failed. Check the error above.
pause
exit /b 1
