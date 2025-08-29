import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Clerk } from '@clerk/clerk-sdk-node';
import healthRouter from './routes/health.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import itineraryRouter from './routes/itinerary.js';
import suggestRoutes from './routes/suggest.js';
import { connectToDatabase } from './config/db.js';

dotenv.config();

if (!process.env.CLERK_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Warning: CLERK_SECRET_KEY is not set. Protected routes will fail.');
}

// Initialize Clerk server-side SDK (optional for advanced usage)
export const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY || '' });

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/itinerary', itineraryRouter);
app.use('/api/suggest', suggestRoutes);

const port = process.env.PORT || 5000;

connectToDatabase(process.env.MONGODB_URI).then(() => {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
  });
});

