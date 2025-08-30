import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import itineraryRouter from './routes/itinerary.js';
import suggestRouter from './routes/suggest.js';

dotenv.config();

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// API routes
app.use('/api/itinerary', itineraryRouter);
app.use('/api/suggest', suggestRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));

