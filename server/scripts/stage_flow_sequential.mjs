import { generateChat, STAGES } from '../src/services/ai.js';

async function run() {
  let stage = STAGES.greeting;
  let state = {};
  let message = '';

  const step = async (label, msg, overrideStage) => {
    const s = overrideStage || stage;
    const res = await generateChat({ stage: s, message: msg, state });
    console.log(`\n[${label}] stage=${s} -> reply='${String(res.reply).slice(0,80)}...' next=${res.stageNext} input=${res.input?.type} options=${(res.quickOptions||[]).length}`);
    stage = res.stageNext || s;
    return res;
  };

  await step('greeting', '');
  // choose region path
  let res = await step('intent-choice', 'I only know a region', STAGES.ask_intent);
  stage = res.stageNext || STAGES.input_region;

  // Provide region and get duration question
  state.region = 'India';
  res = await step('input_region', 'India', stage);
  stage = STAGES.ask_duration;

  // Provide days
  state.durationDays = 7;
  res = await step('ask_duration', '7', stage);
  stage = STAGES.ask_dates;

  // Provide dates
  state.startDate = '2025-10-01';
  state.endDate = '2025-10-07';
  res = await step('ask_dates', 'start: 2025-10-01 end: 2025-10-07', stage);
  stage = res.stageNext || STAGES.ask_travelers;

  // Travelers
  state.travelers = 'A Group of Friends';
  res = await step('ask_travelers', 'A Group of Friends', stage);
  stage = res.stageNext || STAGES.ask_pace;

  // Pace
  state.pace = 'Balanced';
  res = await step('ask_pace', 'Balanced', stage);
  stage = res.stageNext || STAGES.ask_interests;

  // Interests
  state.interests = ['History & Museums','Food & Local Cuisine'];
  res = await step('ask_interests', 'History & Museums, Food & Local Cuisine', stage);
  stage = res.stageNext || STAGES.ask_budget;

  // Budget
  state.budget = 'Mid-Range';
  res = await step('ask_budget', 'Mid-Range', stage);
  stage = STAGES.must_haves;

  // Must haves
  res = await step('must_haves', 'Taj Mahal, backwaters', stage);
  stage = STAGES.must_nots;

  // Must nots
  res = await step('must_nots', 'Avoid seafood and tight schedules', stage);
  stage = STAGES.generate_suggestions;

  // Generate
  res = await step('generate', 'Generate itinerary', stage);
}

run().catch(err => {
  console.error('Sequential test failed:', err);
  process.exit(1);
});
