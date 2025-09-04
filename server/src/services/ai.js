import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy init for Gemini client so dotenv can be loaded before first use.
let _genAI = null;
let _model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
  // (DNA-related questions removed — captured during onboarding)
  // Final polish
  must_haves: 'must_haves',
  must_nots: 'must_nots',
  // Legacy/general
  ask_experience: 'ask_experience',
  ask_preferences: 'ask_preferences',
  generate_suggestions: 'generate_suggestions',
  iterate: 'iterate',
};

const NEXT_STAGE = {
  [STAGES.greeting]: STAGES.ask_intent,
  [STAGES.ask_intent]: null, // Client chooses: input_locations or input_region
  [STAGES.input_locations]: STAGES.ask_duration,
  [STAGES.input_region]: STAGES.ask_duration,
  [STAGES.ask_duration]: STAGES.ask_dates,
  [STAGES.ask_dates]: STAGES.ask_travelers,
  // All DNA questions are removed from the sequence
  [STAGES.ask_travelers]: STAGES.generate_suggestions,
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
  [STAGES.must_haves]: 'Ask for any must-see places or must-do activities. One short encouragement.',
  [STAGES.must_nots]: 'Ask for anything to avoid or constraints (e.g., big crowds, seafood, too much walking).',
  [STAGES.ask_experience]: 'Legacy: short experience question if needed.',
  [STAGES.ask_preferences]: 'Legacy: optional preferences.',
  [STAGES.generate_suggestions]: 'Using all given info, generate conversational recommendations or a simple itinerary summary. No rigid tables, keep paragraphs short. End by offering to refine further.',
  [STAGES.iterate]: 'Acknowledge refinement requests such as “show more options”, “focus on X”, or “adjust for budget/time”. Provide updated, concise suggestions and ask if further tweaks are needed.',
};

export const PROMPTS = {
  suggestion: ({ destinations }) => `You are Voyager AI. Based on the selected places, suggest days, best travel months, and a budget band for a decent trip from India.\n\nDestinations: ${destinations.join(', ')}\n\nReturn ONLY valid JSON like:\n{\n  "recommended_days": "8-10",\n  "best_months": "April–June",\n  "estimated_budget": "₹1.8L – ₹2.4L for 2 adults"\n}`,
  itinerary: (payload) => `You are Voyager AI, an expert travel planner.\nThe user is vegetarian (Jain-friendly). Plan respectfully.\nReturn structured JSON exactly as the schema describes. No prose outside JSON.\n\nUser Inputs:\n${JSON.stringify(payload, null, 2)}\n\nSchema:\n{\n  "summary": {\n    "recommended_days": "string",\n    "best_months": "string",\n    "estimated_budget": "string",\n    "key_tips": ["string"]\n  },\n  "flights": [ { "from": "string", "to": "string", "date": "YYYY-MM-DD", "airline": "string" } ],\n  "hotels": [ { "city": "string", "name": "string", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD" } ],\n  "daily_plan": [ { "day": "number", "city": "string", "activities": ["string"] } ],\n  "transport": ["string"],\n  "notes": ["string"]\n}`,
};

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
  const model = genAI.getGenerativeModel({ model: _model });

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
    // Minimal fallback itinerary JSON to keep callers robust during dev
    return {
      summary: {
        recommended_days: '3-5',
        best_months: 'April–June',
        estimated_budget: '₹0.6L – ₹1.2L for 2 adults',
        key_tips: ['Fallback itinerary: Gemini not configured'],
      },
      flights: [],
      hotels: [],
      daily_plan: [],
      transport: [],
      notes: ['Detailed itinerary generation requires GEMINI_API_KEY.'],
    };
  }
  const prompt = PROMPTS.itinerary(payload);
  const text = await callGemini({ prompt });
  const json = tryParseJson(text);
  if (!json) throw new Error('Gemini itinerary parsing failed');
  return json;
}

export async function generateItineraryMarkdown({ user = null, state = {}, travelProfile = {} }) {
  // If Gemini is not available, return a concise but useful fallback markdown itinerary
  const genAI = getGenAI();
  if (!genAI) {
    console.warn('[VoyagerAI] generateItineraryMarkdown: Gemini not configured — returning markdown fallback.');
    const parts = [];
    if (Array.isArray(state.locations) && state.locations.length) parts.push(`Destinations: ${state.locations.join(', ')}`);
    if (state.region) parts.push(`Region: ${state.region}`);
    if (state.durationDays) parts.push(`Duration: ${state.durationDays} days`);
    const title = `# Your Quick Itinerary${parts.length ? ' — ' + parts.join(' · ') : ''}`;
    const body = `\n\nThis is a fallback itinerary generated locally because the Gemini API key is not configured. For a richer, day-by-day plan, set GEMINI_API_KEY in your server environment.\n\n- Overview: A short suggested trip based on provided inputs.\n- Suggestion: Keep flexible.\n\n### Practical Notes\n- Gemini not configured — replace with real itinerary when available.\n`;
    return `${title}\n${body}`;
  }
  const prompt = markdownItineraryPrompt({ user, travelProfile, tripState: state });
  const text = await callGemini({ prompt });
  // Return raw Markdown text; if model returned fenced code, strip once
  const cleaned = (text || '').replace(/^```(markdown)?/i, '').replace(/```$/i, '').trim();
  if (!cleaned) throw new Error('Gemini returned empty markdown');
  return cleaned;
}

// Stage-based chat
export async function generateChat({ stage = STAGES.greeting, message = '', user = null, state = {} }) {
  let quickOptions;
  // Debug: log incoming chat request
  try { console.log('[VoyagerAI] generateChat received:', { stage, message: String(message).slice(0, 200), user: user ? { uid: user.uid } : null, stateKeys: Object.keys(state || {}) }); } catch (e) {}
  const prompt = buildStagePrompt({ user, stage, message, state });
  let text = '';
  try {
    text = await callGemini({ prompt });
  } catch (err) {
    console.error('Gemini chat error', err);
    // Friendly default per stage
    const defaults = {
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
      [STAGES.must_haves]: 'Any must-see places or must-do activities?',
      [STAGES.must_nots]: 'Anything you’d like to avoid? (e.g., big crowds, seafood, too much walking)',
      [STAGES.generate_suggestions]: 'I’ll generate a concise plan based on your details. Would you like me to proceed?',
      [STAGES.iterate]: 'Tell me if you want more options, or to focus on a theme or adjust the plan.',
    };
    text = defaults[stage] || 'Let’s continue. Please provide the next detail.';
  }
  // Prepare response shape and dynamic hints
  let stageNext = NEXT_STAGE[stage] || null;
  let hints = undefined;
  let suggestions = undefined;
  // After locations/region are provided, fetch helpful hints (days, best months)
  if ((stage === STAGES.input_locations || stage === STAGES.input_region) && (state?.locations?.length || message)) {
    try {
      const locations = Array.isArray(state?.locations) && state.locations.length
        ? state.locations
        : String(message || '')
            .split(/,|\n/)
            .map(s => s.trim())
            .filter(Boolean);
      if (locations.length) {
        const sug = await generateSuggestion({ destinations: locations });
        hints = { recommended_days: sug.recommended_days, best_months: sug.best_months, estimated_budget: sug.estimated_budget };
      }
    } catch {}
  }
  // If user already provided locations/region this turn, don't ask them again—advance the conversation prompt to duration
  const providedLocations = stage === STAGES.input_locations && ((state?.locations && state.locations.length) || message?.trim());
  const providedRegion = stage === STAGES.input_region && ((state?.region) || message?.trim());
  if (providedLocations || providedRegion) {
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
    switch (next) {
      case STAGES.ask_dates: {
        const best = hints?.best_months ? ` Best months: ${hints.best_months}.` : '';
        return `Pick a start date. I’ll auto-calculate the return date from your days.${best}`;
      }
      case STAGES.ask_travelers:
        return 'Who is traveling? Solo, Couple, Family, or a Group of Friends?';
      case STAGES.ask_pace:
        return 'What pace would you prefer: Relaxed, Balanced, or Action-Packed?';
      case STAGES.ask_interests:
        return 'What are your main interests? (e.g., History, Food, Adventure, Art, Nightlife, Shopping, Relaxation)';
      case STAGES.ask_budget:
        return 'What budget tier should I plan for: Budget-Friendly, Mid-Range, or Luxury?';
      case STAGES.must_haves:
        return 'Any must-see places or must-do activities?';
      case STAGES.must_nots:
        return 'Anything you’d like to avoid? (e.g., big crowds, seafood, too much walking)';
      case STAGES.generate_suggestions:
        return 'I’ll generate a concise plan based on your details. Would you like me to proceed?';
      default:
        return EXPECTED_BEHAVIOR[next] || 'Let’s continue.';
    }
  }

  // If the current stage input is already in state/message, advance the question to the next stage instead of repeating
  const hasDays = stage === STAGES.ask_duration && ((typeof state?.durationDays === 'number' && state.durationDays > 0) || /\d+/.test(String(message||'')));
  if (hasDays) text = nextPromptFor(STAGES.ask_dates);

  const hasDates = stage === STAGES.ask_dates && ((state?.startDate && state?.endDate) || /\d{4}-\d{2}-\d{2}/.test(String(message||'')));
  if (hasDates) text = nextPromptFor(STAGES.ask_travelers);

  const hasTravelers = stage === STAGES.ask_travelers && ((state?.travelers) || /(solo|couple|family|friends)/i.test(String(message||'')));
  if (hasTravelers) text = nextPromptFor(STAGES.ask_pace);

  const hasPace = stage === STAGES.ask_pace && ((state?.pace) || /(relaxed|balanced|action)/i.test(String(message||'')));
  if (hasPace) text = nextPromptFor(STAGES.ask_interests);

  const hasInterests = stage === STAGES.ask_interests && ((Array.isArray(state?.interests) && state.interests.length) || /,/.test(String(message||'')));
  if (hasInterests) text = nextPromptFor(STAGES.ask_budget);

  const hasBudget = stage === STAGES.ask_budget && ((state?.budget) || /(budget|mid|luxury)/i.test(String(message||'')));
  if (hasBudget) text = nextPromptFor(STAGES.must_haves);

  const hasMustHaves = stage === STAGES.must_haves && ((state?.must_haves) || String(message||'').trim());
  if (hasMustHaves) text = nextPromptFor(STAGES.must_nots);

  const hasMustNots = stage === STAGES.must_nots && ((state?.must_nots) || String(message||'').trim());
  if (hasMustNots) text = nextPromptFor(STAGES.generate_suggestions);
  // Normalize next stage and input spec (frontend should always receive an input object)
  const resolvedStageNext = stageNext || stage;
  const input = inputSpecForStage(resolvedStageNext) || { type: 'freeText' };

  // Ensure frontend always receives an array (possibly empty) instead of undefined.
  quickOptions = Array.isArray(quickOptions) ? quickOptions : undefined;

  // If we're at the generation stage, allow immediate itinerary generation in Markdown
  if (stage === STAGES.generate_suggestions) {
    // Offer a one-tap option
    quickOptions = ['Generate itinerary'];
    const wantsGenerate = /\b(generate|create|proceed|yes)\b/i.test(String(message || ''));
    const hasCore = (state?.locations?.length || state?.region) && (state?.durationDays || (state?.startDate && state?.endDate));
    if (wantsGenerate || hasCore) {
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
        const md = await generateItineraryMarkdown({ user, state, travelProfile });
        text = md; // Return the markdown document
        stageNext = STAGES.iterate;
        // After generation, invite refinement
        quickOptions = ['Change dates', 'Adjust pace', 'Focus on food', 'Add hidden gems'];
      } catch (e) {
        // Fall back to a concise confirmation prompt
        text = text || 'I can generate your detailed itinerary now. Shall I proceed?';
      }
    } else {
      text = text || 'I can generate your detailed itinerary now. Shall I proceed?';
    }
  }

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
  if (Array.isArray(suggestions) && suggestions.length) resp.suggestions = suggestions;
  try { console.log('[VoyagerAI] generateChat responding:', { replyPreview: String(reply).slice(0,200), stageNext: finalStageNext, inputType: input?.type, hints }); } catch (e) {}
  return resp;
}
