import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const contracts=fs.readFileSync("lib/connector-contracts.ts","utf8");
const route=fs.readFileSync("app/api/director/connector-plan/route.ts","utf8");
test("catalog declares all proposed connector families",()=>{
 for(const name of ["google","microsoft","n8n","windows_agent","youtube","instagram","tiktok"])
  assert.match(contracts,new RegExp("^ "+name+": \\{","m"));
});
test("new connector route is owner protected and does not access third parties",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:401/);
 assert.doesNotMatch(route,/fetch\(/);
 assert.match(route,/no-store/);
});
test("planned connectors cannot claim connected or verified status",()=>{
 assert.match(contracts,/implemented:false,connected:false,verified:false/);
 assert.match(contracts,/requiredApprovals/);
});
