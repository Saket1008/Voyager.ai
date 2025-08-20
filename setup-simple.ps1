# Simple Voyager AI Backend Setup
Write-Host "Setting up Voyager AI Backend..." -ForegroundColor Green

# Change to backend directory
Set-Location backend

# Try to find Python
$pythonFound = $false
$pythonCmd = ""

# Test different Python commands
$commands = @("python", "py", "python3")
foreach ($cmd in $commands) {
    try {
        $null = & $cmd --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $cmd
            $pythonFound = $true
            Write-Host "Found Python using: $cmd" -ForegroundColor Green
            break
        }
    }
    catch {
        # Continue
    }
}

if (-not $pythonFound) {
    Write-Host "Python not found! Please install Python and add to PATH." -ForegroundColor Red
    Write-Host "You can install from: https://python.org or Microsoft Store" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}

# Create virtual environment if it doesn't exist
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    & $pythonCmd -m venv venv
}

# Try to install requirements
if (Test-Path "requirements.txt") {
    Write-Host "Installing requirements..." -ForegroundColor Yellow
    # Try with venv python first
    if (Test-Path "venv\Scripts\python.exe") {
        & "venv\Scripts\python.exe" -m pip install -r requirements.txt
    } else {
        # Fallback to system python
        & $pythonCmd -m pip install -r requirements.txt
    }
} else {
    Write-Host "No requirements.txt found" -ForegroundColor Yellow
}

Write-Host "Backend setup complete!" -ForegroundColor Green
Set-Location ..
