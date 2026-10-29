import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const plan=JSON.parse(fs.readFileSync("config/kiro-ecosystem-inventory.json","utf8"));
const route=fs.readFileSync("app/api/director/ecosystem/route.ts","utf8");
test("ecosystem includes creator platforms and no implicit authorization",()=>{
 const names=plan.services.map(s=>s.name);
 for(const name of ["Suno","LIVEPX","CapCut","Canva","Grok","Hostinger","Apple/iCloud"])
  assert.ok(names.includes(name),name);
 for(const s of plan.services){assert.equal(s.status,"planned_not_connected");assert.equal(s.automaticWrites,false);}
});
test("inventory remains private to authorized session",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:401/);
 assert.match(route,/liveAccess:false/);
 assert.doesNotMatch(route,/fetch\(/);
});
