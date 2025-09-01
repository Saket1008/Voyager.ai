import { Router } from 'express';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { getGeminiResponse } from '../services/ai.js';

const router = Router();

// Build the JSON-focused master prompt; supports a string prompt or a structured context
function createJsonPrompt(userData, userQueryOrContext) {
  const name = userData?.name || 'Traveler';
  const tp = userData?.travelProfile || {};
  const fp = userData?.foodProfile || {};
  const join = (v) => (Array.isArray(v) ? v.join(', ') : (v || 'not specified'));
  // Normalize context
  const isObj = userQueryOrContext && typeof userQueryOrContext === 'object';
  const ctx = isObj ? userQueryOrContext : { freeform: String(userQueryOrContext || '') };
  const trip = ctx.trip || {};
  const freeform = ctx.freeform || '';

  return `
**ROLE:** You are a world-class, AI-powered travel expert named "Voyager".

**TASK:** Your primary task is to generate a structured, day-by-day travel itinerary based on a user's specific profile and their direct request. The output **MUST** be a valid JSON object containing a single key, "itinerary", which holds an array of itinerary item objects.

**USER PROFILE (Strictly adhere to these preferences):**
- **User's Name:** ${name}
- **Travel Pace:** ${tp.pace || 'not specified'}
- **Budget:** ${tp.budget || 'not specified'}
- **Interests:** ${join(tp.interests)}
- **Dietary Restrictions:** ${join(fp.dietaryRestrictions)}
- **Favorite Cuisines:** ${join(fp.favoriteCuisines)}

**CURRENT TRIP CONTEXT:**
${Object.keys(trip).length ? Object.entries(trip).map(([k,v]) => `- ${k}: ${Array.isArray(v)?v.join(', '):v}`).join('\n') : '- none provided'}

**USER's CURRENT REQUEST (freeform):**
"${freeform}"

**JSON OUTPUT REQUIREMENTS (MANDATORY):**

Your entire response **MUST** be a single JSON object. Do not include any text, markdown formatting, or explanations outside of the JSON structure.

The JSON object must have one root key: "itinerary".
The value of "itinerary" must be an array [].
Each object inside the array represents one event or item in the itinerary and **MUST** contain the following four keys:

1.  "time" (string): A specific time (e.g., "9:00 AM", "Afternoon", "Evening") or a general label like "Morning Activity".
2.  "title" (string): A short, descriptive title for the event (e.g., "Visit the Senso-ji Temple", "Dinner at Ichiran Ramen").
3.  "description" (string): A one or two-sentence description of the activity, including why it matches the user's profile.
4.  "type" (string): The category of the event. Must be one of the following exact values: food, activity, lodging, info, or tip.

`;
}

router.post('/', async (req, res) => {
  const admin = ensureFirebaseAdmin();
  if (!admin) return res.status(500).json({ message: 'Firebase Admin not configured.' });
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });
  const { prompt } = req.body || {};
  if (prompt === undefined || prompt === null || prompt === '') return res.status(400).json({ message: 'Prompt is required.' });

    const userDocRef = admin.firestore().collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) return res.status(404).json({ message: 'User profile not found.' });
    const userData = userSnap.data();

  const finalPrompt = createJsonPrompt(userData, prompt);
    const raw = await getGeminiResponse(finalPrompt);

    // Parse strict JSON, stripping optional fences
    let jsonResponse;
    try {
      const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      jsonResponse = JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to parse Gemini response as JSON:', err);
      console.error('Raw Response was:', raw);
      return res.status(500).json({ message: 'The AI returned an invalid format. Please try again.' });
    }
    if (!jsonResponse || !Array.isArray(jsonResponse.itinerary)) {
      return res.status(500).json({ message: 'The AI returned a malformed itinerary. Please try again.' });
    }

    // Log lightweight journey metadata
    try {
      const promptSummary = typeof prompt === 'object'
        ? (prompt?.trip?.destination || JSON.stringify(prompt).slice(0, 60))
        : String(prompt).slice(0, 60);
      const title = typeof prompt === 'object' && prompt?.trip?.destination
        ? `Trip to ${prompt.trip.destination}`
        : `Trip: ${promptSummary}`;
      await userDocRef.collection('journeys').add({
        prompt: typeof prompt === 'string' ? prompt : promptSummary,
        title,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        format: 'json',
      });
    } catch (e) {
      console.warn('Failed to log journey', e?.message || e);
    }

    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error in /generate-itinerary endpoint:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

export default router;
