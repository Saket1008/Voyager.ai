#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Voyager AI Development Environment Setup
.DESCRIPTION
    Sets up the development environment for Voyager AI project with proper Python configuration.
#>

Write-Host "🚀 Starting Voyager AI Development Environment..." -ForegroundColor Cyan
Write-Host

# Configure pyenv-win if it exists
if (Test-Path "$env:USERPROFILE\.pyenv\pyenv-win") {
    Write-Host "⚙️  Configuring pyenv-win..." -ForegroundColor Yellow
    $env:PYENV = "$env:USERPROFILE\.pyenv\pyenv-win"
    $env:PYENV_ROOT = "$env:USERPROFILE\.pyenv\pyenv-win"
    $env:PYENV_HOME = "$env:USERPROFILE\.pyenv\pyenv-win"
    $env:PATH = "$env:USERPROFILE\.pyenv\pyenv-win\bin;$env:USERPROFILE\.pyenv\pyenv-win\shims;$env:PATH"
    Write-Host "✅ pyenv-win configured" -ForegroundColor Green
    Write-Host
}

# Check Python
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "❌ Python is not available" -ForegroundColor Red
    Write-Host
    Write-Host "Please install Python using one of these methods:" -ForegroundColor Yellow
    Write-Host "1. Microsoft Store: Search for 'Python 3.11' or 'Python 3.12'" -ForegroundColor White
    Write-Host "2. Official Python: https://python.org/downloads" -ForegroundColor White
    Write-Host "3. pyenv-win: winget install pyenv-win, then pyenv install 3.11.0" -ForegroundColor White
    Write-Host
    Write-Host "If using pyenv-win, make sure it's in your PATH" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host

# Setup Backend
Write-Host "🔧 Setting up backend..." -ForegroundColor Cyan
Set-Location backend

# Create virtual environment if it doesn't exist
if (!(Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Check for .env file
if (!(Test-Path ".env")) {
    Write-Host
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "Please copy .env.example to .env and add your GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host
    Write-Host "To get a Gemini API key:" -ForegroundColor White
    Write-Host "1. Go to https://makersuite.google.com/app/apikey" -ForegroundColor White
    Write-Host "2. Create a new API key" -ForegroundColor White
    Write-Host "3. Copy .env.example to .env" -ForegroundColor White
    Write-Host "4. Add your API key to the .env file" -ForegroundColor White
    Write-Host
    Read-Host "Press Enter to continue"
}

Set-Location ..

# Setup Frontend
Write-Host "🔧 Setting up frontend..." -ForegroundColor Cyan
Set-Location frontend

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install

Set-Location ..

Write-Host
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host
Write-Host "To start the development servers:" -ForegroundColor White
Write-Host
Write-Host "Backend (Terminal 1):" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  uvicorn app.main:app --reload" -ForegroundColor White
Write-Host
Write-Host "Frontend (Terminal 2):" -ForegroundColor Cyan
Write-Host "  cd frontend" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host
Write-Host "Then open http://localhost:3000 in your browser" -ForegroundColor Yellow
Write-Host

Read-Host "Press Enter to exit"
