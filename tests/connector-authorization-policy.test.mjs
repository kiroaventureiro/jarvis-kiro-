import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const policy=fs.readFileSync("lib/connector-authorization-policy.ts","utf8");
const api=fs.readFileSync("app/api/director/authorization-plan/route.ts","utf8");
test("permission policy uses verified scopes and revocation",()=>{
 assert.ok(policy.includes('connection.phase==="verified"'));
 assert.ok(policy.includes("connection.scopes.includes(scope)"));
 assert.ok(policy.includes('verified:["revoked","error"]'));
 assert.ok(policy.includes("encryptedTokenVaultRequired:true"));
});
test("status API is protected and makes no OAuth activation claims",()=>{
 assert.ok(api.includes("await authorized()"));
 assert.ok(api.includes("tokenVaultReady:false"));
 assert.ok(api.includes("oauthCallbacksReady:false"));
 assert.ok(!api.includes("fetch("));
});
