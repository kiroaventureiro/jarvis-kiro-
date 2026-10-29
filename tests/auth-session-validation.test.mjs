import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

const exports = {};
const secret = 'audit-session-fixture-only-2026-32-characters';
const code = ts.transpileModule(fs.readFileSync('lib/auth.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, { exports, Buffer, Date, process: { env: { JARVIS_SESSION_SECRET: secret } }, require: id => {
  if (id === 'node:crypto') return crypto;
  if (id === 'next/headers') return {};
  throw Error(id);
}});
const sign = expiry => expiry + '.' + crypto.createHmac('sha256', secret).update(expiry).digest('hex');

test('session validation rejects malformed signatures without throwing, including Unicode byte mismatch', () => {
  const expiry = String(Date.now() + 60000);
  for (const value of [undefined, '', expiry + '.' + 'é'.repeat(64), expiry + '.' + 'z'.repeat(64), sign(expiry) + '.extra', sign('99999999999999999'), sign(String(Date.now() - 1000))]) {
    assert.doesNotThrow(() => exports.valid(value));
    assert.equal(exports.valid(value), false);
  }
  assert.equal(exports.valid(sign(expiry)), true);
  assert.equal(exports.valid(exports.session()), true);
});
