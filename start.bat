@echo off
echo Starting Voyager AI Servers...
echo.

echo Starting Backend Server on port 5000...
start "Backend" cmd /k "cd server && npm run dev"

echo Starting Frontend Server on port 5173...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Close this window when done.
pause
