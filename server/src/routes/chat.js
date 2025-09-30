// server/src/routes/chat.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { callGemini } from '../services/ai.js';
import { getTravelProfile, logChatExchange } from '../services/firebaseAdmin.js';

const router = Router();
router.use(mustBeAuthed);
const CHAT_USE_AI = String(process.env.CHAT_USE_AI || 'false').toLowerCase() === 'true';

router.post('/', async (req, res) => {
  try {
    const { userMessage = '', currentTripState = {}, chatHistory = [] } = req.body || {};
    const uid = req?.user?.uid;

    // Defensive copy of incoming trip state
    let tripState = { ...(currentTripState || {}) };

    // 1) Fetch user's permanent travel profile (DNA). Merge into state under dna, and pass to AI separately
    let userProfileDNA = {};
    try {
      const profile = await getTravelProfile(uid);
      if (profile && typeof profile === 'object') {
        userProfileDNA = profile;
        tripState = { ...tripState, dna: { ...(tripState.dna || {}), ...profile } };
      }
    } catch (e) {
      console.warn('[chat] Failed to load travel profile:', e?.message);
    }

    // 2) Update tripState based on lastQuestionType and userMessage
    const lastQuestionType = currentTripState?.lastQuestionType;
    const lastQuestionPrompt = currentTripState?.lastQuestionPrompt || '';
    const lastQuestionOptions = currentTripState?.lastQuestionOptions || [];
    const msg = String(userMessage || '').trim();
    if (msg) {
      switch (lastQuestionType) {
        case 'destination': {
          // Normalize and auto-capitalize each word of destinations
          const parts = msg
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => s.replace(/\b([a-z])(\w*)/g, (_, a, b) => a.toUpperCase() + b));
          if (parts.length) {
            tripState.destination = parts.join(', ');
            tripState.locations = parts;
          } else {
            tripState.destination = msg;
          }
          break;
        }
        case 'doorstepChoice': {
          const l = msg.toLowerCase();
          const fromDoor = /doorstep|home|my\s+place/.test(l);
          const atDest = /destination|there|on\s+arrival/.test(l);
          if (fromDoor) tripState.doorstep = true;
          else if (atDest) tripState.doorstep = false;
          else tripState.doorstep = /start\s+from/.test(l) ? true : false;
          break;
        }
        case 'multiChoice': {
          const lower = msg.toLowerCase();
          const promptLower = String(lastQuestionPrompt || '').toLowerCase();
          // Transportation
          if (/transport|getting\s+there|getting\s+around|mode\s+of\s+transport|how\s+(do|will)\s+you\s+(get|go)/.test(promptLower) || /car|flight|plane|train|bus|taxi|rideshare|uber|lyft|cab|ferry|boat|other/.test(lower)) {
            const map = { plane: 'Flight' };
            const mode = ['Car','Flight','Train','Bus','Rideshare/Taxi','Ferry','Other'].find(o => lower.includes(o.toLowerCase())) || (map[lower] || msg);
            tripState.transportationMode = mode;
            tripState.transportation = { ...(tripState.transportation || {}), mode };
            break;
          }
          // Accommodation style
          if (/accommodation|stay|hotel|where\s+to\s+stay/.test(promptLower) || /guesthouse|homestay|hotel|airbnb|hostel|other/.test(lower)) {
            const style = ['Guesthouse','Homestay','Hotel','Airbnb','Hostel','Other'].find(o => lower.includes(o.toLowerCase())) || msg;
            tripState.accommodationStyle = style;
            break;
          }
          // Food budget
          if ((/budget|spend|food/.test(promptLower)) || (/low|mid|mid-range|high|specific/.test(lower) && /budget|spend|food/.test(lower))) {
            let fb = 'Mid-Range';
            if (/low/.test(lower)) fb = 'Low';
            else if (/high/.test(lower)) fb = 'High';
            else if (/specific/.test(lower)) fb = 'Specific Amount';
            tripState.foodBudget = fb;
            break;
          }
          // Activities
          if (/activity|activities|things to do|interests/.test(promptLower)) {
            tripState.activities = Array.isArray(tripState.activities) ? [...tripState.activities, msg] : [msg];
            break;
          }
          // Generic fallback
          tripState.lastSelection = msg;
          break;
        }
        case 'duration': {
          const n = parseInt(msg, 10);
          if (!Number.isNaN(n)) {
            tripState.duration = n;
            tripState.durationDays = n;
          }
          break;
        }
        case 'dates': {
          tripState.dates = msg;
          if (msg.includes(' to ')) {
            const [start, end] = msg.split(' to ').map(s => s.trim());
            if (start) tripState.startDate = start;
            if (end) tripState.endDate = end;
          }
          break;
        }
        case 'freeText': {
          // If this freeText likely contains destinations (comma-separated), capture them as locations too
          const looksLikeDest = /[,\n]/.test(msg) || /city|town|village|place|destination/i.test(msg);
          if (looksLikeDest) {
            const locs = msg
              .split(/[\n,]+/)
              .map(s => s.trim())
              .filter(Boolean)
              .map(s => s.replace(/\b([a-z])(\w*)/g, (_, a, b) => a.toUpperCase() + b));
            if (locs.length) {
              tripState.locations = locs;
              tripState.destination = locs.join(', ');
            }
          }
          tripState.notes = msg;
          break;
        }
        case 'travelers': {
          const n = parseInt(msg, 10);
          if (!Number.isNaN(n)) tripState.travelers = n;
          break;
        }
        case 'freeText': {
          tripState.notes = msg;
          break;
        }
        case 'transportDetails': {
          // Store raw details keyed by chosen mode
          const mode = tripState.transportationMode || tripState.transportation?.mode || 'Other';
          const details = { mode, raw: msg };
          tripState.transportation = { ...(tripState.transportation || {}), details };
          break;
        }
        case 'budget': {
          const raw = msg.trim();
          const lower = raw.toLowerCase();
          let period;
          if (/(per\s*-?\s*night|pn|pernight)/i.test(lower) || /night/.test(lower)) period = 'per-night';
          if (/total|entire|whole/i.test(lower)) period = 'total';
          let currency;
          if (/\$/.test(raw) || /usd\b/i.test(lower)) currency = 'USD';
          else if (/€/.test(raw) || /eur\b/i.test(lower)) currency = 'EUR';
          else if (/£/.test(raw) || /gbp\b/i.test(lower)) currency = 'GBP';
          else if (/₹/.test(raw) || /inr\b/i.test(lower)) currency = 'INR';
          const numMatch = raw.replace(/[, ]+/g, '').match(/(\d+\.?\d*)/);
          const amount = numMatch ? Number(numMatch[1]) : undefined;
          const prev = typeof tripState.budget === 'object' && tripState.budget ? tripState.budget : {};
          tripState.budget = {
            ...prev,
            ...(amount !== undefined ? { amount } : {}),
            ...(currency ? { currency } : {}),
            ...(period ? { period } : {}),
          };
          break;
        }
        case 'confirm':
        case 'done':
        default:
          break;
      }
    }

    // If the last step was choosing a transport mode, immediately ask for mode-specific details without calling AI again
  if (lastQuestionType === 'multiChoice' && /transport|mode\s+of\s+transport|getting\s+there|how\s+(do|will)\s+you\s+(get|go)/i.test(String(lastQuestionPrompt || ''))) {
      const mode = tripState.transportationMode || 'Other';
      let detailsPrompt = '';
      switch (String(mode).toLowerCase()) {
        case 'flight':
          detailsPrompt = 'Flight details (optional): departure city/airport, destination airport, approx. date/time, preferred airline. Or type "skip".';
          break;
        case 'train':
          detailsPrompt = 'Train details (optional): origin station/city, date/time window, class/seat preference. Or type "skip".';
          break;
        case 'bus':
          detailsPrompt = 'Bus details (optional): origin city/station, date/time window, any preferences. Or type "skip".';
          break;
        case 'car':
          detailsPrompt = 'Car travel details (optional): pickup city, pickup date/time, self-drive or taxi/ride, max daily driving time. Or type "skip".';
          break;
        case 'rideshare/taxi':
          detailsPrompt = 'Taxi/Rideshare details (optional): pickup city, pickup time, preferred service (Uber/Lyft/Cab). Or type "skip".';
          break;
        case 'ferry':
          detailsPrompt = 'Ferry details (optional): route/ports, date/time window, vehicle onboard? Or type "skip".';
          break;
        default:
          detailsPrompt = 'Travel details (optional): briefly describe your plan to get there. Or type "skip".';
      }
      const payload = {
        assistantMessage: `Got it — ${mode}. ${detailsPrompt}`,
        newTripState: tripState,
        nextQuestionType: 'transportDetails',
        nextQuestionPrompt: detailsPrompt,
        nextQuestionCurrentValue: null
      };
      // Persist exchange
      logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
      return res.json(payload);
    }

    // Helper: check if essential fields are present
    const hasEssentials = !!(tripState.destination || (Array.isArray(tripState.locations) && tripState.locations.length) || tripState.region)
      && !!(tripState.durationDays || (tripState.startDate && tripState.endDate))
      && !!tripState.travelers;

    // NEW: Always ask upfront whether to plan from doorstep or start at destination
    // If not answered yet, insert this step before any other logic and skip AI call
    if (typeof tripState.doorstep === 'undefined') {
      const payload = {
        assistantMessage: 'Should I plan your itinerary from your doorstep (including travel to the destination), or start at the destination itself?',
        newTripState: tripState,
        nextQuestionType: 'doorstepChoice',
        nextQuestionPrompt: 'Start from your doorstep or at the destination?',
        nextQuestionCurrentValue: null,
        nextQuestionOptions: ['Start from my doorstep', 'Start at the destination'],
        // Provide an explicit input spec for the frontend StageInput to render buttons
        input: { type: 'options', options: ['Start from my doorstep', 'Start at the destination'] },
      };
      logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
      return res.json(payload);
    }

    // Fast path: if the user is clearly asking to finalize, skip to generate
    // Include common misspellings like "itenary" and shorthand like "itiner"
    const userWantsDone = /generate|final(ize|ise)|ready|done|create|build\s+itiner|give\s+the\s+final|itinerary|itenary/i.test(msg);
    if (userWantsDone && hasEssentials) {
      const summary = `${(tripState.locations && tripState.locations.join(', ')) || tripState.destination || tripState.region}, ${(tripState.durationDays || '')} days, ${tripState.travelers} traveler${Number(tripState.travelers) > 1 ? 's' : ''}${tripState.startDate && tripState.endDate ? ` (${tripState.startDate} → ${tripState.endDate})` : ''}`.trim();
      const payload = {
        assistantMessage: `All set — ${summary}. Ready to generate your itinerary now?`,
        newTripState: tripState,
        nextQuestionType: 'generate',
        nextQuestionPrompt: 'Generate your itinerary:',
        nextQuestionCurrentValue: null
      };
      logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
      return res.json(payload);
    }

    // If essentials are present, minimize further questioning: confirm then generate
    if (hasEssentials) {
      const positive = /^(\s*)?(yes|y|ok|okay|sure|sounds good|go ahead|proceed|generate|let'?s go|do it)\b/i.test(msg);
      const negative = /^(\s*)?(no|n|not yet|change|edit|modify|adjust)\b/i.test(msg);
      const summary = `${(tripState.locations && tripState.locations.join(', ')) || tripState.destination || tripState.region}, ${(tripState.durationDays || '')} days, ${tripState.travelers} traveler${Number(tripState.travelers) > 1 ? 's' : ''}${tripState.startDate && tripState.endDate ? ` (${tripState.startDate} → ${tripState.endDate})` : ''}`.trim();

      if (lastQuestionType === 'confirm') {
        if (positive || userWantsDone) {
          const payload = {
            assistantMessage: `Perfect — generating your itinerary now.`,
            newTripState: tripState,
            nextQuestionType: 'generate',
            nextQuestionPrompt: 'Generate your itinerary:',
            nextQuestionCurrentValue: null
          };
          logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
          return res.json(payload);
        }
        if (negative) {
          const payload = {
            assistantMessage: `No problem — what would you like to change (destination, dates, days, travelers)?`,
            newTripState: tripState,
            nextQuestionType: 'freeText',
            nextQuestionPrompt: 'What should we update?',
            nextQuestionCurrentValue: null
          };
          logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
          return res.json(payload);
        }
        // If user replied with something else, still keep confirm on screen rather than ask granular
        const payload = {
          assistantMessage: `Just to confirm: ${summary}. Shall I generate your itinerary?`,
          newTripState: tripState,
          nextQuestionType: 'confirm',
          nextQuestionPrompt: 'Confirm Trip Details:',
          nextQuestionCurrentValue: summary
        };
        logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
        return res.json(payload);
      }

      // If we haven't asked for confirmation yet, do it now and skip the AI call
      const payload = {
        assistantMessage: `Okay — ${summary}. Shall I generate your itinerary?`,
        newTripState: tripState,
        nextQuestionType: 'confirm',
        nextQuestionPrompt: 'Confirm Trip Details:',
        nextQuestionCurrentValue: summary
      };
      logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
      return res.json(payload);
    }

    // 3) Prepare a copy for AI without internal helper fields
    const { lastQuestionType: _lqt, lastQuestionPrompt: _lqp, lastQuestionOptions: _lqo, ...aiTripState } = tripState;

    // 4) Local-first router: avoid AI calls during chat unless explicitly enabled
    let aiResponse;
    if (CHAT_USE_AI) {
      try {
        aiResponse = await callGemini({
          prompt: userMessage,
          tripState: aiTripState,
          chatHistory,
          userProfileDNA,
        });
      } catch (gemErr) {
        console.error('[chat] AI call failed:', gemErr?.message || gemErr);
        // Graceful fallback: nudge to next essential instead of 500
        const missing = [];
        if (!(tripState.destination || (Array.isArray(tripState.locations) && tripState.locations.length) || tripState.region)) missing.push('destination/region');
        if (!(tripState.durationDays || (tripState.startDate && tripState.endDate))) missing.push('duration/dates');
        if (!tripState.travelers) missing.push('travelers');
        const msgHint = missing.length ? `Let's continue. Please provide ${missing[0]}.` : 'Let’s continue to confirmation.';
        const payload = {
          assistantMessage: `I hit a snag processing that. ${msgHint}`,
          newTripState: tripState,
          nextQuestionType: missing[0] === 'duration/dates' ? 'duration' : (missing[0] === 'travelers' ? 'travelers' : (missing[0] ? 'destination' : 'confirm')),
          nextQuestionPrompt: missing[0] === 'duration/dates' ? 'How many days will your trip be?' : (missing[0] === 'travelers' ? 'How many travelers?' : (missing[0] ? 'Where are you headed?' : 'Confirm trip details:')),
          nextQuestionCurrentValue: null
        };
        logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
        return res.json(payload);
      }
    } else {
      // Determine next step deterministically without AI to save quota
      const nextMissing = () => {
        if (typeof tripState.doorstep === 'undefined') return { type: 'doorstepChoice', prompt: 'Start from your doorstep or at the destination?', options: ['Start from my doorstep', 'Start at the destination'] };
        if (!(tripState.destination || (Array.isArray(tripState.locations) && tripState.locations.length) || tripState.region)) return { type: 'destination', prompt: 'Destination/Region' };
        if (!(tripState.durationDays || (tripState.startDate && tripState.endDate))) return { type: 'duration', prompt: 'Trip Length (days)' };
        if (!tripState.startDate || !tripState.endDate) return { type: 'dates', prompt: 'Travel Dates?' };
        if (!tripState.travelers) return { type: 'travelers', prompt: 'Number of travelers?' };
        return { type: 'confirm', prompt: 'Confirm Trip Details:' };
      };
      const next = nextMissing();
      const summary = `${(tripState.locations && tripState.locations.join(', ')) || tripState.destination || tripState.region || ''}`
        + `${tripState.durationDays ? ` • ${tripState.durationDays}d` : ''}`
        + `${tripState.startDate && tripState.endDate ? ` • ${tripState.startDate} → ${tripState.endDate}` : ''}`
        + `${tripState.travelers ? ` • ${tripState.travelers} pax` : ''}`;
      const assistantMessage = (() => {
        switch (next.type) {
          case 'destination': return 'Great. Where are you headed? (city/region)';
          case 'duration': return 'Nice. How many days will this trip be?';
          case 'dates': return 'Got it. When are you planning to travel?';
          case 'travelers': return 'Thanks. How many travelers are going?';
          case 'confirm': return `Okay — ${summary.trim().replace(/^•\s*/, '')}. Shall I generate your itinerary?`;
          case 'doorstepChoice':
          default: return 'Should I plan from your doorstep (including travel) or start at the destination itself?';
        }
      })();

      const payload = {
        assistantMessage,
        newTripState: tripState,
        nextQuestionType: next.type,
        nextQuestionPrompt: next.prompt,
        nextQuestionCurrentValue: null,
      };
      if (next.options) payload.nextQuestionOptions = next.options;

      // Add heuristic hints for duration if relevant
      const computeRecommendedDays = (state) => {
        try {
          const locs = Array.isArray(state?.locations) ? state.locations.filter(Boolean) : [];
          const hasRegion = !!state?.region;
          let base;
          if (locs.length) {
            base = locs.length * 2 + Math.max(0, locs.length - 1);
          } else if (hasRegion) {
            base = 5;
          } else {
            base = 3;
          }
          const pace = String(state?.pace || state?.dna?.pace || '').toLowerCase();
          if (pace.includes('relax')) base += 1;
          if (pace.includes('action')) base = Math.max(2, base - 1);
          return Math.max(2, Math.min(21, base));
        } catch { return undefined; }
      };
      if (next.type === 'duration') {
        const rec = computeRecommendedDays(tripState);
        if (rec) payload.nextQuestionHints = { recommended_days: rec };
      }
      // Provide input spec to frontend for options stage
      if (next.type === 'doorstepChoice') {
        payload.input = { type: 'options', options: next.options };
      } else if (next.type === 'duration') {
        payload.input = { type: 'days' };
      } else if (next.type === 'dates') {
        payload.input = { type: 'dates' };
      }
  logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
  return res.json(payload);
    }

    // 5) Prepare response payload for frontend orchestration
    const next = aiResponse?.nextQuestion || {};
    let nextType = next?.type || 'freeText';
    let nextPrompt = next?.prompt || '';
    let nextCurrent = typeof next?.currentValue !== 'undefined' ? next.currentValue : null;
    const granular = /car\s+model|model\s+and\s+year|car\s+details|exact\s+distance|distance\b|flight\s+(number|details)|pnr|booking\s+ref|arrival\/departure|arrival\s+details|departure\s+time|transportation\s+from|how\s+will\s+you\s+get\s+from|preferred\s+method|route\b|traffic/i.test(nextPrompt);
    if (hasEssentials && (nextType === 'freeText' && granular)) {
      const summary = `${(tripState.locations && tripState.locations.join(', ')) || tripState.destination || tripState.region}, ${(tripState.durationDays || '')} days, ${tripState.travelers} traveler${Number(tripState.travelers) > 1 ? 's' : ''}${tripState.startDate && tripState.endDate ? ` (${tripState.startDate} → ${tripState.endDate})` : ''}`.trim();
      nextType = 'confirm';
      nextPrompt = 'Confirm Trip Details:';
      nextCurrent = summary;
    }

    // Normalize generic transport questions into a structured selection step
    const transportAsk = /(mode\s+of\s+transport|transportation|how\s+(do|will)\s+you\s+(get|go)\s+there|getting\s+(there|around)|travel\s+(to|between))/i;
    if (transportAsk.test(nextPrompt) || transportAsk.test(aiResponse?.assistantReply || '')) {
      const options = ['Flight', 'Train', 'Bus', 'Car', 'Rideshare/Taxi', 'Ferry', 'Other'];
      const prompt = 'How would you like to travel?';
      const payload = {
        assistantMessage: aiResponse?.assistantReply ? `${aiResponse.assistantReply}\n\nChoose a mode:` : 'How would you like to travel?',
        newTripState: tripState,
        nextQuestionType: 'multiChoice',
        nextQuestionPrompt: prompt,
        nextQuestionCurrentValue: null,
        nextQuestionOptions: options,
        input: { type: 'options', options }
      };
      logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
      return res.json(payload);
    }

    // Derive helpful hints for the next step, if applicable
    let nextHints = (aiResponse?.nextQuestion?.hints) || (aiResponse?.hints) || {};
    const computeRecommendedDays = (state) => {
      try {
        const locs = Array.isArray(state?.locations) ? state.locations.filter(Boolean) : [];
        const hasRegion = !!state?.region;
        let base;
        if (locs.length) {
          base = locs.length * 2 + Math.max(0, locs.length - 1); // ~2 days per stop + travel between
        } else if (hasRegion) {
          base = 5; // region-only heuristic default
        } else {
          base = 3;
        }
        // Pace tweak
        const pace = String(state?.pace || '').toLowerCase();
        if (pace.includes('relax')) base += 1;
        if (pace.includes('action')) base = Math.max(2, base - 1);
        return Math.max(2, Math.min(21, base));
      } catch { return undefined; }
    };
  if (!nextHints || typeof nextHints !== 'object') { nextHints = {}; }
    if ((nextType === 'duration' || /how\s+many\s+days|trip\s+length/i.test(nextPrompt)) && !nextHints.recommended_days) {
      const rec = computeRecommendedDays(tripState);
      if (rec) nextHints.recommended_days = rec;
    }

    const payload = {
      assistantMessage: aiResponse?.assistantReply || '',
      newTripState: tripState,
      nextQuestionType: nextType,
      nextQuestionPrompt: nextPrompt,
      nextQuestionCurrentValue: nextCurrent,
      nextQuestionOptions: Array.isArray(aiResponse?.nextQuestion?.options) ? aiResponse.nextQuestion.options : undefined,
      nextQuestionHints: Object.keys(nextHints || {}).length ? nextHints : undefined,
    };
    logChatExchange(uid, { userMessage: msg, assistantMessage: payload.assistantMessage, tripState, nextQuestionType: payload.nextQuestionType, nextQuestionPrompt: payload.nextQuestionPrompt });
    return res.json(payload);
  } catch (err) {
    console.error('[/api/chat] Error:', err);
    return res.status(500).json({
      error: 'Failed to process chat. Please try again.'
    });
  }
});

export default router;