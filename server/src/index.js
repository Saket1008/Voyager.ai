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

import { buildApp } from './app.js';
const app = buildApp();


const port = process.env.PORT || 5000;
// Debug: show whether GEMINI_API_KEY loaded (without leaking full key)
const gKey = process.env.GEMINI_API_KEY;
console.log('[EnvCheck] GEMINI_API_KEY present:', gKey ? `yes (length=${gKey.length})` : 'no');
console.log('[EnvCheck] GEMINI_MODEL:', process.env.GEMINI_MODEL || 'default');
app.listen(port, () => console.log(`\n🚀 Server listening on http://localhost:${port}\n`));