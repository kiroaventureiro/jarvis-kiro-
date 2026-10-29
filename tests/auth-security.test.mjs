import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const file = (p) => readFileSync(join(root, p), "utf8");

test("credentials are inaccessible by default to browser roles", () => {
  const migration = file("supabase/migrations/20261025_passkeys.sql");
  assert.match(migration, /alter table public\.jarvis_passkeys enable row level security/i);
  assert.match(migration, /alter table public\.jarvis_webauthn_challenges enable row level security/i);
  assert.doesNotMatch(migration, /create policy[\s\S]+(using\s*\(\s*true\s*\)|to\s+anon)/i);
});

test("login flow requires a password until real passkey verification exists", () => {
  const route = file("app/api/auth/route.ts");
  assert.match(route, /passwordMatches\(body\.password\)/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /sameSite:\s*["']strict["']/);
});

test("private GitHub metadata endpoint requires authenticated session", () => {
  const route = file("app/api/github/route.ts");
  assert.match(route, /await authorized\(\)/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /process\.env\.GITHUB_READ_TOKEN/);
  assert.doesNotMatch(route, /process\.env\.GITHUB_WRITE_TOKEN/);
});

test("passkey storage includes expiry, revocation and single-use challenge fields", () => {
  const migration = file("supabase/migrations/20261025_passkeys.sql");
  for (const field of ["revoked_at", "expires_at", "used_at", "counter", "public_key", "credential_id"]) {
    assert.ok(migration.includes(field), `Missing: ${field}`);
  }
});
