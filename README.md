# Voyager AI - Intelligent Travel Itinerary Generator

An intelligent platform that uses Generative AI to create bespoke, end-to-end travel itineraries in seconds.

## Project Structure

```
voyager.ai/
├── backend/                    # FastAPI Python Backend
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   ├── models/            # Pydantic models
│   │   ├── services/          # Business logic & AI integration
│   │   └── main.py            # FastAPI application
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # Next.js React Frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Next.js pages
│   │   └── styles/            # Tailwind CSS styles
│   ├── package.json
│   └── next.config.js
└── README.md
```

## Technology Stack

- **Frontend**: React with Next.js, Tailwind CSS
- **Backend**: Python with FastAPI
- **AI Integration**: Google Gemini API
- **Database**: PostgreSQL (future)
- **Deployment**: Vercel (Frontend), Heroku (Backend)

## Getting Started

### Quick Setup (Recommended)

**Option 1: PowerShell Script (Recommended)**
```powershell
.\setup-dev.ps1
```

**Option 2: Batch Script**
```cmd
start-dev.bat
```

### Manual Setup

#### Prerequisites
- **Python 3.9+**: We recommend Python 3.9.13 for maximum compatibility
- **Node.js 18+**: For the frontend
- **Gemini API Key**: From [Google AI Studio](https://makersuite.google.com/app/apikey)

#### Python Setup Options

**Option A: pyenv-win (Recommended for version management)**
```powershell
# Install pyenv-win
winget install pyenv-win

# Install and use Python 3.9.13
pyenv install 3.9.13
pyenv global 3.9.13

# Add to PATH (if not automatic)
$env:PATH = "$env:USERPROFILE\.pyenv\pyenv-win\bin;$env:USERPROFILE\.pyenv\pyenv-win\shims;$env:PATH"
```

**Option B: Microsoft Store**
1. Search for "Python 3.11" or "Python 3.12" in Microsoft Store
2. Install and it will be added to PATH automatically

**Option C: Official Python**
1. Download from [python.org](https://python.org/downloads)
2. **Important**: Check "Add Python to PATH" during installation

#### Backend Setup
```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create environment file
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the server
uvicorn app.main:app --reload
```

#### Frontend Setup
```powershell
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

#### Environment Variables
Create `backend/.env` from `backend/.env.example`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
ENVIRONMENT=development
CORS_ORIGINS=["http://localhost:3000"]
```

## Usage

1. **Start the Backend** (Terminal 1):
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload
   ```
   Backend will be available at: http://localhost:8000
   API Documentation: http://localhost:8000/docs

2. **Start the Frontend** (Terminal 2):
   ```powershell
   cd frontend
   npm run dev
   ```
   Frontend will be available at: http://localhost:3000

3. **Use the Application**:
   - Open http://localhost:3000 in your browser
   - Enter a trip description (e.g., "7 days in Japan focusing on culture and food")
   - Specify number of days, travelers, and budget preference
   - Click "Generate My Itinerary" to get your AI-powered travel plan

## Troubleshooting

### Python Issues

**"Python was not found" error:**
1. Disable Microsoft Store Python aliases:
   - Go to Settings → Apps → Advanced app settings → App execution aliases
   - Turn OFF "python.exe" and "python3.exe"
2. Ensure Python is in PATH:
   ```powershell
   # Check if Python is accessible
   python --version
   
   # If using pyenv-win, configure it:
   $env:PATH = "$env:USERPROFILE\.pyenv\pyenv-win\bin;$env:USERPROFILE\.pyenv\pyenv-win\shims;$env:PATH"
   ```

**Virtual environment activation issues:**
```powershell
# If Activate.ps1 fails, try:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Backend Issues

**Gemini API errors:**
- Ensure your API key is correctly set in `backend/.env`
- Verify the API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)
- Check your API usage quotas

**Port 8000 already in use:**
```powershell
# Use a different port
uvicorn app.main:app --reload --port 8001
```

### Frontend Issues

**npm install failures:**
```powershell
# Clear npm cache and reinstall
npm cache clean --force
rm -r node_modules
rm package-lock.json
npm install
```

**Port 3000 already in use:**
- Next.js will automatically suggest an alternative port
- Or manually specify: `npm run dev -- -p 3001`

## API Endpoints

- `GET /` - API information
- `GET /api/v1/health` - Health check
- `POST /api/v1/generate-itinerary` - Generate travel itinerary
- `GET /docs` - Interactive API documentation

## MVP Features

- ✅ Natural language trip query input
- ✅ AI-generated day-by-day itineraries
- ✅ Clean, responsive UI with Tailwind CSS
- ✅ Google Gemini API integration
- ✅ Activity details with costs, tips, and booking info
- ✅ Transportation and accommodation recommendations
- ✅ Budget and traveler preferences
- ✅ Real-time API status monitoring
- ✅ Comprehensive error handling

## Development Status

🎉 **MVP Complete!** The application is fully functional and ready for:
1. **Phase 1**: Adding affiliate links for monetization
2. **Phase 2**: Premium subscription features
3. **Phase 3**: B2B API for travel agencies

## Contributing

This is a demonstration project showcasing modern full-stack development with AI integration. The codebase follows best practices for scalability and maintainability.
