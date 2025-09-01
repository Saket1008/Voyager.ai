// Cross-platform port killer for predev. Always exits 0.
// Uses kill-port programmatically to avoid shell-operator differences.
/* eslint-disable no-console */
const killPort = require('kill-port');

async function killSafe(port) {
  try {
    await killPort(port);
    console.log(`Port ${port} cleared`);
  } catch (e) {
    console.log(`Port ${port} not in use or could not be cleared. Continuing.`);
  }
}

(async () => {
  await Promise.all([killSafe(5000), killSafe(5173)]);
  process.exit(0);
})();
