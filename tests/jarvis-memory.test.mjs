import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const {records}=JSON.parse(fs.readFileSync("config/operational-memory.json","utf8"));
test("curated records carry provenance and uncertainty",()=>{
 assert.ok(records.length>=2);
 for(const r of records){for(const key of ["id","project","scope","source","recorded_at","confidence","summary","decision","retrieval_reference"])assert.ok(r[key],key);}
});
test("memory endpoint is guarded and does not claim live sources",()=>{
 const code=fs.readFileSync("app/api/director/memory/route.ts","utf8");
 assert.match(code,/await authorized\(\)/);assert.match(code,/liveConnectorAccess:false/);
});
