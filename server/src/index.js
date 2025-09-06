// server/src/index.js

import dotenv from 'dotenv';
import fs from 'fs';
// Attempt standard dotenv load
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  console.warn('[EnvCheck] dotenv.config() reported error:', dotenvResult.error.message);
}
// Fallback: manual parse if GEMINI_API_KEY still missing (handles UTF-16 or BOM issues)
if (!process.env.GEMINI_API_KEY) {
  try {
    const raw = fs.readFileSync(new URL('../.env', import.meta.url));
    // Try UTF-8 first, if zeros embedded assume UTF-16 LE
    let text = raw.toString('utf8');
    if (/\x00/.test(text)) {
      text = raw.toString('utf16le');
    }
    text.split(/\r?\n/).forEach(line => {
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    });
    if (process.env.GEMINI_API_KEY) {
      console.log('[EnvCheck] GEMINI_API_KEY recovered via manual parse.');
    }
  } catch (e) {
    console.warn('[EnvCheck] Manual .env parse failed:', e.message);
  }
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';

// Import your new and refactored routes
import chatRouter from './routes/chat.js';
import suggestRouter from './routes/suggest.js';
import itineraryRouter from './routes/itinerary.js';
import journeysRouter from './routes/journeys.js';
import destinationsRouter from './routes/destinations.js';
// Removed legacy DNA route

const app = express();

app.use(express.json({ limit: '1mb' }));

// CORS setup from your file
const allowedOrigins = (process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:5173']);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- API Routes ---
// The main chat conductor - now very fast
app.use('/api/chat', authMiddleware, chatRouter);
// The dedicated fast suggestion route
app.use('/api/suggest', authMiddleware, suggestRouter);
// The dedicated heavyweight itinerary route
app.use('/api/itinerary', authMiddleware, itineraryRouter);

// Keeping your other existing routes
app.use('/api/destinations', authMiddleware, destinationsRouter);
// Legacy DNA route removed in favor of /api/itinerary
app.use('/api/journeys', authMiddleware, journeysRouter);


const port = process.env.PORT || 5000;
// Debug: show whether GEMINI_API_KEY loaded (without leaking full key)
const gKey = process.env.GEMINI_API_KEY;
console.log('[EnvCheck] GEMINI_API_KEY present:', gKey ? `yes (length=${gKey.length})` : 'no');
console.log('[EnvCheck] GEMINI_MODEL:', process.env.GEMINI_MODEL || 'default');
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));