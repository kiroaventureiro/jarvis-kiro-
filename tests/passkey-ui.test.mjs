import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
const file=(p)=>readFileSync(p,"utf8");
test("device access UI remains available in settings",()=>{
  assert.match(file("app/configuracoes/page.tsx"),/import DeviceAccess from "\.\.\/components\/DeviceAccess"/);
  assert.match(file("app/configuracoes/page.tsx"),/<DeviceAccess\s*\/>/);
});
test("passkey UI uses server verification rather than local trust",()=>{
  const component=file("app/components/DeviceAccess.tsx");
  assert.match(component,/startAuthentication/);
  assert.match(component,/startRegistration/);
  assert.match(component,/\/api\/passkeys\/login\/verify/);
  assert.match(component,/\/api\/passkeys\/register\/verify/);
  assert.doesNotMatch(component,/localStorage|sessionStorage/);
});
