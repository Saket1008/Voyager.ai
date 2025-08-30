import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000',
  timeout: 120000, // 2 minutes timeout for AI generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    
    // Handle different error types
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          throw new Error(data.detail || 'Invalid request. Please check your input.');
        case 500:
          throw new Error(data.detail || 'Server error. Please try again later.');
        case 503:
          throw new Error('Service is currently unavailable. Please try again later.');
        default:
          throw new Error(data.detail || `Request failed with status ${status}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('Unable to connect to the server. Please check your connection.');
    } else {
      // Something happened in setting up the request
      throw new Error('An unexpected error occurred. Please try again.');
    }
  }
);

// API service methods
export const apiService = {
  /**
   * Generate travel itinerary
   * @param {Object} requestData - The itinerary request data
   * @param {string} requestData.query - Trip description
   * @param {number} requestData.days - Number of days
   * @param {string} [requestData.budget] - Budget preference
   * @param {number} [requestData.travelers] - Number of travelers
   * @returns {Promise<Object>} The generated itinerary
   */
  async generateItinerary(requestData) {
    try {
      const response = await api.post('/api/v1/generate-itinerary', requestData);
      return response.data;
    } catch (error) {
      console.error('Generate itinerary error:', error);
      throw error;
    }
  },

  /**
   * Health check endpoint
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await api.get('/api/v1/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  /**
   * Get API root information
   * @returns {Promise<Object>} API information
   */
  async getApiInfo() {
    try {
      const response = await api.get('/');
      return response.data;
    } catch (error) {
      console.error('API info error:', error);
      throw error;
    }
  }
};

export default apiService;
