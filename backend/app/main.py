from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.itinerary import router as itinerary_router
import os
import logging
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Voyager AI API",
    description="Intelligent Travel Itinerary Generator - Generate bespoke travel itineraries using AI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", '["http://localhost:3000"]')
try:
    cors_origins = json.loads(cors_origins)
except json.JSONDecodeError:
    cors_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(itinerary_router)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred. Please try again later."
        }
    )

# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """
    Root endpoint providing basic API information
    """
    return {
        "message": "Welcome to Voyager AI API",
        "description": "Intelligent Travel Itinerary Generator",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    """
    Application startup tasks
    """
    logger.info("Starting Voyager AI API...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"CORS origins: {cors_origins}")
    
    # Verify required environment variables
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.warning("GEMINI_API_KEY not found. AI features will not work.")
    else:
        logger.info("Gemini API key found")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """
    Application shutdown tasks
    """
    logger.info("Shutting down Voyager AI API...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
