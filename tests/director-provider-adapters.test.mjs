import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const routes = ["github-status", "vercel-status", "supabase-status"].map(
  (x) => {
    const folder = x === "github-status" ? "project-status" : x;
    return {
      name: x,
      code: fs.readFileSync("app/api/director/" + folder + "/route.ts", "utf8"),
    };
  },
);
for (const { name, code } of routes) {
  test(name + " requires authorization before external read", () => {
    assert.match(code, /await authorized\(\)/);
    assert.match(code, /status:\s*401/);
    assert.match(code, /no-store/);
    assert.doesNotMatch(code, /method:\s*["'](?:POST|PATCH|DELETE|PUT)["']/);
  });
}
test("GitHub status accepts restricted repo names", () => {
  assert.match(routes[0].code, /REPO_PATTERN\.test\(repo\)/);
  assert.match(routes[0].code, /process\.env\.GITHUB_READ_TOKEN/);
});
test("Vercel status fetches only fixed Jarvis project", () => {
  assert.match(routes[1].code, /const id="jarvis-kiro"/);
  assert.match(routes[1].code, /process\.env\.VERCEL_API_TOKEN/);
});
test("Supabase status uses canonical scoped verification without returning credentials", () => {
  assert.match(routes[2].code, /operationalRegistry\.read/);
  assert.match(routes[2].code, /supabase-memory/);
  const memory = fs.readFileSync("lib/server-memory.ts", "utf8");
  assert.match(memory, /host\.protocol\s*!==\s*["']https:/);
  assert.match(memory, /supabase/);
  assert.match(routes[2].code, /reachable:\s*operational\.verified/);
  assert.doesNotMatch(
    routes[2].code,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
  );
});
