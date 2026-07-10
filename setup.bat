@echo off
REM Solutionplex setup / update script
REM Safe to run multiple times: performs first-time setup and refreshes
REM (updates) dependencies for both the backend and the frontend.

setlocal enabledelayedexpansion
set "ROOT=%~dp0"

echo ============================================
echo   Solutionplex setup / dependency update
echo ============================================
echo.

REM --- Prerequisite checks ------------------------------------------------
where uv >nul 2>nul
if errorlevel 1 (
    echo [ERROR] 'uv' was not found on PATH.
    echo         Install it from https://docs.astral.sh/uv/ and re-run this script.
    goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] 'npm' was not found on PATH.
    echo         Install Node.js from https://nodejs.org/ and re-run this script.
    goto :fail
)

REM --- Backend (FastAPI / uv) ---------------------------------------------
echo [1/3] Setting up backend (server)...

echo       Syncing Python dependencies with uv...
pushd "%ROOT%server"
call uv sync
if errorlevel 1 (
    popd
    echo [ERROR] 'uv sync' failed.
    goto :fail
)
popd
echo       Backend dependencies are up to date.
echo.

REM --- Frontend (React / npm) --------------------------------------------
echo [2/3] Setting up frontend (client)...
echo       Installing / updating npm dependencies...
pushd "%ROOT%client"
call npm install
if errorlevel 1 (
    popd
    echo [ERROR] 'npm install' failed.
    goto :fail
)
popd
echo       Frontend dependencies are up to date.
echo.

REM --- Done ---------------------------------------------------------------
echo [3/3] Setup complete.
echo.
echo Next steps:
echo   1. Start MongoDB : start-mongo.bat
echo   2. Start the app : run.bat
echo.
endlocal
exit /b 0

:fail
echo.
echo Setup did not complete successfully. See the messages above.
endlocal
exit /b 1
