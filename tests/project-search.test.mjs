import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const code=readFileSync("app/api/director/project-search/route.ts","utf8");
test("project search checks owner authentication and read-only credential",()=>{
 assert.match(code,/await authorized\(\)/);
 assert.match(code,/GITHUB_READ_TOKEN/);
 assert.match(code,/REPO_PATTERN\.test\(repo\)/);
 assert.match(code,/encodeURIComponent/);
});
test("live GitHub results do not masquerade as verified memory",()=>{
 assert.match(code,/source:"github_live"/);
 assert.match(code,/curatedMemory:lookupJarvisMemory/);
 assert.match(code,/não sincronização ao vivo/);
 assert.doesNotMatch(code,/method:\s*["'](?:POST|PATCH|PUT|DELETE)/);
});
