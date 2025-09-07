// server/src/app.js
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';

// Routes
import chatRouter from './routes/chat.js';
import suggestRouter from './routes/suggest.js';
import itineraryRouter from './routes/itinerary.js';
import journeysRouter from './routes/journeys.js';
import destinationsRouter from './routes/destinations.js';
import whoamiRouter from './routes/whoami.js';

export function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const allowedOrigins = (process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:5173']).map(s => s.trim());
  app.use(cors({
    origin: (origin, callback) => {
      try {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        const isFirebaseHosting = /https?:\/\/[^/]+\.(?:web\.app|firebaseapp\.com)$/.test(origin);
        if (isFirebaseHosting) return callback(null, true);
        const isLocalhost = /https?:\/\/localhost(?::\d+)?$/.test(origin) || /https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);
        if (isLocalhost) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      } catch (e) { return callback(new Error('CORS evaluation failed')); }
    },
    credentials: true,
  }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
  app.use('/api/', apiLimiter);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/chat', authMiddleware, chatRouter);
  app.use('/api/suggest', authMiddleware, suggestRouter);
  app.use('/api/itinerary', authMiddleware, itineraryRouter);
  app.use('/api/destinations', authMiddleware, destinationsRouter);
  app.use('/api/journeys', authMiddleware, journeysRouter);
  app.use('/api/whoami', whoamiRouter);

  return app;
}

export default buildApp;