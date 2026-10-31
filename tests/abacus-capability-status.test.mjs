import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../lib/abacus/capability-status.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, require);
const { capabilityStage, buildAbacusCapabilityReport, canUseAbacusCapability } = module.exports;

const evidence = (overrides = {}) => ({
  documented: true,
  authorized: false,
  apiAvailable: false,
  verified: false,
  ...overrides,
});

test("undocumented or absent evidence stays unknown", () => {
  assert.equal(capabilityStage(), "unknown");
  assert.equal(capabilityStage(evidence({ documented: false })), "unknown");
});

test("documentation alone never authorizes Abacus capabilities", () => {
  assert.equal(capabilityStage(evidence()), "documented");
  for (const result of Object.values(buildAbacusCapabilityReport())) {
    assert.equal(result.stage, "unknown");
  }
});

test("authentication and API verification progress through distinct stages", () => {
  assert.equal(capabilityStage(evidence({ authorized: true })), "authorized");
  assert.equal(capabilityStage(evidence({ authorized: true, apiAvailable: true })), "api_available");
  assert.equal(capabilityStage(evidence({ authorized: true, apiAvailable: true, verified: true })), "verified");
});

test("inconsistent verified claims are downgraded", () => {
  assert.equal(capabilityStage(evidence({ verified: true })), "documented");
  assert.equal(capabilityStage(evidence({ apiAvailable: true, verified: true })), "documented");
  assert.equal(capabilityStage(evidence({ authorized: true, verified: true })), "authorized");
});

test("report limits evidence to named capabilities", () => {
  const report = buildAbacusCapabilityReport({
    chat_streaming: evidence({ authorized: true, apiAvailable: true }),
  });
  assert.equal(Object.keys(report).length, 5);
  assert.equal(report.chat_streaming.stage, "api_available");
  assert.equal(report.agent_execution.stage, "unknown");
});

test("unverified or only authorized capabilities cannot execute", () => {
  const denied = buildAbacusCapabilityReport({
    agent_execution: evidence({ authorized: true, apiAvailable: true }),
  });
  assert.equal(canUseAbacusCapability(denied, "agent_execution"), false);
  assert.equal(canUseAbacusCapability(denied, "connected_tools"), false);
  const granted = buildAbacusCapabilityReport({
    agent_execution: evidence({ authorized: true, apiAvailable: true, verified: true, checkedAt: new Date().toISOString() }),
  });
  assert.equal(canUseAbacusCapability(granted, "agent_execution"), true);
  assert.equal(canUseAbacusCapability(granted, "connected_tools"), false);
});

test("execution blocks stale, future, or missing verification time", () => {
  const now = 1793408400000;
  const verified = (checkedAt) => buildAbacusCapabilityReport({
    agent_execution: evidence({ authorized: true, apiAvailable: true, verified: true, checkedAt }),
  });
  assert.equal(canUseAbacusCapability(verified(undefined), "agent_execution", now), false);
  assert.equal(canUseAbacusCapability(verified("not-a-date"), "agent_execution", now), false);
  assert.equal(canUseAbacusCapability(verified(new Date(now - 16 * 60 * 1000).toISOString()), "agent_execution", now), false);
  assert.equal(canUseAbacusCapability(verified(new Date(now + 1000).toISOString()), "agent_execution", now), false);
  assert.equal(canUseAbacusCapability(verified(new Date(now - 60 * 1000).toISOString()), "agent_execution", now), true);
});
