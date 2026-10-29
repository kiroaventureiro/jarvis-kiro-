import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
test("Codex approval is tied to a recently drafted task and explicit conversation",()=>{
 assert.match(ui,/pendingCodexApproval/);
 assert.match(ui,/setPendingCodexApproval\(data\.task\.id\)/);
 assert.match(ui,/\["sim, autorizo","sim autorizo","autorizo esta tarefa"\]/);
 assert.match(ui,/confirmation:"autorizo esta tarefa"/);
 assert.match(ui,/data\.started!==false\|\|data\.queued!==false/);
 assert.match(ui,/await conversationalCodexApproval\(spoken\)/);
 assert.match(ui,/await conversationalCodexApproval\(text\)/);
});
