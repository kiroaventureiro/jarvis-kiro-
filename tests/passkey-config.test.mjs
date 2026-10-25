import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const config = readFileSync("lib/passkey-config.ts", "utf8");
test("WebAuthn configuration rejects insecure remote HTTP origins", () => {
  assert.match(config, /url\.protocol !== "https:"/);
  assert.match(config, /url\.hostname === "localhost"/);
});
test("WebAuthn configuration checks RP ID against URL domain", () => {
  assert.match(config, /url\.hostname === rpID/);
  assert.match(config, /url\.hostname\.endsWith/);
});
test("No public device enrollment is exposed by this configuration module", () => {
  assert.doesNotMatch(config, /NextResponse|export async function POST/);
});
