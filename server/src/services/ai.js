import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Use a current, available model. You can switch to 2.5 Pro/Flash if needed.
const MODEL = 'gemini-1.5-pro';

// ------------------ Prompt templates ------------------
export const PROMPTS = {
  suggestion: ({ destinations }) => `You are Voyager AI. Based on the selected places, suggest days, best travel months, and a budget band for a decent trip from India.\n\nDestinations: ${destinations.join(', ')}\n\nReturn ONLY valid JSON like:\n{\n  "recommended_days": "8-10",\n  "best_months": "April–June",\n  "estimated_budget": "₹1.8L – ₹2.4L for 2 adults"\n}`,

  itinerary: (payload) => `You are Voyager AI, an expert travel planner.\nThe user is vegetarian (Jain-friendly). Plan respectfully.\nReturn structured JSON exactly as the schema describes. No prose outside JSON.\n\nUser Inputs:\n${JSON.stringify(payload, null, 2)}\n\nSchema:\n{\n  "summary": {\n    "recommended_days": "string",\n    "best_months": "string",\n    "estimated_budget": "string",\n    "key_tips": ["string"]\n  },\n  "flights": [ { "from": "string", "to": "string", "date": "YYYY-MM-DD", "airline": "string" } ],\n  "hotels": [ { "city": "string", "name": "string", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD" } ],\n  "daily_plan": [ { "day": "number", "city": "string", "activities": ["string"] } ],\n  "transport": ["string"],\n  "notes": ["string"]\n}`,
};

// ------------------ Helpers ------------------
async function callGemini({ prompt }) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const resp = await model.generateContent(prompt);
  const text = resp?.response?.text?.();
  return text || '';
}

function tryParseJson(text) {
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ------------------ Public API ------------------
export async function generateSuggestion({ destinations }) {
  const prompt = PROMPTS.suggestion({ destinations });
  const text = await callGemini({ prompt });
  const json = tryParseJson(text);
  if (!json) throw new Error('Gemini suggestion parsing failed');
  return json;
}

export async function generateItinerary(payload) {
  const prompt = PROMPTS.itinerary(payload);
  const text = await callGemini({ prompt });
  const json = tryParseJson(text);
  if (!json) throw new Error('Gemini itinerary parsing failed');
  return json;
}

export async function generateChat({ message, context }) {
  const prompt = `You are Voyager AI, a helpful travel assistant. Answer the user's question succinctly and helpfully.\n\nContext: ${JSON.stringify(context || {}, null, 2)}\n\nUser: ${message}\nAssistant:`;
  const text = await callGemini({ prompt });
  const parsed = tryParseJson(text);
  return parsed ?? { reply: text };
}
