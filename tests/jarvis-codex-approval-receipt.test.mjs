import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../lib/codex/approval-receipt.ts",import.meta.url),"utf8");
test("Receipt authorization requires server signing, short expiry and fixed development scope",()=>{
 assert.match(code,/createHmac\("sha256"/);
 assert.match(code,/timingSafeEqual/);
 assert.match(code,/secret\.length<32/);
 assert.match(code,/r\.expiresAt-r\.approvedAt<=300000/);
 assert.match(code,/r\.branch==="feature\/diretor-tecnico-agent"/);
 assert.doesNotMatch(code,/execSync|spawn\(/);
});
