import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// Import routers AFTER env is loaded so downstream modules see process.env
const { default: itineraryRouter } = await import('./routes/itinerary.js');
const { default: suggestRouter } = await import('./routes/suggest.js');
const { default: chatRouter } = await import('./routes/chat.js');
const { default: dnaRouter } = await import('./routes/dna.js');

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

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// API routes
app.use('/api/itinerary', itineraryRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/chat', chatRouter);
app.use('/api/generate-itinerary', dnaRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));

