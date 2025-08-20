import json
import os
import logging
from typing import Dict, Any
import google.generativeai as genai
from app.models.itinerary import ItineraryRequest, ItineraryResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiService:
    """Service for integrating with Google Gemini API"""
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
    
    def generate_itinerary_prompt(self, request: ItineraryRequest) -> str:
        """Generate a detailed prompt for the Gemini API"""
        
        budget_instruction = f" with a {request.budget} budget" if request.budget else ""
        travelers_instruction = f" for {request.travelers} traveler{'s' if request.travelers > 1 else ''}" if request.travelers else ""
        
        prompt = f"""
You are an expert travel planner. Create a detailed {request.days}-day travel itinerary{budget_instruction}{travelers_instruction} based on this request: "{request.query}"

Return your response as a valid JSON object with the following exact structure:

{{
    "trip_title": "Engaging title for the trip",
    "overview": "Brief 2-3 sentence overview of the entire trip",
    "total_days": {request.days},
    "destinations": ["City 1", "City 2", "etc."],
    "best_time_to_visit": "Recommended travel season/months",
    "general_tips": ["Tip 1", "Tip 2", "Tip 3"],
    "estimated_total_cost": "$X,XXX - $X,XXX per person",
    "daily_itineraries": [
        {{
            "day_number": 1,
            "date": null,
            "city": "Primary city for this day",
            "theme": "Main theme/focus of the day",
            "activities": [
                {{
                    "time": "09:00 AM",
                    "title": "Activity Name",
                    "description": "Detailed description of what you'll do and see",
                    "location": "Specific address or area",
                    "duration": "2 hours",
                    "estimated_cost": "$XX - $XX per person",
                    "tips": "Helpful tip for this activity",
                    "booking_info": "How to book or access this activity"
                }}
            ],
            "transportation": "How to get around this day",
            "accommodation": "Where to stay (area/type)",
            "total_estimated_cost": "$XXX per person"
        }}
    ]
}}

IMPORTANT REQUIREMENTS:
1. Create exactly {request.days} daily itineraries
2. Include 4-6 activities per day with realistic timing
3. Consider travel time between locations
4. Include specific locations, not just generic suggestions
5. Provide realistic cost estimates
6. Add practical tips and booking information
7. Ensure activities match the interests mentioned in the query
8. For multi-city trips, plan logical progression and transportation
9. Return ONLY the JSON object, no additional text or formatting
10. Make sure all JSON syntax is valid and properly escaped
"""
        
        return prompt
    
    async def generate_itinerary(self, request: ItineraryRequest) -> ItineraryResponse:
        """Generate an itinerary using Google Gemini API"""
        
        try:
            prompt = self.generate_itinerary_prompt(request)
            logger.info(f"Generating itinerary for {request.days}-day trip: {request.query[:100]}...")
            
            # Generate content using Gemini
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    top_p=0.8,
                    top_k=40,
                    max_output_tokens=8192,
                )
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini API")
            
            # Clean the response text (remove any markdown formatting)
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            # Parse JSON response
            try:
                itinerary_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.error(f"Response text: {response_text[:500]}...")
                raise ValueError(f"Invalid JSON response from AI: {str(e)}")
            
            # Validate and create ItineraryResponse
            itinerary_response = ItineraryResponse(**itinerary_data)
            
            logger.info("Successfully generated itinerary")
            return itinerary_response
            
        except Exception as e:
            logger.error(f"Error generating itinerary: {str(e)}")
            raise Exception(f"Failed to generate itinerary: {str(e)}")
    
    async def test_connection(self) -> bool:
        """Test the connection to Gemini API"""
        try:
            response = self.model.generate_content("Hello, please respond with 'API connection successful'")
            return bool(response.text and "successful" in response.text.lower())
        except Exception as e:
            logger.error(f"Gemini API connection test failed: {str(e)}")
            return False
