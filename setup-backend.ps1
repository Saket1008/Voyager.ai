# Voyager AI Backend Setup Script
Write-Host "🚀 Setting up Voyager AI Backend..." -ForegroundColor Cyan

# Change to backend directory
Set-Location backend

# Function to check if Python is available
function Test-Python {
    $pythonCommands = @("python", "py", "python3")
    
    foreach ($cmd in $pythonCommands) {
        try {
            $version = & $cmd --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Found Python: $version using command '$cmd'" -ForegroundColor Green
                return $cmd
            }
        }
        catch {
            # Continue to next command
        }
    }
    return $null
}

# Check for Python installation
$pythonCmd = Test-Python

if (-not $pythonCmd) {
    Write-Host "❌ Python not found!" -ForegroundColor Red
    Write-Host "📥 Please install Python from one of these options:" -ForegroundColor Yellow
    Write-Host "   1. Microsoft Store: Search for 'Python 3.11' or 'Python 3.12'" -ForegroundColor White
    Write-Host "   2. Official Python: https://python.org/downloads" -ForegroundColor White
    Write-Host "   3. Via winget: winget install Python.Python.3.11" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  Make sure to check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    exit 1
}

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "📦 Creating virtual environment..." -ForegroundColor Yellow
    try {
        & $pythonCmd -m venv venv
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create virtual environment"
        }
        Write-Host "✅ Virtual environment created successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to create virtual environment: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Virtual environment already exists!" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "🔄 Activating virtual environment..." -ForegroundColor Yellow
try {
    & ".\venv\Scripts\Activate.ps1"
    Write-Host "✅ Virtual environment activated!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to activate virtual environment. Trying alternative method..." -ForegroundColor Yellow
    # Alternative activation method
    $env:VIRTUAL_ENV = "$(Get-Location)\venv"
    $env:PATH = "$env:VIRTUAL_ENV\Scripts;$env:PATH"
}

# Install requirements
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    try {
        & python -m pip install --upgrade pip
        & python -m pip install -r requirements.txt
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
        } else {
            throw "pip install failed"
        }
    }
    catch {
        Write-Host "❌ Failed to install dependencies: $_" -ForegroundColor Red
        Write-Host "🔧 Trying alternative installation method..." -ForegroundColor Yellow
        & pip install -r requirements.txt
    }
} else {
    Write-Host "⚠️  No requirements.txt found!" -ForegroundColor Yellow
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Host "📄 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created! Please edit it with your API keys." -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Backend setup complete!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Edit backend/.env with your API keys" -ForegroundColor White
Write-Host "   2. Run: npm run dev:backend" -ForegroundColor White
Write-Host "   3. Or run full app: npm run dev" -ForegroundColor White
Write-Host ""

# Return to original directory
Set-Location ..
