import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceCheck } from '../scripts/jarvis-maintenance.mjs';

const audit = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
test('maintenance runs only fixed checks and reports no scheduler or self-modification', async () => {
  const calls = [];
  const result = await maintenanceCheck(async args => { calls.push(args); return { code: 0, stdout: audit }; });
  assert.equal(result.healthy, true);
  assert.deepEqual(calls, [['audit', '--omit=dev', '--json'], ['test'], ['exec', '--no', '--', 'tsc', '--noEmit', '--incremental', 'false']]);
  assert.equal(result.schedulerActive, false);
  assert.equal(result.automaticCodeChanges, false);
  assert.equal(result.knowledgeUpdates, false);
});
test('network errors and failed tests remain failures while independent checks still run', async () => {
  let calls = 0;
  const result = await maintenanceCheck(async () => { calls++; return calls === 1 ? { code: 1, stdout: '{}' } : { code: 1 }; });
  assert.equal(calls, 3);
  assert.equal(result.healthy, false);
  assert.equal(result.checks[0].failure, 'INVALID_AUDIT_RESULT');
  assert.equal(result.checks[1].passed, false);
});
