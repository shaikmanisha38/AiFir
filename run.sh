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

# Backend Setup
echo ""
echo "=== Setting up Node.js Backend ==="
cd backend
if [ ! -d "node_modules" ]; then
    echo "Installing Node packages..."
    npm install
fi
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

# Start backend (auto-reload with --watch)
cd backend
node --watch server.mjs &
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
