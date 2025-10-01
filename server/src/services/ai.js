// server/src/services/ai.js

import { GoogleGenAI } from '@google/genai';

// --- Configuration & Lazy Initialization ---
let _genAI = null;
let _cachedKey = null;
const ITINERARY_USE_AI = String(process.env.ITINERARY_USE_AI || 'true').toLowerCase() === 'true';
// Simple in-memory cache for itineraries (keyed by stable trip signature)
const _itineraryCache = new Map();
function ensureClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key not configured.');
  if (!_genAI || _cachedKey !== key) {
    _genAI = new GoogleGenAI({ apiKey: key }); // new unified SDK (v1)
    _cachedKey = key;
    console.log('[Gemini] Client (re)initialized.');
  }
  return _genAI;
}

async function generateWithModel(name, promptText) {
  const client = ensureClient();
  const model = name || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const req = {
    model,
    contents: [{ role: 'user', parts: [{ text: String(promptText || '') }]}],
  };
  const resp = await client.models.generateContent(req);
  // Normalize into the shape used by legacy code: result.response.text()
  const text = (resp?.candidates?.[0]?.content?.parts || [])
    .map(p => (typeof p.text === 'string' ? p.text : ''))
    .join('');
  return { response: { text: () => text } };
}

export function getModelCandidates() {
  const requested = (process.env.GEMINI_MODEL || '').trim();
  const preferred = [
    // Prefer current models known to work on v1beta
    'gemini-2.5-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];
  const legacy = [
    'gemini-1.5-flash-002',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.0-pro-latest',
    'gemini-1.0-pro',
    'gemini-pro',
  ];
  const cands = [
    // If an explicit model is set, try it first along with common variants
    ...(requested ? [requested, `${requested}-latest`, `${requested}-002`] : []),
    ...preferred,
    ...legacy,
  ];
  // De-duplicate while preserving order
  return Array.from(new Set(cands.filter(Boolean)));
}

// --- Helpers to condense context for Gemini ---
function createTripStateSummary(tripState = {}) {
  // Keep only the most relevant, high-signal fields to avoid prompt bloat
  const t = tripState || {};
  const summary = {};
  if (t.doorstep !== undefined) summary.doorstep = t.doorstep; // boolean or choice
  if (t.destination) summary.destination = t.destination;
  if (Array.isArray(t.locations) && t.locations.length) summary.locations = t.locations;
  if (t.region) summary.region = t.region;
  if (t.duration || t.durationDays) summary.duration = t.duration || t.durationDays;
  if (t.startDate || t.endDate || t.dates) {
    summary.dates = {
      startDate: t.startDate || null,
      endDate: t.endDate || null,
      raw: t.dates || null,
    };
  }
  if (t.travelers) summary.travelers = t.travelers;
  if (t.transportationMode) summary.transportationMode = t.transportationMode;
  if (t.accommodationStyle) summary.accommodationStyle = t.accommodationStyle;
  if (t.foodBudget) summary.foodBudget = t.foodBudget;
  if (t.budget) summary.budget = t.budget; // legacy compatibility
  if (t.activities) summary.activities = t.activities;
  if (t.notes) summary.notes = t.notes;
  return summary;
}

function summarizeDNA(dna = {}) {
  try {
    if (!dna || typeof dna !== 'object') return '';
    const parts = [];
    if (dna.pace) parts.push(`pace: ${dna.pace}`);
    if (dna.budget) parts.push(`budget: ${dna.budget}`);
    if (Array.isArray(dna.interests) && dna.interests.length) parts.push(`interests: ${dna.interests.slice(0, 6).join(', ')}`);
    if (dna.diet) parts.push(`diet: ${dna.diet}`);
    if (dna.style) parts.push(`style: ${dna.style}`);
    return parts.join(' • ');
  } catch {
    return '';
  }
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

/**
 * Core Gemini call helper.
 * Modes:
 * - Legacy (default): pass { prompt } and receive raw text (back-compat for suggestions/itinerary/title).
 * - Structured Next-Step mode: pass { prompt, tripState, chatHistory } to receive a parsed JSON object:
 *   { assistantReply: string, nextQuestion: { type, prompt, currentValue? } }
 */
export async function callGemini({ prompt, tripState, chatHistory, userProfileDNA }) {
  // Detect structured next-step mode when tripState/chatHistory are provided (non-undefined)
  const structuredMode = typeof tripState !== 'undefined' || typeof chatHistory !== 'undefined';

  const tryGenerate = async (content, isStructured) => {
    const models = getModelCandidates();
    let lastErr;
    for (const name of models) {
      try {
        console.log(`[Gemini] Using model: ${name}`);
        const result = await generateWithModel(name, content);
        return result;
      } catch (err) {
        const msg = String(err?.message || err || 'error');
        const is404 = /404|not\s+found|not\s+supported|ListModels/i.test(msg);
        console.warn(`[Gemini] generateContent failed for ${name}:`, msg);
        lastErr = err;
        if (is404) {
          // Try next candidate silently
          continue;
        }
        // For other errors (quota, network), do not keep retrying different names
        break;
      }
    }
    throw lastErr || new Error('Gemini call failed and no model fallback succeeded.');
  };

  if (!structuredMode) {
    // Legacy, plain-text mode
    console.log('[Gemini] Prompt START\n' + prompt + '\n[Gemini] Prompt END');
    try {
      const result = await tryGenerate(prompt, false);
      const text = result.response.text();
      console.log('[Gemini] Raw response START\n' + text + '\n[Gemini] Raw response END');
      return text;
    } catch (err) {
      console.error('[Gemini] Error during generateContent (after fallbacks):', err?.message);
      if (err?.stack) console.error(err.stack);
      throw err;
    }
  }

  // Structured JSON mode for dynamic next-step generation
  const safeState = tripState ?? {};
  const dna = userProfileDNA && typeof userProfileDNA === 'object' ? userProfileDNA : ((safeState && safeState.dna) ? safeState.dna : {});
  const recentHistory = Array.isArray(chatHistory) ? chatHistory.slice(-4) : [];
  const historyLines = recentHistory
    .map(m => `${m.sender || m.role || 'user'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  const condensedTrip = createTripStateSummary(safeState);
  const isInitialInteraction = !condensedTrip.destination && !condensedTrip.region && recentHistory.length === 0;
  const dnaBlock = isInitialInteraction
    ? `User's Permanent Travel DNA (full):\n${JSON.stringify(dna, null, 2)}`
    : `User's DNA (summary): ${summarizeDNA(dna)}`;

  const masterPrompt = `
You are Voyager.AI, an intelligent, concise, and friendly travel assistant. Your job is to ask ONLY the most important next question, minimize typing, and keep the flow fast.

${dnaBlock}

Current Trip State (condensed):
${JSON.stringify(condensedTrip, null, 2)}

Recent Conversation (last ${recentHistory.length} turns):
${historyLines}

User's Latest Input:
${prompt}

CRITICAL Guidance:
- Prioritize core info first: doorstep vs destination start, destination/region, dates (or duration), travelers.
- Offer structured choices instead of open text whenever reasonable (multiChoice with options).
- Infer from DNA when possible; don't re-ask what's implied by DNA unless user disagrees.
- Consolidate related queries. Avoid granular logistics (car model, exact distances, flight numbers) unless explicitly requested.
- Replies must be brief and not repeat all known details. Ask one clear question or confirm.

Your response MUST be VALID JSON with exactly two fields:
1) "assistantReply": string — a concise sentence or two.
2) "nextQuestion": object — the next action.
   - "type": one of ["doorstepChoice", "destination", "duration", "dates", "travelers", "multiChoice", "confirm", "generate", "freeText"].
     * Use "doorstepChoice" only if the trip's starting mode is unknown (is the trip from their doorstep, or starting at the destination?).
     * Use "multiChoice" when offering predefined options (e.g., transportation, accommodation).
     * Use "confirm" to summarize before generating.
     * Use "generate" when all essential info is ready and the itinerary can be created now.
   - "prompt": string — short label or question.
   - "currentValue": string|number|null — value known from trip state, if any.
   - "options": string[] — ONLY include when type is "multiChoice" or "doorstepChoice".

Initial Flow (if starting mode unknown):
- Ask "doorstepChoice" with options like ["Start from Doorstep", "Start at Destination"].
- Then collect destination/region, duration, dates, travelers.

After Core Info:
- Transportation (multiChoice): ["Car", "Flight", "Train", "Bus", "Other"]. If "Car", do not ask car model/year; only ask practical timing if truly needed.
- Accommodation style (multiChoice): ["Guesthouse", "Homestay", "Hotel", "Airbnb", "Hostel", "Other"].
- Food budget (multiChoice): ["Low", "Mid-Range", "High", "Specific Amount"].
- Activities: infer from DNA; otherwise a brief multiChoice or succinct freeText prompt.
- Once ready, return type="confirm"; after user confirms, return type="generate".

Begin your JSON now.`;

  console.log('[Gemini][Structured] Prompt START\n' + masterPrompt + '\n[Gemini][Structured] Prompt END');
  try {
    const result = await tryGenerate(masterPrompt, true);
    const raw = result.response.text();
    console.log('[Gemini][Structured] Raw response START\n' + raw + '\n[Gemini][Structured] Raw response END');

    // Normalize fenced blocks if present
    const cleaned = String(raw).replace(/```json\n?|```/g, '').trim();

    // Try direct parse first
    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('[Gemini JSON Parse Warning]:', parseError?.message);
      // Attempt to extract first JSON object
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch (e2) {
          console.error('[Gemini JSON Recovery Failed]:', e2?.message);
        }
      }
      console.error('Raw Gemini Response (truncated):', cleaned.slice(0, 500));
      throw new Error('AI returned invalid JSON: ' + cleaned.substring(0, 200));
    }
  } catch (err) {
    console.error('[Gemini][Structured] Error during generateContent:', err?.message);
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
  `- Start with a concise section titled: ## Trip Overview (2-5 sentences).`,
  `- Then each day as a level-3 heading: ### Day N: Title`,
  `- Under each day include labeled bold subsections exactly in this order:`,
  `  **Morning:** Provide 2-4 time-stamped steps as bullets. Each step must follow this exact pattern: "- HH:MM AM/PM — Title: 1 short sentence (Duration: XhYm)".`,
  `  **Afternoon:** Provide 2-4 time-stamped steps with the same pattern as Morning. Include realistic transfer notes where applicable.`,
  `  **Evening:** Provide 1-3 time-stamped steps with the same pattern. End with a relaxed option if suitable.`,
  `  **Meals:** (1-3 named spots with short notes)`,
  `  **Logistics & Tips:** (practical notes for that day)`,
  `- After the final day, add a global section: ## Must Try (foods/experiences unique to the destination; bullet points with 1 sentence each).`,
  `- End with: ## Tips (essential, safety, transport, money-saving; 5-10 concise bullets).`,
  `- Avoid filler; be specific, localized, and respect the exact duration.`
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
      md += `\n### Day ${d}: ${loc} Focus\n**Morning:**\n- 08:30 AM — Coffee & Start: Cozy cafe to fuel up (Duration: 45m)\n- 09:30 AM — Signature Sight: Guided visit to a top landmark (Duration: 1h30m)\n- 11:15 AM — Stroll: Walk a scenic street or market (Duration: 45m)\n**Afternoon:**\n- 12:30 PM — Lunch Nearby: Casual local eatery (Duration: 1h)\n- 02:00 PM — Museum/Attraction: Deep dive into ${loc}'s culture (Duration: 1h30m)\n- 03:45 PM — Park/Lookout: Short break with views (Duration: 30m)\n**Evening:**\n- 06:00 PM — Sunset Spot: Golden-hour viewpoint (Duration: 45m)\n- 07:30 PM — Dinner: Regional specialty restaurant (Duration: 1h30m)\n**Meals:**\n- Cafe Aurora — Light breakfast, great espresso\n- Market Bistro — Local plates for lunch\n- Atelier Kitchen — Seasonal dinner tasting\n**Logistics & Tips:**\n- Use rideshare or walk between close sights; carry small cash.\n- Prebook timed entries when possible.\n`;
    }
    md += `\n## Must Try\n- Signature dish or experience specific to ${locs[0]}.\n- A local dessert or market to sample.\n- A short, unique activity tied to the place.\n`;
    md += `\n## Tips\n- Start early for popular sights; prebook tickets when possible.\n- Carry cash and cards; confirm local transport hours.\n- Dress for local norms and weather; stay hydrated.\n- Keep copies of IDs; use reputable taxis/rides.\n`;
    return md;
  }

  // Compute deterministic cache key (stable across field order)
  const cacheKey = (() => {
    try {
      const canonical = {
        locations: Array.isArray(trip.locations) ? trip.locations : (trip.locations ? [trip.locations] : []),
        region: trip.region || null,
        durationDays: Number(trip.durationDays) || null,
        startDate: trip.startDate || null,
        endDate: trip.endDate || null,
        travelers: Number(trip.travelers) || null,
        pace: dna.pace || null,
        budget: dna.budget || null,
        interests: Array.isArray(dna.interests) ? dna.interests.slice(0,6) : [],
        diet: dna.diet || null,
      };
      return JSON.stringify(canonical);
    } catch { return null; }
  })();

  if (cacheKey && _itineraryCache.has(cacheKey)) {
    return _itineraryCache.get(cacheKey);
  }

  try {
    // If AI is disabled for itinerary, return deterministic fallback immediately
    if (!ITINERARY_USE_AI) {
      const fb = buildFallbackItinerary();
      if (cacheKey) _itineraryCache.set(cacheKey, fb);
      return fb;
    }

    const md = await callGemini({ prompt });
    if (!md || typeof md !== 'string') {
      const fb = buildFallbackItinerary();
      if (cacheKey) _itineraryCache.set(cacheKey, fb);
      return fb;
    }

    const lower = md.toLowerCase();
    const locs = trip.locations && trip.locations.length ? trip.locations : [];
    let anchorOk = true;
    if (locs.length) {
      // Build keyword tokens from provided locations; handle comma/pipe/semicolon and word splits.
      const tokens = Array.from(new Set(
        locs
          .flatMap(raw => String(raw || '')
            .toLowerCase()
            .split(/[\,\|;\/]+/)
            .flatMap(part => {
              const p = part.trim();
              if (!p) return [];
              const words = p.split(/[^a-zA-Z]+/).map(w => w.trim()).filter(w => w.length >= 3);
              // Include the whole part and its words
              return [p, ...words];
            })
          )
          .filter(Boolean)
      ));
      const anyPresent = tokens.some(t => lower.includes(t));
      if (!anyPresent) anchorOk = false;
    } else if (trip.region) {
      if (!lower.includes(String(trip.region).toLowerCase())) anchorOk = false;
    }

    if (!anchorOk) {
      console.warn('[Itinerary] Output failed anchor validation. Using fallback.');
      const fb = buildFallbackItinerary();
      if (cacheKey) _itineraryCache.set(cacheKey, fb);
      return fb;
    }
    if (cacheKey) _itineraryCache.set(cacheKey, md);
    return md;
  } catch (err) {
    console.error('[Itinerary] Generation failed:', err.message);
    const fb = buildFallbackItinerary();
    if (cacheKey) _itineraryCache.set(cacheKey, fb);
    return fb;
  }
}

/**
 * Estimate total trip budget in INR using Gemini.
 * Input: { destination, days, travelers }
 * Returns: number (INR). Fallback: 25000.
 */
export async function estimateDreamBudget({ destination, days, travelers } = {}) {
  const FALLBACK = 25000;
  try {
    const dest = String(destination || '').trim() || 'Unknown';
    const d = Number(days) || 1;
    const t = Number(travelers) || 1;

    const prompt = `Act as a travel budget planner. Estimate the total cost for a trip.
Destination: ${dest}
Duration: ${d} days
Travelers: ${t}
Include transportation, accommodation, food, and activities.
Give a single numeric estimate in INR.`;

    const text = await callGemini({ prompt });
    const raw = String(text || '').trim();
    // Normalize common formats: code-fences, commas, currency symbols, units like lakh/crore/k
    const cleaned = raw.replace(/```[a-z]*\n?|```/gi, '').trim();
    // Try to detect units (lakh/crore/thousand/k) and scale accordingly
    const lower = cleaned.toLowerCase();
    const unitMultiplier = (() => {
      if (/crore/.test(lower)) return 10000000; // 1 crore = 10,000,000
      if (/lakh|lac/.test(lower)) return 100000; // 1 lakh = 100,000
      if (/thousand/.test(lower)) return 1000;
      // Handle patterns like "1.2k" (case-insensitive)
      if (/\b\d+(?:\.\d+)?\s*k\b/i.test(cleaned)) return 1000;
      return 1;
    })();

    // Extract first numeric token (supports decimals). Remove commas first.
    const numMatch = cleaned.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) return FALLBACK;
    let value = parseFloat(numMatch[1]);
    if (!isFinite(value) || value <= 0) return FALLBACK;

    // If currency appears to be in INR already, unitMultiplier adjusts scale if textual units present
    value = value * unitMultiplier;
    // Guardrails: clamp to reasonable range (₹5k–₹50L) but keep number if within
    if (value < 5000) return FALLBACK;
    if (value > 5000000) return Math.round(value); // still return, consumer can format
    return Math.round(value);
  } catch (err) {
    console.warn('[Budget] estimateDreamBudget failed:', err?.message);
    return FALLBACK;
  }
}

// Catchy chat title + subtitle for sidebar using Gemini; safe fallbacks when key is missing
export async function generateChatTitle({ tripState = {} }) {
  const t = tripState || {};
  const locs = Array.isArray(t.locations) ? t.locations : (t.locations ? [t.locations] : []);
  const where = locs.length ? locs.join(' · ') : (t.region || 'Your Trip');
  const days = Number(t.durationDays) || (t.startDate && t.endDate ? 'Trip' : null);
  const pace = t.pace ? String(t.pace).replace(/_/g, ' ') : '';
  const budget = t.budget || '';

  const fallbackTitle = () => {
    const parts = [];
    if (where) parts.push(where);
    if (days && Number(days)) parts.push(`${days} Days`);
    const emojis = '✈️🌍🛸🌟🗺️🏖️🏔️🏙️';
    const em = emojis.split('')[Math.floor(Math.random() * emojis.length)] || '🌟';
    return `${em} ${parts.join(' • ') || 'Voyage'}`.trim();
  };
  const fallbackSubtitle = () => {
    const bits = [];
    if (pace) bits.push(pace.charAt(0).toUpperCase() + pace.slice(1));
    if (budget) bits.push(budget);
    if (t.startDate && t.endDate) bits.push(`${t.startDate} → ${t.endDate}`);
    return bits.length ? bits.join(' • ') : 'Personalized itinerary conversation';
  };

  try {
    const prompt = `Create a catchy, 3–6 word chat title for a travel planning conversation plus a one-sentence subtitle under 90 characters.
Return strict JSON only with keys: {"title":"...","subtitle":"..."}.
Rules:
- Include 1 tasteful emoji in the title if natural (no flags), keep it classy.
- Title: short, brandy, no trailing punctuation. Subtitle: vivid but concise.
- No markdown, no extra text, JSON only.

Context:
- Where: ${where}
- Duration: ${t.durationDays || 'n/a'} days
- Dates: ${t.startDate || ''} to ${t.endDate || ''}
- Travelers: ${t.travelers || ''}
- Pace: ${pace || ''}
- Budget: ${budget || ''}
`;
    const text = await callGemini({ prompt });
    const cleaned = String(text).replace(/```json\n?|```/g, '').trim();
    let parsed = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      return { title: fallbackTitle(), subtitle: fallbackSubtitle(), _raw: cleaned };
    }
    const title = String(parsed.title || '').trim() || fallbackTitle();
    const subtitle = String(parsed.subtitle || '').trim() || fallbackSubtitle();
    return { title, subtitle };
  } catch (e) {
    return { title: fallbackTitle(), subtitle: fallbackSubtitle(), error: e?.message };
  }
}