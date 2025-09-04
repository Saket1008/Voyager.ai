
import { generateChat } from '../src/services/ai.js';

async function runSmokeTest() {
  console.log('🚀 Starting backend smoke test...');

  try {
    const payload = {
      message: 'Hello',
      stage: 'greeting',
      user: { uid: 'test-user', displayName: 'Test User' },
      state: {},
    };

    console.log('▶️  Calling generateChat with initial greeting payload...');
    const response = await generateChat(payload);

    if (!response || !response.reply) {
      throw new Error('Test failed: Invalid or empty response from generateChat.');
    }

    if (typeof response.reply !== 'string' || response.reply.length === 0) {
        throw new Error('Test failed: Response reply is not a non-empty string.');
    }

    console.log('✅  Received a valid response from the backend.');
    console.log('---');
    console.log('Backend Response:', JSON.stringify(response, null, 2));
    console.log('---');
    console.log('🎉 Smoke test passed!');
    process.exit(0);
  } catch (error) {
    console.error('🔥 Smoke test failed:', error.message);
    process.exit(1);
  }
}

runSmokeTest();
