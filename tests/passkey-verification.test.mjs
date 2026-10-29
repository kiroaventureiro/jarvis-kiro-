import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";
const source = readFileSync("lib/passkey-verify.ts", "utf8");
test("registration requires verified response and expected relying party", () => {
  assert.match(source, /verifyRegistrationResponse/);
  assert.match(source, /expectedChallenge: challengeFromServer/);
  assert.match(source, /expectedOrigin: origin/);
  assert.match(source, /expectedRPID: rpID/);
  assert.match(source, /requireUserVerification: true/);
});
test("authentication binds response to stored credential", () => {
  assert.match(source, /response\.id !== storedCredential\.id/);
  assert.match(source, /credential: storedCredential/);
  assert.match(source, /verifyAuthenticationResponse/);
  assert.match(source, /authenticationInfo\.newCounter/);
});
