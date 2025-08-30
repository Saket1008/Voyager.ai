@echo off
echo Starting Voyager AI Development Servers...
echo.
echo Starting Backend Server (Port 5000)...
start "Backend Server" cmd /k "cd server && npm run dev"
echo.
echo Starting Frontend Server (Port 5173)...
start "Frontend Server" cmd /k "cd frontend && npm run dev"
echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause
