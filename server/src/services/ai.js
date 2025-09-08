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

// Generate dynamic chat name based on conversation context
export async function generateChatName({ message, stage, flowState, user }) {
  const userName = user?.displayName || 'Traveler';
  const destinations = flowState?.locations || [];
  const region = flowState?.region || '';
  const duration = flowState?.durationDays || '';
  
  // Extract location from message if not in flowState
  const messageText = message.toLowerCase();
  const locationKeywords = ['tokyo', 'paris', 'london', 'new york', 'rome', 'barcelona', 'amsterdam', 'berlin', 'mumbai', 'delhi', 'bangalore', 'singapore', 'bangkok', 'dubai', 'istanbul', 'moscow', 'sydney', 'melbourne', 'toronto', 'vancouver', 'mexico city', 'rio de janeiro', 'buenos aires', 'cape town', 'cairo', 'marrakech', 'lisbon', 'madrid', 'athens', 'prague', 'vienna', 'budapest', 'stockholm', 'oslo', 'copenhagen', 'helsinki', 'warsaw', 'krakow', 'brussels', 'zurich', 'geneva', 'munich', 'frankfurt', 'hamburg', 'cologne', 'dresden', 'leipzig', 'stuttgart', 'düsseldorf', 'essen', 'dortmund', 'bremen', 'hannover', 'nuremberg', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'mönchengladbach', 'braunschweig', 'chemnitz', 'kiel', 'aachen', 'halle', 'magdeburg', 'freiburg', 'krefeld', 'lübeck', 'oberhausen', 'erfurt', 'mainz', 'rostock', 'kassel', 'hagen', 'hamm', 'saarbrücken', 'mülheim', 'potsdam', 'ludwigshafen', 'oldenburg', 'leverkusen', 'osnabrück', 'solingen', 'heidelberg', 'herne', 'neuss', 'darmstadt', 'paderborn', 'regensburg', 'ingolstadt', 'würzburg', 'fürth', 'wolfsburg', 'offenbach', 'ulm', 'heilbronn', 'pforzheim', 'göttingen', 'reutlingen', 'bremerhaven', 'remscheid', 'bergisch gladbach', 'jena', 'regenburg', 'erlangen', 'moers', 'siegen', 'hildesheim', 'salzgitter', 'cottbus', 'koblenz', 'giessen', 'witten', 'schwerin', 'flensburg', 'brandenburg', 'zwickau', 'hof', 'lüneburg', 'stralsund', 'friedrichshafen', 'landshut', 'aschaffenburg', 'kempten', 'schweinfurt', 'rosenheim', 'neu-ulm', 'passau', 'freising', 'straubing', 'amberg', 'bayreuth', 'landau', 'weiden', 'schwandorf', 'schweinfurt', 'rosenheim', 'neu-ulm', 'passau', 'freising', 'straubing', 'amberg', 'bayreuth', 'landau', 'weiden', 'schwandorf'];
  
  let detectedLocation = '';
  for (const keyword of locationKeywords) {
    if (messageText.includes(keyword)) {
      detectedLocation = keyword;
      break;
    }
  }

  const primaryLocation = destinations[0] || detectedLocation || region;
  
  const fallbackNames = [
    '🌍 Global Adventure',
    '✈️ Travel Dreams',
    '🗺️ Journey Planner',
    '🌟 Epic Trip',
    '🚀 Voyage Quest',
    '🏖️ Paradise Search',
    '🏔️ Mountain Explorer',
    '🌆 City Hopper',
    '🍃 Nature Escape',
    '🎯 Perfect Trip'
  ];

  try {
    const prompt = `Generate a catchy, engaging chat name (2-4 words) for a travel planning conversation.
Return ONLY the name, no quotes, no JSON, no extra text.

Context:
- User: ${userName}
- Message: "${message}"
- Stage: ${stage}
- Primary Location: ${primaryLocation || 'Not specified'}
- All Destinations: ${destinations.join(', ') || 'Not specified'}
- Region: ${region || 'Not specified'}
- Duration: ${duration ? `${duration} days` : 'Not specified'}

Rules:
- MUST include the primary location if specified (${primaryLocation})
- Include 1 relevant emoji (travel-related, no flags)
- Make it exciting and location-specific
- Examples: "🌍 Tokyo Dreams", "🏔️ Alpine Quest", "🍃 Nature Escape", "🌆 Paris Explorer"
- Keep it under 20 characters total
- Make it sound like an adventure to that specific place
- If no location, use generic travel terms`;

    const text = await callGemini({ prompt });
    const cleaned = String(text).trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
    
    // Validate the response
    if (cleaned && cleaned.length > 2 && cleaned.length < 25) {
      return cleaned;
    }
    
    // Fallback to location-specific or random selection
    if (primaryLocation) {
      const locationEmojis = {
        'tokyo': '🏯', 'paris': '🗼', 'london': '🇬🇧', 'new york': '🗽', 'rome': '🏛️',
        'barcelona': '🏰', 'amsterdam': '🌷', 'berlin': '🏛️', 'mumbai': '🏛️', 'delhi': '🏛️',
        'singapore': '🌴', 'bangkok': '🏛️', 'dubai': '🏙️', 'istanbul': '🕌', 'moscow': '🏛️',
        'sydney': '🏛️', 'melbourne': '🏛️', 'toronto': '🏛️', 'vancouver': '🏔️'
      };
      const emoji = locationEmojis[primaryLocation.toLowerCase()] || '🌍';
      return `${emoji} ${primaryLocation} Adventure`;
    }
    
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
    
  } catch (e) {
    console.error('[generateChatName] Error:', e?.message);
    if (primaryLocation) {
      return `🌍 ${primaryLocation} Trip`;
    }
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  }
}