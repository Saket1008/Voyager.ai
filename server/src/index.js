import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables as early as possible. Try normal dotenv first,
// then fall back to parsing the .env file as UTF-16LE (some Windows editors
// save files in UTF-16 which dotenv can't parse).
const envPath = path.resolve(process.cwd(), '.env');
let loaded = false;
try {
  const r = dotenv.config();
  loaded = !!(r.parsed && Object.keys(r.parsed).length);
} catch (e) {
  loaded = false;
}

if (!loaded && fs.existsSync(envPath)) {
  try {
    const raw = fs.readFileSync(envPath);
    // detect UTF-16 LE BOM (0xFF 0xFE)
    const isUtf16Le = raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe;
    const str = isUtf16Le ? raw.toString('utf16le') : raw.toString('utf8');
    const parsed = dotenv.parse(str);
    Object.keys(parsed).forEach((k) => {
      if (process.env[k] === undefined) process.env[k] = parsed[k];
    });
    console.log('[VoyagerAI] .env loaded via fallback parser; UTF16LE=', isUtf16Le);
    loaded = true;
  } catch (e) {
    // don't leak secrets in logs
    console.log('[VoyagerAI] .env fallback parsing failed');
  }
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Import routers AFTER env is loaded so downstream modules see process.env
const { default: suggestRouter } = await import('./routes/suggest.js');
const { default: chatRouter } = await import('./routes/chat.js');
const { default: dnaRouter } = await import('./routes/dna.js');
const { default: destinationsRouter } = await import('./routes/destinations.js');
const { default: journeysRouter } = await import('./routes/journeys.js');
const { authMiddleware } = await import('./middleware/auth.js');

const app = express();

app.use(express.json({ limit: '1mb' }));

// CORS: allow explicit origins, never '*" when credentials are enabled
const allowedOrigins = (process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173']);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Basic rate limiting for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Diagnostic: report whether Gemini key is present in environment (do NOT log the key itself)
console.log(`[VoyagerAI] GEMINI_API_KEY is ${process.env.GEMINI_API_KEY ? 'present' : 'missing'} in process.env`);
// Additional diagnostics to help debug .env loading
try {
  const fs = await import('fs');
  const path = await import('path');
  const cwd = process.cwd();
  console.log('[VoyagerAI] server working dir:', cwd);
  const guess = path.resolve(cwd, '.env');
  console.log('[VoyagerAI] looking for .env at', guess, 'exists=', fs.existsSync(guess));
} catch (e) {}

// API routes
// Public or legacy routes (if any) should be mounted without auth.

// Protected routes (Firebase-authenticated)
app.use('/api/generate-itinerary', authMiddleware, dnaRouter);

// TODO: Standardize and protect the remaining routes with Firebase auth
app.use('/api/destinations', authMiddleware, destinationsRouter);
app.use('/api/suggest', authMiddleware, suggestRouter);
app.use('/api/chat', authMiddleware, chatRouter);
app.use('/api/journeys', journeysRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));

