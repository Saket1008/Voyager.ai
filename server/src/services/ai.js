import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('Warning: GEMINI_API_KEY is not set. Itinerary generation will fail.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

export async function generateSuggestions(location) {
  const prompt = `You are a travel planner. Given location(s): ${location}, suggest:
  - Ideal number of days to visit
  - Best months to travel
  - Estimated budget for a decent trip
  Respond in JSON strictly with keys: days, months, budget.`;

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

function coerceStructuredItinerary(text) {
  try {
    // Try to extract JSON from code fences if present
    const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonText);

    const flights = Array.isArray(parsed.flights) ? parsed.flights : [];
    const hotels = Array.isArray(parsed.hotels) ? parsed.hotels : [];
    const activities = Array.isArray(parsed.activities) ? parsed.activities : [];

    return { flights, hotels, activities };
  } catch (_) {
    // Best-effort fallback structure
    return { flights: [], hotels: [], activities: [] };
  }
}

export async function generateItinerary(data) {
  const prompt = `Generate a detailed travel itinerary in JSON. User inputs: ${JSON.stringify(
    data
  )}. Include daily plan, activities, and recommendations.`;

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return coerceStructuredItinerary(text);
}

export default { generateItinerary, generateSuggestions };


