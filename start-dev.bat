@echo off
echo Starting Voyager AI Development Environment...
echo.

REM Configure pyenv-win if it exists
if exist "%USERPROFILE%\.pyenv\pyenv-win" (
    echo Configuring pyenv-win...
    set PYENV=%USERPROFILE%\.pyenv\pyenv-win
    set PYENV_ROOT=%USERPROFILE%\.pyenv\pyenv-win
    set PYENV_HOME=%USERPROFILE%\.pyenv\pyenv-win
    set PATH=%USERPROFILE%\.pyenv\pyenv-win\bin;%USERPROFILE%\.pyenv\pyenv-win\shims;%PATH%
    echo ✓ pyenv-win configured
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not available
    echo.
    echo Please install Python using one of these methods:
    echo 1. Microsoft Store: Search for "Python 3.11" or "Python 3.12"
    echo 2. Official Python: https://python.org/downloads
    echo 3. pyenv-win: winget install pyenv-win, then pyenv install 3.11.0
    echo.
    echo If using pyenv-win, make sure to add to your PATH:
    echo   %%USERPROFILE%%\.pyenv\pyenv-win\bin
    echo   %%USERPROFILE%%\.pyenv\pyenv-win\shims
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ and try again
    pause
    exit /b 1
)

echo ✓ Python and Node.js are installed
echo.

REM Setup backend
echo Setting up backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install backend dependencies
echo Installing backend dependencies...
pip install -r requirements.txt

REM Check for .env file
if not exist ".env" (
    echo.
    echo ⚠️  WARNING: .env file not found!
    echo Please copy .env.example to .env and add your GEMINI_API_KEY
    echo.
    echo To get a Gemini API key:
    echo 1. Go to https://makersuite.google.com/app/apikey
    echo 2. Create a new API key
    echo 3. Copy .env.example to .env
    echo 4. Add your API key to the .env file
    echo.
    pause
)

cd ..

REM Setup frontend
echo Setting up frontend...
cd frontend

REM Install frontend dependencies
echo Installing frontend dependencies...
npm install

cd ..

echo.
echo ✅ Setup complete!
echo.
echo To start the development servers:
echo.
echo Backend (from backend directory):
echo   venv\Scripts\activate
echo   uvicorn app.main:app --reload
echo.
echo Frontend (from frontend directory):
echo   npm run dev
echo.
echo Then open http://localhost:3000 in your browser
echo.
pause
