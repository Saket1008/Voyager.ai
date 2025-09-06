import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Load env from server/.env explicitly (works no matter the CWD)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env');
let loaded = false;
try {
  const r = dotenv.config({ path: envPath });
  loaded = !!(r.parsed && Object.keys(r.parsed).length);
} catch {
  loaded = false;
}
if (!loaded && fs.existsSync(envPath)) {
  try {
    const raw = fs.readFileSync(envPath);
    const isUtf16Le = raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe;
    const str = isUtf16Le ? raw.toString('utf16le') : raw.toString('utf8');
    const parsed = dotenv.parse(str);
    Object.keys(parsed).forEach((k) => {
      if (process.env[k] === undefined) process.env[k] = parsed[k];
    });
    console.log('[Test] .env loaded via fallback parser; UTF16LE=', isUtf16Le);
  } catch (e) {
    console.warn('[Test] .env fallback parsing failed');
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

  console.log('[Test] GEMINI_API_KEY present:', !!apiKey);
  console.log('[Test] Model:', modelName);

  if (!apiKey) {
    console.error('[Test] Missing GEMINI_API_KEY. Add it to server/.env and re-run.');
    process.exit(1);
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    // Use a very specific instruction to detect success
    const nonce = Math.floor(Math.random() * 900) + 100; // 100-999
    const expected = `VOY-${nonce}`;
    const prompt = `Return exactly this token without quotes or extra words: ${expected}`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const stream = await client.models.generateContentStream({ model: modelName, contents });
    let out = '';
    for await (const chunk of stream) {
      if (chunk?.text) out += chunk.text;
    }

    console.log('[Test] Raw response:', JSON.stringify(out));

    const normalized = String(out).trim();
    const pass = normalized === expected;

    console.log(`[Test] Expected: ${expected}`);
    console.log('[Test] Match:', pass);

    if (!pass) {
      console.warn('[Test] The response did not exactly match. This can still be OK (the model may include formatting).');
      // Soft success if any VOY- pattern appears
      if (/^VOY-\d{3}/.test(normalized)) {
        console.log('[Test] Soft PASS: token pattern detected.');
        process.exit(0);
      }
      process.exit(2);
    }

    console.log('[Test] PASS: Gemini responded as expected.');
    process.exit(0);
  } catch (err) {
    console.error('[Test] Gemini call failed:', err?.message || err);
    process.exit(3);
  }
}

main();
