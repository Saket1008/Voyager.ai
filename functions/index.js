import { onRequest } from 'firebase-functions/v2/https';
import { buildApp } from '../server/src/app.js';

// Build the Express app once
const app = buildApp();

export const api = onRequest({
  region: 'us-central1',
  cors: [/https?:\/\/[^/]+\.(web\.app|firebaseapp\.com)$/, /https?:\/\/localhost(:\d+)?$/]
}, app);