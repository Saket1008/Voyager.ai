from fastapi import APIRouter, HTTPException, status
from app.models.itinerary import ItineraryRequest, ItineraryResponse, ErrorResponse
from app.services.gemini_service import GeminiService
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["itinerary"])

# Initialize Gemini service
gemini_service = None

def get_gemini_service():
    """Get or create Gemini service instance"""
    global gemini_service
    if gemini_service is None:
        try:
            gemini_service = GeminiService()
        except Exception as e:
            logger.error(f"Failed to initialize Gemini service: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI service is not available. Please check configuration."
            )
    return gemini_service


@router.post(
    "/generate-itinerary",
    response_model=ItineraryResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Bad request"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Generate Travel Itinerary",
    description="Generate a detailed travel itinerary based on natural language input"
)
async def generate_itinerary(request: ItineraryRequest):
    """
    Generate a comprehensive travel itinerary using AI.
    
    - **query**: Natural language description of your trip (e.g., "7 days in Japan focusing on culture and food")
    - **days**: Number of days for the trip (1-30)
    - **budget**: Optional budget preference (low/medium/high)
    - **travelers**: Optional number of travelers (default: 1)
    """
    
    try:
        # Validate input
        if not request.query.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trip query cannot be empty"
            )
        
        if len(request.query.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trip query must be at least 10 characters long"
            )
        
        logger.info(f"Received itinerary request: {request.days} days, query: {request.query[:50]}...")
        
        # Get Gemini service and generate itinerary
        service = get_gemini_service()
        itinerary = await service.generate_itinerary(request)
        
        logger.info("Successfully generated itinerary")
        return itinerary
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating itinerary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.get(
    "/health",
    summary="Health Check",
    description="Check if the API and AI service are working properly"
)
async def health_check():
    """
    Health check endpoint to verify API and AI service status
    """
    try:
        service = get_gemini_service()
        ai_status = await service.test_connection()
        
        return {
            "status": "healthy",
            "api": "operational",
            "ai_service": "operational" if ai_status else "degraded",
            "message": "All services are running" if ai_status else "AI service may be experiencing issues"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service is currently unavailable"
        )
