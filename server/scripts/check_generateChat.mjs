import { generateChat, STAGES } from '../src/services/ai.js';

async function checkStage(stage) {
  try {
    console.log(`\n--- Testing stage: ${stage} ---`);
    const res = await generateChat({ stage, message: '', user: null, state: {} });
    const keys = ['reply', 'stageNext', 'input', 'quickOptions', 'hints'];
    for (const k of keys) {
      console.log(k, typeof res[k] === 'undefined' ? 'MISSING' : Array.isArray(res[k]) ? `array(${res[k].length})` : typeof res[k]);
    }
    console.log('reply (trim):', String(res.reply || '').slice(0, 120));
    console.log('input.type:', res.input?.type);
    console.log('quickOptions length:', Array.isArray(res.quickOptions) ? res.quickOptions.length : 'not-array');
  } catch (err) {
    console.error('Error checking stage', stage, err?.message || err);
  }
}

async function run() {
  const tests = [STAGES.greeting, STAGES.ask_intent, STAGES.input_locations, STAGES.ask_duration, STAGES.generate_suggestions];
  for (const s of tests) await checkStage(s);
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
