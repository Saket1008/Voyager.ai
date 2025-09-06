// server/src/services/ai.js

import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Configuration & Lazy Initialization ---
let _genAI = null;
let _cachedKey = null;
function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key not configured.');
  }
  if (!_genAI || _cachedKey !== key) {
    _genAI = new GoogleGenerativeAI(key);
    _cachedKey = key;
    console.log('[Gemini] Client (re)initialized.');
  }
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  return _genAI.getGenerativeModel({ model: modelName });
}

// --- Core Conversational Flow (The Stage Machine) ---
export const STAGES = {
  greeting: 'greeting',
  ask_intent: 'ask_intent',
  input_locations: 'input_locations',
  input_region: 'input_region',
  ask_duration: 'ask_duration',
  ask_dates: 'ask_dates',
  ask_travelers: 'ask_travelers',
  finalize_details: 'finalize_details',
  generate_suggestions: 'generate_suggestions',
  iterate: 'iterate',
};

const NEXT_STAGE = {
  [STAGES.greeting]: STAGES.ask_intent,
  [STAGES.ask_intent]: null, // Decided by user choice
  [STAGES.input_locations]: STAGES.ask_duration,
  [STAGES.input_region]: STAGES.ask_duration,
  [STAGES.ask_duration]: STAGES.ask_dates,
  [STAGES.ask_dates]: STAGES.ask_travelers,
  [STAGES.ask_travelers]: STAGES.finalize_details,
  [STAGES.finalize_details]: STAGES.generate_suggestions,
  [STAGES.generate_suggestions]: STAGES.iterate,
  [STAGES.iterate]: STAGES.iterate,
};

// --- Local, Fast Responses (No AI Call Needed) ---
const LOCAL_REPLIES = {
  [STAGES.greeting]: "Hello! I'm Voyager.AI. To begin, do you have specific destinations in mind, or a general region you'd like to explore?",
  [STAGES.ask_intent]: "Please choose one: are you providing specific locations or a general region?",
  [STAGES.input_locations]: "Great. Please list the cities or specific places you'd like to visit.",
  [STAGES.input_region]: "Perfect. Which region or country are you interested in?",
  [STAGES.ask_duration]: "Got it. How many days will this journey be?",
  [STAGES.ask_dates]: "And when are you planning to travel?",
  [STAGES.ask_travelers]: "Who will be traveling on this trip?",
  [STAGES.finalize_details]: 'Any must-see places or constraints to avoid? You can type them, or choose "No, Proceed".',
  [STAGES.generate_suggestions]: "I have all the details needed. Ready to generate your personalized itinerary?",
};

// --- Input Specifications for the Frontend ---
function getInputSpecForStage(stage) {
  switch (stage) {
    case STAGES.greeting:
    case STAGES.ask_intent:
      return { type: 'options', options: ["I have specific locations", "I only know a region"] };
    case STAGES.ask_duration:
      return { type: 'days' };
    case STAGES.ask_dates:
      return { type: 'dates' };
    case STAGES.ask_travelers:
      return { type: 'options', options: ['Solo Traveler', 'A Couple', 'Family', 'A Group of Friends'] };
    case STAGES.finalize_details:
        return { type: 'freeText', placeholder: 'Any must-sees or things to avoid? (optional).', proceedOption: 'No, Proceed' };
    case STAGES.generate_suggestions:
    case STAGES.iterate:
      return { type: 'options', options: ['Generate itinerary'] };
    default:
      return { type: 'freeText' };
  }
}

// --- Main Chat Logic (The "Conductor") ---
export async function generateChat({ stage = STAGES.greeting, message = '', state = {} }) {
  let nextStage = STAGES.greeting;
  let reply = '';
  let hints = null;
  let suggestions = null;
  const newState = { ...(state || {}) };

  // 1. Determine the next stage based on current stage and user message
  if (stage === STAGES.greeting) {
    nextStage = STAGES.ask_intent;
  } else if (stage === STAGES.ask_intent) {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('specific')) {
      nextStage = STAGES.input_locations;
    } else {
      nextStage = STAGES.input_region;
    }
  } else {
    nextStage = NEXT_STAGE[stage] || STAGES.iterate;
  }

  // 2. Handle the suggestion step (the only slow part in the flow)
  if ((stage === STAGES.input_locations || stage === STAGES.input_region) && message) {
    try {
      const destinations = message.split(',').map(d => d.trim()).filter(Boolean);
      if (destinations.length > 0) {
  console.log('[Chat] Calling generateSuggestion with destinations:', destinations);
  hints = await generateSuggestion({ destinations });
      }
      // Persist into state for client
      if (stage === STAGES.input_locations && destinations.length) {
        newState.locations = destinations;
      } else if (stage === STAGES.input_region) {
        const region = String(message || '').trim();
        if (region) newState.region = region;
      }
      // Simple heuristic for suggestions like the "India" example
      if (message.toLowerCase().trim() === 'india') {
          suggestions = [
              { label: 'Delhi — historic capital with rich culture', value: 'Delhi' },
              { label: 'Mumbai — vibrant metropolis and Bollywood hub', value: 'Mumbai' },
              { label: 'Jaipur — beautiful pink city in Rajasthan', value: 'Jaipur' },
          ];
      }
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
      hints = { error: "Could not fetch suggestions at this time." };
    }
  }

  // 3. Get the AI's next question from our fast, local replies
  reply = LOCAL_REPLIES[nextStage];

  // 4. Construct the final response object for the frontend
  const inputSpec = getInputSpecForStage(nextStage);
  
  return {
    reply,
    stageNext: nextStage,
    input: inputSpec,
    quickOptions: inputSpec.type === 'options' ? inputSpec.options : [],
    hints, // travel guidance (recommended_days, best_months)
    suggestions,
    state: newState
  };
}


// --- AI-Powered Functions (Slower, deliberate calls) ---

async function callGemini({ prompt }) {
  const model = getModel();
  console.log('[Gemini] Prompt START\n' + prompt + '\n[Gemini] Prompt END');
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('[Gemini] Raw response START\n' + text + '\n[Gemini] Raw response END');
    return text;
  } catch (err) {
    console.error('[Gemini] Error during generateContent:', err?.message);
    if (err?.stack) console.error(err.stack);
    throw err;
  }
}

// Lightweight Data Retrieval (FAST)
export async function generateSuggestion({ destinations }) {
  console.log('[Suggestions] Generating for destinations:', destinations);
  const prompt = `Based on these destinations: ${destinations.join(', ')} provide ONLY a compact JSON object with exactly two keys: "recommended_days" (string range like '5-7' or single number) and "best_months" (string listing ideal months or range). Example valid outputs: {"recommended_days":"5-6","best_months":"Oct to Feb"}`;
  try {
    const text = await callGemini({ prompt });
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    let parsed = null;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.warn('[Suggestions] Initial JSON.parse failed, attempting recovery:', parseErr.message);
      // Attempt to extract JSON object substring
      const match = cleanedText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e2) {
          console.error('[Suggestions] Recovery parse failed:', e2.message);
        }
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      parsed = { recommended_days: '—', best_months: '—', _raw: cleanedText };
    }
    console.log('[Suggestions] Parsed hints:', parsed);
    return parsed;
  } catch (e) {
    console.error('[Suggestions] Failed completely:', e.message);
    return { recommended_days: 'N/A', best_months: 'N/A', error: e.message };
  }
}

// Heavyweight Creative Generation (SLOWER, for final output)
export async function generateItineraryMarkdown({ user, travelProfile, tripState }) {
  const dna = travelProfile || {};
  const trip = tripState || {};
  console.log('[Itinerary] Incoming tripState:', JSON.stringify(trip));
  console.log('[Itinerary] Incoming travelProfile:', JSON.stringify(dna));
  if ((!trip.locations || !trip.locations.length) && !trip.region) {
    return '## Need Destinations First\nPlease provide at least one destination (city / place) or a region before generating an itinerary.';
  }
  // Normalize single location case (e.g., user typed one place)
  if (trip.locations && !Array.isArray(trip.locations)) {
    try { trip.locations = [String(trip.locations)].filter(Boolean); } catch { /* ignore */ }
  }
  
  const promptParts = [
    `Role: You are Voyager.AI, a world-class travel expert. Your task is to create a hyper-detailed, day-by-day travel itinerary in well-structured Markdown format.`,
    `User: ${user?.displayName || 'A traveler'}`,
    `---`,
    `**Current Trip Details (DO NOT INVENT OR SUBSTITUTE DESTINATIONS):**`,
    trip.locations && trip.locations.length ? `- Destinations (locked list): ${trip.locations.join(', ')}` : `- Region (focus only inside): ${trip.region}`,
    `- Duration: ${trip.durationDays} days`,
    `- Dates: ${trip.startDate} to ${trip.endDate}`,
    `- Travelers: ${trip.travelers}`,
    `---`,
    `**Traveler's DNA (Permanent Preferences):**`,
    `- Pace: ${dna.pace || 'Balanced'}`,
    `- Budget: ${dna.budget || 'Mid-Range'}`,
    `- Interests: ${dna.interests ? dna.interests.join(', ') : 'General sightseeing'}`,
    `- Dietary Needs: ${dna.diet || 'None specified'}`,
    `---`,
    `INSTRUCTIONS (CRITICAL):`,
    `1. Only plan for the provided destination list or stay strictly inside the region named. Do NOT switch to other countries or major cities not listed unless they are day trips inside the SAME country/region and explicitly justified.`,
    `2. If only one destination is provided, keep all nights there and optionally include nearby day trips (return same night).`,
    `3. Never replace the user's destination with a different famous city (e.g., do NOT swap to Rome, Lisbon, etc. unless explicitly provided).`,
    `4. Output MUST reflect exactly the supplied duration (${trip.durationDays} days).`,
    `FORMAT REQUIREMENTS:`,
    `- Start with a concise Trip Overview.`,
    `- Then each Day as: ### Day N: Title`,
    `- Under each day include: Morning, Afternoon, Evening, Meals, Logistics/Tips.`,
    `- Avoid filler; be specific and localized.`
  ];

  const prompt = promptParts.join('\n');
  console.log('[Itinerary] Final prompt (chars:', prompt.length, ')');

  // Helper: fallback deterministic itinerary if AI output drifts
  function buildFallbackItinerary() {
    const days = Number(trip.durationDays) || 1;
    const locs = trip.locations && trip.locations.length ? trip.locations : [trip.region || 'Destination'];
    let md = `# Trip Itinerary\n\n**Destinations:** ${locs.join(', ')}\n**Duration:** ${days} day${days>1?'s':''}\n\n## Trip Overview\nA structured ${days}-day plan centered on ${locs.join(', ')}.\n`;
    for (let d=1; d<=days; d++) {
      const loc = locs[(d-1) % locs.length];
      md += `\n### Day ${d}: ${loc} Focus\n**Morning:** Local highlights in ${loc}.\n**Afternoon:** Deeper exploration / museum / neighborhood walk.\n**Evening:** Dinner with regional cuisine.\n**Meals:** Suggest 1 cafe, 1 lunch spot, 1 dinner spot (align to interests).\n**Logistics/Tips:** Keep transfers minimal; stay centered near lodging.\n`;
    }
    return md;
  }

  try {
    const md = await callGemini({ prompt });
    if (!md || typeof md !== 'string') return buildFallbackItinerary();

    const lower = md.toLowerCase();
    const locs = trip.locations && trip.locations.length ? trip.locations : [];
    let anchorOk = true;
    if (locs.length) {
      // Require at least one of the provided destinations to appear
      const anyPresent = locs.some(l => lower.includes(l.toLowerCase()));
      if (!anyPresent) anchorOk = false;
    } else if (trip.region) {
      if (!lower.includes(trip.region.toLowerCase())) anchorOk = false;
    }

    if (!anchorOk) {
      console.warn('[Itinerary] Output failed anchor validation. Using fallback.');
      return buildFallbackItinerary();
    }
    return md;
  } catch (err) {
    console.error('[Itinerary] Generation failed:', err.message);
    return buildFallbackItinerary();
  }
}