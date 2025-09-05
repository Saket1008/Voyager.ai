import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';

// Lazy init for Gemini client so dotenv can be loaded before first use.
let _genAI = null;
let _genAI25 = null;
let _model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
function getGenAI() {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Avoid spamming logs — warn once
    if (!getGenAI._warned) {
      console.warn('[VoyagerAI] GEMINI_API_KEY not found in environment; Gemini features disabled.');
      getGenAI._warned = true;
    }
    return null;
  }
  try {
    _genAI = new GoogleGenerativeAI(key);
    _genAI25 = new GoogleGenAI({ apiKey: key });
    // refresh model name from env at init time
    _model = process.env.GEMINI_MODEL || _model;
    return _genAI;
  } catch (e) {
    console.warn('[VoyagerAI] Failed to initialize Gemini client:', e?.message || e);
    return null;
  }
}

// ------------------ Chat flow stages ------------------
export const STAGES = {
  greeting: 'greeting',
  ask_intent: 'ask_intent', // ask whether user has specific locations or only a region
  input_locations: 'input_locations',
  input_region: 'input_region',
  // Trip core
  ask_duration: 'ask_duration', // number of days + small flexibility checkbox (±1-2 days)
  ask_dates: 'ask_dates', // start date picker; auto-calc end date based on days; date flexibility radios
  // Traveler profile
  ask_travelers: 'ask_travelers', // solo/couple/family/friends
  ask_pace: 'ask_pace',
  ask_interests: 'ask_interests',
  ask_budget: 'ask_budget',
  // (DNA-related questions removed — captured during onboarding)
  // Final polish
  finalize_details: 'finalize_details', // combines must_haves and must_nots, with a No, Proceed option or free text
  // Legacy/general
  ask_experience: 'ask_experience',
  ask_preferences: 'ask_preferences',
  generate_suggestions: 'generate_suggestions',
  iterate: 'iterate',
};

// Feature flag: whether to use Gemini for per-turn chat prompts (default: false to save cost)
const USE_GEMINI_CHAT = String(process.env.USE_GEMINI_CHAT || '').toLowerCase() === 'true';

const NEXT_STAGE = {
  [STAGES.greeting]: STAGES.ask_intent,
  [STAGES.ask_intent]: null, // Client chooses: input_locations or input_region
  [STAGES.input_locations]: STAGES.ask_duration,
  [STAGES.input_region]: STAGES.ask_duration,
  [STAGES.ask_duration]: STAGES.ask_dates,
  [STAGES.ask_dates]: STAGES.ask_travelers,
  [STAGES.ask_travelers]: STAGES.ask_pace,
  [STAGES.ask_pace]: STAGES.ask_interests,
  [STAGES.ask_interests]: STAGES.ask_budget,
  [STAGES.ask_budget]: STAGES.finalize_details,
  [STAGES.finalize_details]: STAGES.generate_suggestions,
  [STAGES.generate_suggestions]: STAGES.iterate,
  [STAGES.iterate]: STAGES.iterate,
};

// ------------------ Prompt templates ------------------
const EXPECTED_BEHAVIOR = {
  [STAGES.greeting]: 'Greet the user warmly and immediately ask: “Do you already have a specific list of locations in mind, or do you only know a region?” Keep it short and friendly. Include two options in your wording: “I have specific locations” or “I only know a region.”',
  [STAGES.ask_intent]: 'Briefly clarify what you need next. Ask the user to pick one: provide specific locations or a general region. Keep it very short and conversational.',
  [STAGES.input_locations]: 'Acknowledge the provided locations (if any). Ask them to type the names of the locations they want to explore. Keep it short and helpful.',
  [STAGES.input_region]: 'Acknowledge the provided region (if any). Ask them to type the region or area they’re interested in. Keep it short and encouraging.',
  [STAGES.ask_duration]: 'Briefly ask for the number of days. Keep it one short sentence. If you know a typical duration for the selected places, mention it succinctly as a suggestion.',
  [STAGES.ask_dates]: 'Ask them to pick a start date. Mention that the return date will auto-calculate from the chosen number of days. Keep it short. If seasonality is known, mention the best months very briefly.',
  [STAGES.ask_travelers]: 'Ask who is traveling: Solo, Couple, Family, or Group of Friends. Keep it short.',
  [STAGES.ask_pace]: 'Ask for preferred pace: Relaxed, Balanced, or Action-Packed. One short sentence.',
  [STAGES.ask_interests]: 'Ask for main interests with a few examples (History, Food, Adventure, Art, Nightlife, Shopping, Relaxation). Allow choosing multiple. One short sentence.',
  [STAGES.ask_budget]: 'Ask budget tier simply: Budget-Friendly, Mid-Range, or Luxury.',
  [STAGES.finalize_details]: 'Briefly ask: Any must-see places or must-avoid constraints? Offer an option: “No, Proceed”. If provided, capture both must_haves and must_nots from text; otherwise allow proceeding.',
  [STAGES.ask_experience]: 'Legacy: short experience question if needed.',
  [STAGES.ask_preferences]: 'Legacy: optional preferences.',
  [STAGES.generate_suggestions]: 'Using all given info, generate conversational recommendations or a simple itinerary summary. No rigid tables, keep paragraphs short. End by offering to refine further.',
  [STAGES.iterate]: 'Acknowledge refinement requests such as “show more options”, “focus on X”, or “adjust for budget/time”. Provide updated, concise suggestions and ask if further tweaks are needed.',
};

// Short, user-facing default texts for local chat (no Gemini call per turn)
const DEFAULT_STAGE_TEXTS = {
  [STAGES.greeting]: "Hello! I'm your Voyager.AI assistant. Do you already have a specific list of locations in mind, or only a region?",
  [STAGES.ask_intent]: 'Would you like to provide specific locations or a general region?',
  [STAGES.input_locations]: 'Please type the names of the locations you want to explore (comma separated).',
  [STAGES.input_region]: 'Please type the region or area you’re interested in.',
  [STAGES.ask_duration]: 'How many days do you plan to travel?',
  [STAGES.ask_dates]: 'Pick a start date. I’ll auto-calculate the return date from your days.',
  [STAGES.ask_travelers]: 'Who is traveling? Solo, Couple, Family, or a Group of Friends?',
  [STAGES.ask_pace]: 'What pace would you prefer: Relaxed, Balanced, or Action-Packed?',
  [STAGES.ask_interests]: 'What are your main interests? (e.g., History, Food, Adventure, Art, Nightlife, Shopping, Relaxation)',
  [STAGES.ask_budget]: 'What budget tier should I plan for: Budget-Friendly, Mid-Range, or Luxury?',
  [STAGES.finalize_details]: 'Any must-see places or constraints to avoid? You can type them, or choose "No, Proceed".',
  [STAGES.generate_suggestions]: 'I’ll generate a concise plan based on your details. Would you like me to proceed?',
  [STAGES.iterate]: 'Tell me if you want more options, or to focus on a theme or adjust the plan.',
};

export const PROMPTS = {
  suggestion: ({ destinations }) => `You are Voyager AI. Based on the selected places, suggest days, best travel months, and a budget band for a decent trip from India.\n\nDestinations: ${destinations.join(', ')}\n\nReturn ONLY valid JSON like:\n{\n  "recommended_days": "8-10",\n  "best_months": "April–June",\n  "estimated_budget": "₹1.8L – ₹2.4L for 2 adults"\n}`,
  itinerary: (payload) => `You are Voyager AI, an expert travel planner.\nThe user is vegetarian (Jain-friendly). Plan respectfully.\nReturn structured JSON exactly as the schema describes. No prose outside JSON.\n\nUser Inputs:\n${JSON.stringify(payload, null, 2)}\n\nSchema:\n{\n  "summary": {\n    "recommended_days": "string",\n    "best_months": "string",\n    "estimated_budget": "string",\n    "key_tips": ["string"]\n  },\n  "flights": [ { "from": "string", "to": "string", "date": "YYYY-MM-DD", "airline": "string" } ],\n  "hotels": [ { "city": "string", "name": "string", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD" } ],\n  "daily_plan": [ { "day": "number", "city": "string", "activities": ["string"] } ],\n  "transport": ["string"],\n  "notes": ["string"]\n}`,
};

// ------------------ Local fallbacks (for rate limits or errors) ------------------
function fallbackItineraryJSON(state = {}) {
  const days = state.durationDays || 3;
  const locs = Array.isArray(state.locations) && state.locations.length ? state.locations : (state.region ? [state.region] : ['Your Destination']);
  const bestMonths = 'April–June';
  return {
    summary: {
      recommended_days: `${days}-${Math.max(days, days + 2)}`,
      best_months: bestMonths,
      estimated_budget: state.budget ? String(state.budget) : '—',
      key_tips: ['This is a quick fallback itinerary generated locally due to API rate limits.'],
    },
    flights: [],
    hotels: [],
    daily_plan: locs.slice(0, 3).map((city, i) => ({ day: i + 1, city, activities: [`Arrive in ${city} and explore the highlights`, 'Try a popular local spot for dinner'] })),
    transport: ['Use local transit or rideshare between sights.'],
    notes: ['Regenerate later for a richer, AI-detailed plan when API limit resets.'],
  };
}

function fallbackItineraryMarkdown(state = {}) {
  const titleBits = [];
  if (Array.isArray(state.locations) && state.locations.length) titleBits.push(state.locations.join(', '));
  if (state.region) titleBits.push(state.region);
  const title = `# Your Quick Itinerary${titleBits.length ? ' — ' + titleBits.join(' · ') : ''}`;
  const daysLine = state.durationDays ? `- Duration: ${state.durationDays} days\n` : '';
  return `${title}\n\nThis fast itinerary was generated locally because the AI is currently rate-limited. You'll still get a sensible outline based on your inputs. Try again in ~1 minute for a fully detailed AI plan.\n\n- Travelers: ${state.travelers || '—'}\n- Pace: ${state.pace || '—'}\n- Budget: ${state.budget || '—'}\n${daysLine}\n### Day-by-Day (Outline)\n- Day 1: Arrive, settle in, and explore nearby highlights.\n- Day 2: Signature sights, great local eats, and a hidden gem.\n- Day 3: Flex day for your interests (food, history, art, or nature).\n\n### Practical Notes\n- You can refine dates, pace, or focus, then regenerate for AI-detailed steps.\n`;
}

// Master Markdown itinerary prompt
function markdownItineraryPrompt({ user, travelProfile = {}, tripState = {} }) {
  const u = user || {};
  const dna = travelProfile || {};
  const trip = tripState || {};
  const parts = [];

  // Trip-specific details
  if (Array.isArray(trip.locations) && trip.locations.length) parts.push(`Destinations: ${trip.locations.join(', ')}`);
  if (trip.region) parts.push(`Region: ${trip.region}`);
  if (trip.durationDays) parts.push(`Duration: ${trip.durationDays} days${trip.durationFlex ? ' (±2 flex)' : ''}`);
  if (trip.startDate && trip.endDate) parts.push(`Dates: ${trip.startDate} → ${trip.endDate}${trip.dateFlex && trip.dateFlex!=='none' ? ` (flex: ${trip.dateFlex})` : ''}`);
  if (trip.travelers) parts.push(`Travelers: ${trip.travelers}`);

  // DNA / travel profile
  parts.push('---');
  parts.push('Traveler Profile (DNA):');
  if (dna.pace) parts.push(`- Pace: ${dna.pace}`);
  if (dna.budget) parts.push(`- Budget: ${dna.budget}`);
  if (Array.isArray(dna.interests) && dna.interests.length) parts.push(`- Interests: ${dna.interests.join(', ')}`);
  if (dna.diet) parts.push(`- Dietary Needs: ${dna.diet}`);

  const userLine = u.firstName ? `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}` : (u.email || 'Traveler');

  return `Master Prompt for Voyager AI Itinerary Generation\n\nRole: You are a world-class travel expert and an elite itinerary planner named Voyager. Your responses are not just suggestions; they are comprehensive, actionable plans designed to give a traveler a seamless and unforgettable experience. You are meticulous, insightful, and always provide practical, insider-level details.\n\nTask: Create a hyper-detailed, day-by-day travel itinerary based on the following user requirements. The output must be in well-structured Markdown format.\n\nUser: ${userLine}\n\nUser Requirements (combined: current trip + saved traveler DNA):\n${parts.map(p=>`- ${p}`).join('\n') || '- User will specify during planning'}\n\nOutput Structure and Content Requirements (Strictly Follow This Format):\n\nMain Title: Start with a title like # Your Hyper-Detailed Itinerary: [Destination(s)].\n\nTrip Overview Section: Create a brief summary section that includes:\n\n- A one-sentence evocative overview of the trip.\n- Travel Dates\n- Focus\n- Pace\n- Budget\n\nPart-by-Part Breakdown:\n\nDivide the itinerary into ### Part X: [City Name], [Country] ([Number of Days]).\n\nUnder each Part heading, add a short, italicized, one-sentence description of the location's essence.\n\nDay-by-Day Plan:\n\nFor each day, use a #### Day X: [Creative Day Theme] ([Date]) heading.\n\nBreak down each day into Morning, Afternoon, and Evening using bolded subheadings.\n\nFor each activity, you MUST include the following types of details:\n\n- Specific Names: Mention specific landmarks, museums, restaurants, cafes, or parks (e.g., "Le Bouillon Chartier," not just "a French restaurant").\n- Logistical Details: Provide practical transportation info. Include specific train/metro lines, station names, approximate journey times, and estimated costs (e.g., "Take the RER B train (approx. €12, ~45 mins journey)...").\n- Actionable Tips & Insider Knowledge: Give crucial advice that enhances the experience. Examples: "You MUST pre-book your timed-entry ticket online weeks in advance," or "Enter via the Carrousel du Louvre entrance to find shorter security lines."\n- Food & Dining: For every suggested restaurant, provide the cuisine type and an estimated budget per person (e.g., "Cuisine: Classic French. Budget: €15-€25 per person.").\n- Alternatives & \"Hidden Gems\": Where appropriate, suggest an alternative option for a restaurant or activity. Include at least one "Hidden Gem" tip per city to make the itinerary feel special and unique.\n- Contingency Plans: For outdoor-heavy days, include a "Bad Weather Plan B."\n\nTone and Language: Write in a clear, encouraging, and highly informative tone. Use **bolding** to highlight key places and tips.\n\nAt the end, include a short section titled ### Practical Notes (Tickets, Passes, and Money-Savers) with 4–6 bullet points specific to this trip.\n`;
}

const DEFAULT_EXPERIENCE_OPTIONS = [
  'Adventure',
  'Relaxation',
  'Cultural',
  'Nature',
  'Luxury',
];

function inputSpecForStage(stage) {
  switch (stage) {
    case STAGES.ask_intent:
      return { type: 'options', options: ['I have specific locations', 'I only know a region'] };
    case STAGES.ask_experience:
      return { type: 'options', options: DEFAULT_EXPERIENCE_OPTIONS };
    case STAGES.ask_duration:
      return { type: 'days' };
    case STAGES.ask_dates:
      return { type: 'dates' };
    case STAGES.ask_travelers:
      return { type: 'options', options: ['Solo Traveler', 'A Couple', 'Family', 'A Group of Friends'] };
    case STAGES.ask_pace:
  return { type: 'options', options: ['Relaxed', 'Balanced', 'Action-Packed'] };
    case STAGES.ask_interests:
      return { type: 'multiselect', options: ['History & Museums','Food & Local Cuisine','Adventure & Outdoors','Art & Culture','Nightlife & Entertainment','Shopping','Relaxation & Wellness'] };
    case STAGES.ask_budget:
      return { type: 'options', options: ['Budget-Friendly','Mid-Range','Luxury'] };
    case STAGES.finalize_details:
      return { type: 'freeText', placeholder: 'Any must-sees or things to avoid? (optional). Or choose: No, Proceed', proceedOption: 'No, Proceed' };
    case STAGES.greeting:
      // Next will be ask_intent which has options
      return { type: 'options', options: ['I have specific locations', 'I only know a region'] };
    default:
      return { type: 'freeText' };
  }
}

function buildStagePrompt({ user, stage, message, state }) {
  const userInfo = user || {};
  const ctx = state || {};
  const behavior = EXPECTED_BEHAVIOR[stage] || 'Be concise and helpful. Keep replies short and conversational.';
  const stageLabel = stage || STAGES.greeting;
  return [
    `User Context: ${JSON.stringify(userInfo)}`,
    `Chat Flow Stage: ${stageLabel}`,
    `User Input: ${message || ''}`,
    `Expected Behavior: ${behavior}`,
    '',
    'General Rules:',
    '- Keep replies short, conversational, and context-aware.',
    '- Ask only one question at a time.',
    '- Do not produce long lists unless explicitly requested.',
    '- Use friendly, encouraging tone.',
    '',
    'Current Known Details:',
    JSON.stringify(ctx, null, 2),
  ].join('\n');
}

// ------------------ Helpers ------------------
async function callGemini({ prompt }) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('Gemini not configured');
  // Prefer the 2.5 Pro streaming capable client for generation where applicable
  const model = genAI.getGenerativeModel({ model: _model || 'gemini-2.5-pro' });

  // Retry with exponential backoff for transient server-side errors (503) and rate limits (429).
  const maxRetries = 4;
  const baseDelayMs = 800;
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const resp = await model.generateContent(prompt);
      const text = resp?.response?.text?.();
      return text || '';
    } catch (err) {
      // If the error contains an HTTP status, decide whether to retry.
      const status = err?.status || err?.code || null;
      const statusNum = typeof status === 'number' ? status : Number(status);
      const isTransient = statusNum === 429 || statusNum === 503 || (statusNum >= 500 && statusNum < 600);
      if (attempt >= maxRetries || !isTransient) {
        // Re-throw for non-retryable or exhausted retries
        throw err;
      }

      // backoff with jitter
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
      console.warn(`[VoyagerAI] Gemini request failed (status=${statusNum || 'unknown'}). Retrying attempt ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
  }
}

// Use Gemini 2.5 Pro streaming to generate full text
async function callGemini25({ prompt }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini not configured');
  if (!_genAI25) _genAI25 = new GoogleGenAI({ apiKey: key });
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
  const tools = [ { googleSearch: {} } ];
  const config = { thinkingConfig: { thinkingBudget: -1 }, tools };
  const contents = [ { role: 'user', parts: [ { text: String(prompt || '') } ] } ];
  const maxRetries = 3;
  const baseDelayMs = 700;
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const stream = await _genAI25.models.generateContentStream({ model: modelName, config, contents });
      let out = '';
      for await (const chunk of stream) {
        if (chunk?.text) out += chunk.text;
      }
      return out;
    } catch (err) {
      const status = err?.status || err?.code || null;
      const statusNum = typeof status === 'number' ? status : Number(status);
      const isTransient = statusNum === 429 || statusNum === 503 || (statusNum >= 500 && statusNum < 600);
      if (attempt >= maxRetries || !isTransient) throw err;
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Public: return raw text from Gemini for a given prompt
export async function getGeminiResponse(prompt) {
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[VoyagerAI] getGeminiResponse: Gemini not configured — returning fallback response.');
    return 'Gemini not configured. This is a fallback response used during local development.';
  }
  return callGemini({ prompt });
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
  // Local fallback when Gemini is not configured (keeps dev server usable)
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[VoyagerAI] generateSuggestion: Gemini not configured — returning heuristic fallback.');
    const days = Math.min(14, Math.max(1, Math.ceil((destinations || []).length * 2)));
    return {
      recommended_days: `${days}-${days + 2}`,
      best_months: 'April–June',
      estimated_budget: '₹1.0L – ₹1.5L for 2 adults',
    };
  }
  const prompt = PROMPTS.suggestion({ destinations });
  const text = await callGemini({ prompt });
  const json = tryParseJson(text);
  if (!json) throw new Error('Gemini suggestion parsing failed');
  return json;
}

export async function generateItinerary(payload) {
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[VoyagerAI] generateItinerary: Gemini not configured — returning simple fallback itinerary.');
    return fallbackItineraryJSON(payload || {});
  }
  const prompt = PROMPTS.itinerary(payload);
  try {
    const text = await callGemini25({ prompt });
    const json = tryParseJson(text);
    if (!json) throw new Error('Gemini itinerary parsing failed');
    return json;
  } catch (e) {
    console.warn('[VoyagerAI] generateItinerary: falling back due to error:', e?.status || e?.message || e);
    return fallbackItineraryJSON(payload || {});
  }
}

export async function generateItineraryMarkdown({ user = null, state = {}, travelProfile = {} }) {
  // If Gemini is not available, return a concise but useful fallback markdown itinerary
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[VoyagerAI] generateItineraryMarkdown: Gemini not configured — returning markdown fallback.');
    return fallbackItineraryMarkdown(state || {});
  }
  const prompt = markdownItineraryPrompt({ user, travelProfile, tripState: state });
  try {
    const text = await callGemini25({ prompt });
    const cleaned = (text || '').replace(/^```(markdown)?/i, '').replace(/```$/i, '').trim();
    if (!cleaned) throw new Error('Gemini returned empty markdown');
    return cleaned;
  } catch (e) {
    console.warn('[VoyagerAI] generateItineraryMarkdown: falling back due to error:', e?.status || e?.message || e);
    return fallbackItineraryMarkdown(state || {});
  }
}

// Stage-based chat
export async function generateChat({ stage = STAGES.greeting, message = '', user = null, state = {} }) {
  // Back-compat: coerce any legacy stages to the new combined stage
  try {
    const s = String(stage || '').toLowerCase();
    if (s === 'must_haves' || s === 'must-nots' || s === 'must_nots') {
      stage = STAGES.finalize_details;
    }
  } catch {}
  let quickOptions;
  // Debug: log incoming chat request
  try { console.log('[VoyagerAI] generateChat received:', { stage, message: String(message).slice(0, 200), user: user ? { uid: user.uid } : null, stateKeys: Object.keys(state || {}) }); } catch (e) {}
  // Per-turn chat: run locally to cut latency and cost; use Gemini only for location suggestion + final itinerary
  let text = DEFAULT_STAGE_TEXTS[stage] || 'Let’s continue. Please provide the next detail.';
  // Prepare response shape and dynamic hints
  let stageNext = NEXT_STAGE[stage] || null;
  let hints = undefined;
  let suggestions = undefined;
  // Accumulate state changes to echo back to client for sync
  const stateDelta = {};
  
  // 🔧 Handle stage transitions based on user input
  // For ask_intent stage, determine next stage based on user's choice
  if (stage === STAGES.ask_intent && message) {
    const userChoice = String(message || '').toLowerCase();
    if (userChoice.includes('specific locations') || userChoice.includes('specific location')) {
      stageNext = STAGES.input_locations;
      text = 'Great! Please tell me the specific places you want to visit (you can list multiple locations).';
    } else if (userChoice.includes('region') || userChoice.includes('only know a region')) {
      stageNext = STAGES.input_region;
      text = 'Perfect! Please tell me which region or area you\'re interested in exploring.';
    }
    // If we couldn't determine the choice, stay in ask_intent
    if (!stageNext) {
      stageNext = STAGES.ask_intent;
    }
  }
  // After locations/region are provided, fetch helpful hints (days, best months) — this is the only mid-flow Gemini call
  if ((stage === STAGES.input_locations || stage === STAGES.input_region) && (state?.locations?.length || message)) {
    try {
      const locations = Array.isArray(state?.locations) && state.locations.length
        ? state.locations
        : String(message || '')
            .split(/,|\n/)
            .map(s => s.trim())
            .filter(Boolean);
      if (locations.length) {
        if (stage === STAGES.input_locations) stateDelta.locations = locations;
        const sug = await generateSuggestion({ destinations: locations });
        hints = { recommended_days: sug.recommended_days, best_months: sug.best_months, estimated_budget: sug.estimated_budget };
      }
    } catch {}
  }
  // If user already provided locations/region this turn, don't ask them again—advance the conversation prompt to duration
  const providedLocations = stage === STAGES.input_locations && ((state?.locations && state.locations.length) || message?.trim());
  const providedRegion = stage === STAGES.input_region && ((state?.region) || message?.trim());
  if (providedLocations || providedRegion) {
    if (stage === STAGES.input_region) stateDelta.region = String(message || '').trim();
    const hintDays = hints?.recommended_days ? ` Suggested: ${hints.recommended_days}.` : '';
    text = `Great, noted.${hintDays} How many days do you plan to travel?`;
  }

  // Region-based suggestions for known countries/regions (simple heuristic)
  try {
    const regionText = (state?.region || message || '').toString().trim().toLowerCase();
    if (stage === STAGES.input_region && regionText) {
      if (/\bindia\b/.test(regionText)) {
        suggestions = [
          { label: 'Delhi — historic capital with rich culture', value: 'Delhi' },
          { label: 'Mumbai — vibrant metropolis and Bollywood hub', value: 'Mumbai' },
          { label: 'Jaipur — beautiful pink city in Rajasthan', value: 'Jaipur' },
          { label: 'Goa — tropical beaches and relaxed vibe', value: 'Goa' },
          { label: 'Bangalore — tech hub with modern attractions', value: 'Bangalore' },
          { label: 'Kerala — lush landscapes and backwaters', value: 'Kerala' },
        ];
        // If we don't already have a reply, craft a helpful prompt
        if (!text || text.trim().length === 0) {
          text = 'India is a vast and diverse country with so many amazing destinations! Which cities or regions are you interested in exploring?';
        }
      }
    }
  } catch (e) {}

  // Helper to produce the next prompt succinctly
  function nextPromptFor(next) {
    if (next === STAGES.ask_dates) {
      const best = hints?.best_months ? ` Best months: ${hints.best_months}.` : '';
      return `${DEFAULT_STAGE_TEXTS[STAGES.ask_dates]}${best}`;
    }
    return DEFAULT_STAGE_TEXTS[next] || 'Let’s continue.';
  }

  // If the current stage input is already in state/message, advance the question to the next stage instead of repeating
  const hasDays = stage === STAGES.ask_duration && ((typeof state?.durationDays === 'number' && state.durationDays > 0) || /\d+/.test(String(message||'')));
  if (hasDays) text = nextPromptFor(STAGES.ask_dates);

  const hasDates = stage === STAGES.ask_dates && ((state?.startDate && state?.endDate) || /\d{4}-\d{2}-\d{2}/.test(String(message||'')) || /start:.*end:/i.test(String(message||'')));
  if (hasDates) {
    text = nextPromptFor(STAGES.ask_travelers);
    stageNext = STAGES.ask_travelers;
  }

  const hasTravelers = stage === STAGES.ask_travelers && ((state?.travelers) || /(solo|couple|family|friends)/i.test(String(message||'')));
  if (hasTravelers) {
    text = nextPromptFor(STAGES.ask_pace);
    stageNext = STAGES.ask_pace;
  }

  const hasPace = stage === STAGES.ask_pace && ((state?.pace) || /(relaxed|balanced|action|fixed)/i.test(String(message||'')));
  if (hasPace) {
    text = nextPromptFor(STAGES.ask_interests);
    stageNext = STAGES.ask_interests;
  }

  const hasInterests = stage === STAGES.ask_interests && ((Array.isArray(state?.interests) && state.interests.length) || /,/.test(String(message||'')));
  if (hasInterests) {
    text = nextPromptFor(STAGES.ask_budget);
    stageNext = STAGES.ask_budget;
  }

  const hasBudget = stage === STAGES.ask_budget && ((state?.budget) || /(budget|mid|luxury)/i.test(String(message||'')));
  if (hasBudget) {
    text = nextPromptFor(STAGES.finalize_details);
    stageNext = STAGES.finalize_details;
  }

  if (stage === STAGES.finalize_details) {
    const msg = String(message || '').trim();
    if (/^no[, ]?proceed$/i.test(msg) || /^no$/i.test(msg)) {
      text = nextPromptFor(STAGES.generate_suggestions);
      stageNext = STAGES.generate_suggestions;
    } else if (msg) {
      // Simple parse: split into must_haves/must_nots by keywords
      const lower = msg.toLowerCase();
      const hasAvoid = /(avoid|no\s|don\'t|dont)/.test(lower);
      const parts = msg.split(/[.;\n]/).map(s=>s.trim()).filter(Boolean);
      const must_haves = parts.filter(p => !/(avoid|no\s|don\'t|dont)/i.test(p));
      const must_nots = parts.filter(p => /(avoid|no\s|don\'t|dont)/i.test(p));
      state.must_haves = Array.from(new Set([...(state.must_haves||[]), ...must_haves])).filter(Boolean);
      state.must_nots = Array.from(new Set([...(state.must_nots||[]), ...must_nots])).filter(Boolean);
  stateDelta.must_haves = state.must_haves;
  stateDelta.must_nots = state.must_nots;
      text = nextPromptFor(STAGES.generate_suggestions);
      stageNext = STAGES.generate_suggestions;
    } else {
      // No input yet — keep the same prompt
      text = nextPromptFor(STAGES.finalize_details);
      stageNext = STAGES.finalize_details;
    }
  }
  // If we're at the generation stage (or user triggers from iterate), allow immediate itinerary generation in Markdown
  if (stage === STAGES.generate_suggestions || stage === STAGES.iterate) {
    // Offer a one-tap option
    quickOptions = ['Generate itinerary'];
    const wantsGenerate = /\b(generate|create|proceed|yes)\b/i.test(String(message || ''));
    const hasCore = (state?.locations?.length || state?.region) && (state?.durationDays || (state?.startDate && state?.endDate));
    if (!hasCore && wantsGenerate) {
      // Best-effort graceful path: show a quick outline now, then jump to the first missing detail
      const jsonPlan = fallbackItineraryJSON(state || {});
      text = fallbackItineraryMarkdown(state || {});
      // Decide which missing detail to collect next
      const needRegionOrLocations = !state?.region && !(state?.locations?.length);
      const needDatesOrDuration = !state?.durationDays && !(state?.startDate && state?.endDate);
      stageNext = needRegionOrLocations ? STAGES.input_region : (needDatesOrDuration ? STAGES.ask_dates : STAGES.iterate);
      // Build lightweight cards and contextUsed for UI
      try {
        const items = [];
        if (jsonPlan?.summary) {
          items.push({
            type: 'info',
            title: 'Trip Overview',
            description: `Days: ${jsonPlan.summary.recommended_days || state.durationDays || ''}  |  Best months: ${jsonPlan.summary.best_months || '—'}  |  Est. budget: ${jsonPlan.summary.estimated_budget || '—'}`.trim()
          });
        }
        if (Array.isArray(jsonPlan?.daily_plan)) {
          for (const day of jsonPlan.daily_plan) {
            const dayLabel = typeof day.day !== 'undefined' ? `Day ${day.day}` : 'Day';
            const city = day.city ? ` — ${day.city}` : '';
            items.push({ type: 'info', title: `${dayLabel}${city}` });
            if (Array.isArray(day.activities)) {
              for (const act of day.activities) {
                const t = typeof act === 'string' ? act : (act?.title || act?.name || 'Activity');
                const desc = typeof act === 'string' ? '' : (act?.description || '');
                const time = act?.time || '';
                items.push({ type: 'activity', title: t, description: desc, time });
              }
            }
          }
        }
        // eslint-disable-next-line no-var
        var itineraryItems = items;
        // eslint-disable-next-line no-var
        var contextUsed = {
          locations: state.locations || [],
          region: state.region || '',
          durationDays: state.durationDays || null,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          travelers: state.travelers || null,
          pace: state.pace || null,
          budget: state.budget || null,
          interests: state.interests || [],
          note: 'Fallback outline shown first; collecting missing details next',
        };
      } catch {}
    } else if (wantsGenerate || hasCore) {
      try {
        // Try to include the user's saved travelProfile (DNA) from Firestore
        let travelProfile = {};
        try {
          const adm = ensureFirebaseAdmin();
          if (adm && user && user.uid) {
            const doc = await adm.firestore().collection('users').doc(user.uid).get();
            if (doc.exists) travelProfile = doc.data().travelProfile || {};
          }
        } catch (e) { /* ignore */ }
        // Generate both markdown and JSON so UI can present cards (with graceful fallbacks inside)
        const [md, jsonPlan] = await Promise.all([
          generateItineraryMarkdown({ user, state, travelProfile }),
          generateItinerary({ ...state, user })
        ]);
        text = md; // Primary reply as markdown document
        stageNext = STAGES.iterate;
        // After generation, invite refinement
        quickOptions = ['Change dates', 'Adjust pace', 'Focus on food', 'Add hidden gems'];

        // Build lightweight card items for UI
        const items = [];
        try {
          if (jsonPlan?.summary) {
            items.push({
              type: 'info',
              title: 'Trip Overview',
              description: `Days: ${jsonPlan.summary.recommended_days || state.durationDays || ''}  |  Best months: ${jsonPlan.summary.best_months || '—'}  |  Est. budget: ${jsonPlan.summary.estimated_budget || '—'}`.trim()
            });
          }
          if (Array.isArray(jsonPlan?.daily_plan)) {
            for (const day of jsonPlan.daily_plan) {
              const dayLabel = typeof day.day !== 'undefined' ? `Day ${day.day}` : 'Day';
              const city = day.city ? ` — ${day.city}` : '';
              items.push({ type: 'info', title: `${dayLabel}${city}` });
              if (Array.isArray(day.activities)) {
                for (const act of day.activities) {
                  const t = typeof act === 'string' ? act : (act?.title || act?.name || 'Activity');
                  const desc = typeof act === 'string' ? '' : (act?.description || '');
                  const time = act?.time || '';
                  items.push({ type: 'activity', title: t, description: desc, time });
                }
              }
            }
          }
          if (Array.isArray(jsonPlan?.hotels) && jsonPlan.hotels.length) {
            for (const h of jsonPlan.hotels) {
              items.push({ type: 'lodging', title: h.name || 'Hotel', description: `${h.city || ''} · ${h.checkIn || ''} → ${h.checkOut || ''}`.trim() });
            }
          }
          if (Array.isArray(jsonPlan?.flights) && jsonPlan.flights.length) {
            for (const f of jsonPlan.flights) {
              items.push({ type: 'info', title: `Flight: ${f.from || ''} → ${f.to || ''}`, description: `${f.date || ''} · ${f.airline || ''}`.trim() });
            }
          }
          // Attach items for frontend to optionally render as cards
          // We'll pass via a symbol property; later we include it in resp below
          // Use a local variable to capture and include in final response
          // eslint-disable-next-line no-var
          var itineraryItems = items;
          // Also expose the context used for generation for debugging/verification
          // eslint-disable-next-line no-var
          var contextUsed = {
            locations: state.locations || [],
            region: state.region || '',
            durationDays: state.durationDays || null,
            startDate: state.startDate || null,
            endDate: state.endDate || null,
            travelers: state.travelers || null,
            pace: (travelProfile.pace || state.pace) || null,
            budget: (travelProfile.budget || state.budget) || null,
            interests: (travelProfile.interests || state.interests) || [],
          };
        } catch {}
      } catch (e) {
        // Graceful fallback: provide an immediate local outline to avoid dead-end prompts
        const jsonPlan = fallbackItineraryJSON(state || {});
        text = fallbackItineraryMarkdown(state || {});
        stageNext = STAGES.iterate;
        // Provide refine options even on fallback
        quickOptions = ['Change dates', 'Adjust pace', 'Focus on food', 'Add hidden gems'];
        // Attach lightweight cards from fallback
        try {
          const items = [];
          if (jsonPlan?.summary) {
            items.push({
              type: 'info',
              title: 'Trip Overview',
              description: `Days: ${jsonPlan.summary.recommended_days || state.durationDays || ''}  |  Best months: ${jsonPlan.summary.best_months || '—'}  |  Est. budget: ${jsonPlan.summary.estimated_budget || '—'}`.trim()
            });
          }
          if (Array.isArray(jsonPlan?.daily_plan)) {
            for (const day of jsonPlan.daily_plan) {
              const dayLabel = typeof day.day !== 'undefined' ? `Day ${day.day}` : 'Day';
              const city = day.city ? ` — ${day.city}` : '';
              items.push({ type: 'info', title: `${dayLabel}${city}` });
              if (Array.isArray(day.activities)) {
                for (const act of day.activities) {
                  const t = typeof act === 'string' ? act : (act?.title || act?.name || 'Activity');
                  const desc = typeof act === 'string' ? '' : (act?.description || '');
                  const time = act?.time || '';
                  items.push({ type: 'activity', title: t, description: desc, time });
                }
              }
            }
          }
          // eslint-disable-next-line no-var
          var itineraryItems = items;
          // eslint-disable-next-line no-var
          var contextUsed = {
            locations: state.locations || [],
            region: state.region || '',
            durationDays: state.durationDays || null,
            startDate: state.startDate || null,
            endDate: state.endDate || null,
            travelers: state.travelers || null,
            pace: state.pace || null,
            budget: state.budget || null,
            interests: state.interests || [],
            note: 'Fallback used due to AI rate limit or error',
          };
        } catch {}
      }
    } else {
      text = text || 'I can generate your detailed itinerary now. Shall I proceed?';
    }
  }

  // Normalize next stage and input spec (frontend should always receive an input object)
  const resolvedStageNext = stageNext || stage;
  let forceInput = null;
  if (resolvedStageNext === STAGES.generate_suggestions || resolvedStageNext === STAGES.iterate) {
    forceInput = { type: 'options', options: ['Generate itinerary'] };
  }
  const input = forceInput || inputSpecForStage(resolvedStageNext) || { type: 'freeText' };

  // Ensure frontend always receives an array (possibly empty) instead of undefined.
  quickOptions = Array.isArray(quickOptions) ? quickOptions : undefined;

  // Final normalization: make sure reply, stageNext, input, quickOptions, hints are always present.
  const reply = (text && String(text).trim().length) ? text : 'Let\'s continue.';
  const finalStageNext = resolvedStageNext;

  // If quickOptions wasn't set by logic above, derive from input spec for options/multiselect.
  if (!Array.isArray(quickOptions) || quickOptions.length === 0) {
    if (input && (input.type === 'options' || input.type === 'multiselect')) {
      quickOptions = Array.isArray(input.options) ? input.options : [];
    } else {
      quickOptions = [];
    }
  }

  const resp = { reply, stageNext: finalStageNext, input, quickOptions, hints };
  // Include any state deltas so the client can sync its flowState without guessing
  if (stateDelta && Object.keys(stateDelta).length) resp.state = stateDelta;
  // Include optional itineraryItems when present (from generation stage)
  try { if (typeof itineraryItems !== 'undefined' && Array.isArray(itineraryItems)) resp.itineraryItems = itineraryItems; } catch {}
  if (Array.isArray(suggestions) && suggestions.length) resp.suggestions = suggestions;
  try { if (typeof contextUsed !== 'undefined') resp.contextUsed = contextUsed; } catch {}
  try { console.log('[VoyagerAI] generateChat responding:', { replyPreview: String(reply).slice(0,200), stageNext: finalStageNext, inputType: input?.type, hints }); } catch (e) {}
  return resp;
}
