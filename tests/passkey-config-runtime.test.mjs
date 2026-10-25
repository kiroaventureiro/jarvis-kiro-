import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/passkey-config.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = {exports:{}};
vm.runInNewContext(compiled, {module,exports:module.exports,process,URL,Error});
const {getPasskeyConfig} = module.exports;

test("accepts the exact HTTPS origin and its RP ID", ()=>{
  const c=getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"https://jarvis.example.com",JARVIS_WEBAUTHN_RP_ID:"jarvis.example.com"});
  assert.equal(c.rpID,"jarvis.example.com");
});
test("permits parent RP domain for a trusted subdomain",()=>{
  assert.equal(getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"https://jarvis.example.com",JARVIS_WEBAUTHN_RP_ID:"example.com"}).rpID,"example.com");
});
test("rejects HTTP in production",()=>{
  assert.throws(()=>getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"http://jarvis.example.com",JARVIS_WEBAUTHN_RP_ID:"jarvis.example.com"}),/HTTPS/);
});
test("rejects spoofed suffix domain",()=>{
  assert.throws(()=>getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"https://jarvis-example.com",JARVIS_WEBAUTHN_RP_ID:"example.com"}),/RP ID/);
});
test("rejects RP ID from unrelated website",()=>{
  assert.throws(()=>getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"https://jarvis.example.com",JARVIS_WEBAUTHN_RP_ID:"attacker.net"}),/RP ID/);
});
test("rejects URL path or credentials",()=>{
  assert.throws(()=>getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"https://jarvis.example.com/other",JARVIS_WEBAUTHN_RP_ID:"jarvis.example.com"}),/Invalid/);
});
test("accepts HTTP localhost for local development",()=>{
  assert.equal(getPasskeyConfig({JARVIS_WEBAUTHN_ORIGIN:"http://localhost:3000",JARVIS_WEBAUTHN_RP_ID:"localhost"}).rpID,"localhost");
});
