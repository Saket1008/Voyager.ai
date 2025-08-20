from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ItineraryRequest(BaseModel):
    """Request model for itinerary generation"""
    query: str = Field(..., description="Natural language trip description")
    days: int = Field(..., ge=1, le=30, description="Number of days for the trip")
    budget: Optional[str] = Field(None, description="Budget preference (low/medium/high)")
    travelers: Optional[int] = Field(1, ge=1, le=20, description="Number of travelers")


class Activity(BaseModel):
    """Individual activity within a day"""
    time: str = Field(..., description="Time of activity (e.g., '09:00 AM')")
    title: str = Field(..., description="Activity title")
    description: str = Field(..., description="Detailed description of the activity")
    location: str = Field(..., description="Location/address of the activity")
    duration: str = Field(..., description="Expected duration (e.g., '2 hours')")
    estimated_cost: Optional[str] = Field(None, description="Estimated cost range")
    tips: Optional[str] = Field(None, description="Helpful tips for the activity")
    booking_info: Optional[str] = Field(None, description="How to book or access")


class DayItinerary(BaseModel):
    """Complete itinerary for a single day"""
    day_number: int = Field(..., description="Day number in the trip")
    date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    city: str = Field(..., description="Primary city for this day")
    theme: str = Field(..., description="Main theme/focus of the day")
    activities: List[Activity] = Field(..., description="List of activities for the day")
    transportation: Optional[str] = Field(None, description="Transportation notes")
    accommodation: Optional[str] = Field(None, description="Accommodation suggestions")
    total_estimated_cost: Optional[str] = Field(None, description="Total cost for the day")


class ItineraryResponse(BaseModel):
    """Complete itinerary response"""
    trip_title: str = Field(..., description="Generated title for the trip")
    overview: str = Field(..., description="Brief overview of the entire trip")
    total_days: int = Field(..., description="Total number of days")
    destinations: List[str] = Field(..., description="List of destinations/cities")
    best_time_to_visit: Optional[str] = Field(None, description="Recommended travel time")
    general_tips: Optional[List[str]] = Field(None, description="General travel tips")
    estimated_total_cost: Optional[str] = Field(None, description="Total trip cost estimate")
    daily_itineraries: List[DayItinerary] = Field(..., description="Day-by-day itinerary")
    generated_at: datetime = Field(default_factory=datetime.now, description="Generation timestamp")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")
