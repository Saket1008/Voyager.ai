import { generateItineraryMarkdown } from '../src/services/ai.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load local env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const user = { displayName: 'Tester' };
  const travelProfile = { pace: 'Balanced', budget: 'Mid-Range', interests: ['Temples','History'] };
  const tripState = {
    locations: ['Palitana'],
    durationDays: 3,
    startDate: '2025-10-01',
    endDate: '2025-10-03',
    travelers: 2,
  };

  console.log('[Smoke] GEMINI_MODEL:', process.env.GEMINI_MODEL || '(default)');
  console.log('[Smoke] Calling generateItineraryMarkdown...');
  const md = await generateItineraryMarkdown({ user, travelProfile, tripState });
  console.log('\n[Smoke] Output preview (first 500 chars):\n');
  console.log(String(md).slice(0, 500));
}

run().catch((e) => {
  console.error('[Smoke] Failed:', e?.message || e);
  process.exit(1);
});
