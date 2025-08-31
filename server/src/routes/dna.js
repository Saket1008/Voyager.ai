import { Router } from 'express';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(key);
}

function createGeminiPrompt(userData, userQuery) {
  const name = userData?.name || 'Traveler';
  const travelProfile = userData?.travelProfile || {};
  const foodProfile = userData?.foodProfile || {};
  const join = (v) => Array.isArray(v) ? v.join(', ') : (v || '');
  return `You are a world-class personal travel expert for a user named ${name}. Your task is to create a hyper-detailed, day-by-day travel itinerary based on their specific profile and request.\n\n**USER'S PERMANENT PROFILE (DO NOT DEVIATE):**\n- **Travel Pace:** ${travelProfile.pace || ''}\n- **Budget:** ${travelProfile.budget || ''}\n- **Interests:** ${join(travelProfile.interests)}\n- **Dietary Needs:** ${join(foodProfile.dietaryRestrictions)}\n- **Favorite Cuisines:** ${join(foodProfile.favoriteCuisines)}\n- **Must Avoid Foods:** ${join(foodProfile.mustAvoid)}\n\nAcknowledge these preferences in your recommendations (e.g., recommend specific vegetarian restaurants). The output must be in well-structured Markdown format.\n\n**USER'S CURRENT REQUEST:**\n"${userQuery || ''}"`;
}

router.post('/', async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Firebase admin not configured' });
    const idHeader = req.headers.authorization || '';
    const token = idHeader.startsWith('Bearer ') ? idHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const snap = await admin.firestore().collection('users').doc(uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'User profile not found' });
    const userData = snap.data();
    const userQuery = req.body?.prompt || '';
    const prompt = createGeminiPrompt(userData, userQuery);
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
    const resp = await model.generateContent(prompt);
    const md = resp?.response?.text?.() || '';
    if (!md) return res.status(500).json({ error: 'Empty response from model' });
    // Save journey for the user (title/prompt/itinerary)
    try {
      const now = new Date();
      const journey = {
        prompt: userQuery,
        title: (userQuery || 'Journey'),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        format: 'markdown',
        size: md.length,
      };
      await admin.firestore().collection('users').doc(uid).collection('journeys').add(journey);
    } catch (e) {
      console.warn('Failed to log journey', e?.message);
    }
    return res.json({ itinerary: md });
  } catch (e) {
    console.error('DNA route error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
