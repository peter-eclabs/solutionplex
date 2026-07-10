@echo off
REM Solutionplex dev launcher
REM Starts the FastAPI backend (uvicorn, port 8080, auto-reload on code changes)
REM and the React frontend (Vite dev server, port 5174).
REM Each process opens in its own window; close those windows to stop.

setlocal
set "ROOT=%~dp0"

REM Backend: reload enabled so code changes are detected automatically
start "Solutionplex-Server" cmd /k "cd /d "%ROOT%server" && uv run uvicorn main:app --reload --port 8080"

REM Frontend: VITE_API_URL points at the backend on 8080
start "Solutionplex-Client" cmd /k "cd /d "%ROOT%client" && set "VITE_API_URL=http://localhost:8080" && npm run dev -- --port 5174"

echo Solutionplex dev servers starting...
echo   Server : http://localhost:8080   (auto-reload enabled)
echo   Client : http://localhost:5174
echo Close the two opened windows to stop the servers.

endlocal
