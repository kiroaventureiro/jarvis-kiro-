import test from "node:test";import assert from "node:assert/strict";import{readFileSync}from"node:fs";
const ui=readFileSync("app/components/MemorySyncSettings.tsx","utf8");
const settings=readFileSync("app/configuracoes/page.tsx","utf8");
test("manual memory sync requires actions and confirmations",()=>{
 assert.match(ui,/onClick=\{inspect\}/);
 assert.match(ui,/window\.confirm/);
 assert.match(ui,/historyConsent\(\)/);
 assert.match(ui,/send\("PUT"/);
 assert.match(ui,/send\("DELETE"\)/);
 assert.match(ui,/send\("GET"\)/);
 assert.match(settings,/<MemorySyncSettings/);
});
test("memory settings neither store secrets nor synchronize automatically",()=>{
 assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY|JARVIS_MEMORY_ENCRYPTION_KEY/);
 assert.doesNotMatch(ui,/useEffect/);
});
