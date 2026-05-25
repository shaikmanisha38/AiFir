@echo off
title AI FIR MVP - Setup & Runner
echo =================================================================
echo           AI FIR Assistant - Local MVP Setup ^& Runner
echo =================================================================
echo.

:: ── 1. Check Node.js ────────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org/
    pause & exit /b 1
)
echo [OK] Node.js found.

:: ── 2. Backend Setup ────────────────────────────────────────────
echo.
echo === Setting up Node.js Backend ===
cd backend

if not exist node_modules (
    echo Installing Node packages (first time - takes ~30s)...
    call npm install
)

:: Start backend in a separate CMD window (auto-reload with --watch)
start "AI FIR — Backend (Express :8000)" cmd /k "cd /d %~dp0backend && npm run dev"
cd ..

:: ── 3. Frontend Setup ────────────────────────────────────────────
echo.
echo === Setting up React Frontend ===
cd frontend

if not exist node_modules (
    echo Installing Node packages (first time - takes ~30s)...
    call npm install
)

:: Start frontend in a separate CMD window
start "AI FIR — Frontend (React :5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
cd ..

:: ── 4. Open browser ──────────────────────────────────────────────
echo.
echo Waiting for servers to start (5 seconds)...
timeout /t 5 >nul
start http://localhost:5173/

echo.
echo =================================================================
echo  [SUCCESS] AI FIR Assistant is running!
echo.
echo   Frontend  →  http://localhost:5173
echo   Backend   →  http://localhost:8000
echo.
echo  Close the two server windows to stop everything.
echo =================================================================
pause
exit /b 0
