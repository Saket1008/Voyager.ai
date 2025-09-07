// server/src/index.js

// In local dev we load .env.local; on Functions we rely on env/Secrets
try {
  if (process.env.FUNCTION_TARGET == null) {
    const dotenv = await import('dotenv');
    const res = dotenv.config({ path: new URL('../.env.local', import.meta.url) });
    if (res.error) console.warn('[EnvCheck] dotenv .env.local not loaded:', res.error.message);
  }
} catch {}

import { buildApp } from './app.js';
const app = buildApp();


const port = process.env.PORT || 5000;
// Debug: show whether GEMINI_API_KEY loaded (without leaking full key)
const gKey = process.env.GEMINI_API_KEY;
console.log('[EnvCheck] GEMINI_API_KEY present:', gKey ? `yes (length=${gKey.length})` : 'no');
console.log('[EnvCheck] GEMINI_MODEL:', process.env.GEMINI_MODEL || 'default');
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));