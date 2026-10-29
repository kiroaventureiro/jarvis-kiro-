import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const panel=readFileSync(new URL("../components/jarvis-result-panel.tsx",import.meta.url),"utf8");
test("Jarvis result panel renders source, status, messages and safe links",()=>{
 assert.match(panel,/jarvisResultView\(result\)/);
 assert.match(panel,/data-result-status/);
 assert.match(panel,/view\.messages\.map/);
 assert.match(panel,/view\.artifacts\.map/);
 assert.match(panel,/rel="noopener noreferrer"/);
 assert.doesNotMatch(panel,/dangerouslySetInnerHTML|eval\(/);
});
