@echo off
title AI FIR MVP Local Setup & Runner
echo =================================================================
echo             AI FIR Assistant - Local MVP Setup & Runner
echo =================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please download it from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Python was not found on your system path.
    echo Attempting to install Python 3.11 via winget...
    echo.
    winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Python automatically.
        echo Please install Python manually from the Microsoft Store or https://www.python.org/
        echo.
        echo Starting Frontend-only Standalone Mode...
        goto start_frontend_only
    )
    echo [OK] Python installed successfully. Please restart your terminal/run.bat to register the new PATH.
    echo Starting Frontend-only Standalone Mode for now...
    goto start_frontend_only
)
echo [OK] Python found.

:: Backend Setup
echo.
echo === Setting up FastAPI Backend ===
cd backend
if not exist venv (
    echo Creating Python virtual environment (venv)...
    python -m venv venv
)
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo Installing backend requirements...
python -m pip install --upgrade pip
pip install -r requirements.txt
echo [OK] Backend environment prepared.

:: Start Backend in separate window
echo Starting FastAPI Backend server on http://localhost:8000...
start "AI FIR Backend (FastAPI)" cmd /k "call venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"
cd ..

:start_frontend
:: Frontend Setup
echo.
echo === Setting up React Frontend ===
cd frontend
if not exist node_modules (
    echo Installing React dependencies (this may take a minute)...
    call npm install
)
echo Starting React Vite Frontend...
start "AI FIR Frontend (React)" cmd /k "npm run dev"
echo.
echo Waiting for servers to initialize...
timeout /t 5 >nul
echo Opening web browser...
start http://localhost:5173/
echo.
echo =================================================================
echo [SUCCESS] Both servers are running!
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:8000
echo.
echo Keep this window open or close it when done. To stop the servers,
echo close their respective console windows.
echo =================================================================
cd ..
pause
exit /b 0

:start_frontend_only
echo.
echo === Running in Standalone Browser-only Mode ===
echo (No backend database, local SQLite, or Ollama, but fully functional using localStorage!)
echo.
cd frontend
if not exist node_modules (
    echo Installing React dependencies...
    call npm install
)
echo Starting React Vite Frontend...
start "AI FIR Frontend (React)" cmd /k "npm run dev"
timeout /t 4 >nul
start http://localhost:5173/
cd ..
pause
exit /b 0
