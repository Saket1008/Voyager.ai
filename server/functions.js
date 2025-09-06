import { onRequest } from 'firebase-functions/v2/https';
import { buildApp } from './src/app.js';

const app = buildApp();

export const api = onRequest({
  region: 'us-central1',
  cors: [/https?:\/\/[^\/]+\.(web\.app|firebaseapp\.com)$/, /https?:\/\/localhost(:\d+)?$/],
  secrets: ['GEMINI_API_KEY']
}, app);