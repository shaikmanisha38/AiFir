#!/bin/bash

# AI FIR Assistant - Linux/macOS/Codespaces Setup & Runner
echo "================================================================="
echo "            AI FIR Assistant - Local MVP Setup & Runner"
echo "================================================================="
echo.

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install it first."
    exit 1
fi
echo "[OK] Node.js found."

# Check Python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    if command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python was not found. Please install Python 3."
        exit 1
    fi
fi
echo "[OK] Python found ($PYTHON_CMD)."

# Backend Setup
echo ""
echo "=== Setting up FastAPI Backend ==="
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment (venv)..."
    $PYTHON_CMD -m venv venv
fi
echo "Activating virtual environment..."
source venv/bin/activate
echo "Installing backend requirements..."
pip install --upgrade pip
pip install -r requirements.txt
echo "[OK] Backend environment prepared."
cd ..

# Frontend Setup
echo ""
echo "=== Setting up React Frontend ==="
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing React dependencies..."
    npm install
fi
echo "[OK] Frontend environment prepared."
cd ..

# Start both servers in parallel
echo ""
echo "=== Launching Servers ==="

# Trap exit signals to terminate child background jobs
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "[SUCCESS] Both servers are starting!"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "Press [CTRL+C] to stop both servers."
echo "================================================================="

# Keep script running to maintain logs
wait
