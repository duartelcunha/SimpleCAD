#!/usr/bin/env node
/**
 * SimpleCAD Synthetic Check Runner
 *
 * Executes local Tiers 1-4 without loading app.js or a real browser:
 * - Tier 1: Feature Coverage (8 features × 5 tests = 40 assertions)
 * - Tier 2: Boundary & Corner Cases (8 features × 5 tests = 40 assertions)
 * - Tier 3: Cross-Feature Combinations (≥8 assertions)
 * - Tier 4: Synthetic scenarios (not real app workflows)
 * Total: 93 Verification Assertions
 *
 * Usage:
 *   node tests/verify-all.js             # Runs all 93 tests
 *   node tests/verify-all.js --tier=1    # Runs Tier 1 only
 *   node tests/verify-all.js --tier=2    # Runs Tier 2 only
 *   node tests/verify-all.js --tier=3    # Runs Tier 3 only
 *   node tests/verify-all.js --tier=4    # Runs Tier 4 only
 *   node tests/verify-all.js --json      # Outputs structured JSON
 */

'use strict';

const { TestRunner } = require('./cad-test-harness');
const { registerTier1Tests } = require('./tier1-features');
const { registerTier2Tests } = require('./tier2-boundary');
const { registerTier3Tests } = require('./tier3-cross-feature');
const { registerTier4Tests } = require('./tier4-scenarios');

async function main() {
  const args = process.argv.slice(2);
  const options = {
    tier: null,
    feature: null,
    json: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--tier=')) options.tier = arg.split('=')[1];
    else if (arg.startsWith('--feature=')) options.feature = arg.split('=')[1];
  }

  if (options.help) {
    console.log(`
SimpleCAD Verification Test Harness
Usage: node tests/verify-all.js [options]

Options:
  --tier=N       Run tests for a specific Tier (1, 2, 3, or 4)
  --feature=N    Run tests for a specific Feature (1 to 8)
  --json         Output results in JSON format
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  const runner = new TestRunner();

  // Register all tiers
  registerTier1Tests(runner);
  registerTier2Tests(runner);
  registerTier3Tests(runner);
  registerTier4Tests(runner);

  // Run test suite
  const summary = await runner.run({
    tier: options.tier,
    feature: options.feature
  });

  summary.scope = 'synthetic checks; app.js is not executed; no browser or native workflow validation';

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    runner.printReport(summary);
  }

  // Proper exit code: 0 if all tests passed, 1 if any failure
  process.exit(summary.failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error running verification suite:', err);
  process.exit(1);
});
