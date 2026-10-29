import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("passkey login feature off by default",()=>{
 for(const path of ["app/api/passkeys/login/options/route.ts","app/api/passkeys/login/verify/route.ts"]){
  const src=read(path);assert.match(src,/JARVIS_PASSKEY_LOGIN_ENABLED/);assert.match(src,/status:\s*503/);assert.match(src,/headers\.get\("origin"\)/);
 }
});
test("login consumes a single-use challenge before session issuance",()=>{
 const src=read("app/api/passkeys/login/verify/route.ts");
 assert.ok(src.indexOf("consumeChallenge(") < src.indexOf("verifyKnownDevice("));
 assert.ok(src.indexOf("verifyKnownDevice(") < src.indexOf("session()"));
 assert.match(src,/advanceCounter/);assert.match(src,/httpOnly:true/);
});
test("register endpoints import the actual server modules",()=>{
 for(const path of ["app/api/passkeys/register/options/route.ts","app/api/passkeys/register/verify/route.ts"])
  assert.match(read(path),/from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\//);
});
