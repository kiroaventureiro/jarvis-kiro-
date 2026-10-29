import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync('lib/request-origin.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {requestOriginAllowed: allowed, requestOriginStatus: status, callbackHostAllowed: callbackAllowed} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const canonical = 'https://jarvis-kiro.vercel.app';
const request = (origin, headers = {}, url = 'http://localhost:3000/api/director/connectors') => new Request(url, {method:'POST',headers:{...(origin ? {origin} : {}), ...headers}});
test('trusted public origins survive an internal proxy URL; forwarded headers grant no trust', () => {
  const r = request(canonical, {'sec-fetch-site':'same-origin',host:'jarvis-kiro.vercel.app','x-forwarded-host':'jarvis-kiro.vercel.app','x-forwarded-proto':'https'});
  assert.notEqual(r.headers.get('origin'), new URL(r.url).origin, 'reproduces the old rejection condition');
  assert.equal(allowed(r,canonical), true);
  assert.equal(status(r,canonical).proxyUrlDiffers, true);
  assert.equal(allowed(request('https://jarvis-kiro-umiversokiro.vercel.app'),canonical), true);
  assert.equal(allowed(request('https://evil.example', {'x-forwarded-host':'jarvis-kiro.vercel.app',host:'jarvis-kiro.vercel.app'}),canonical),false);
});
test('CSRF still rejects missing, null, cross-site, malformed and lookalike origins', () => {
  for (const value of [undefined,'null','https://evil.example','https://jarvis-kiro.vercel.app.evil.example',canonical+'/',canonical+',https://evil.example','http://jarvis-kiro.vercel.app']) assert.equal(allowed(request(value),canonical),false,value);
  assert.equal(allowed(request(canonical,{'sec-fetch-site':'cross-site'}),canonical),false);
  assert.equal(allowed(request(canonical),'https://invalid.example/path'),false);
});
test('legacy non-browser mode preserves its prior contract; configured canonical stays authoritative', () => {
  assert.equal(allowed(request(),canonical,false),true);
  assert.equal(allowed(request(undefined,{'sec-fetch-site':'cross-site'}),canonical,false),false);
  assert.equal(allowed(request('http://127.0.0.1:3147',{},'http://127.0.0.1:3147/api')),true);
  assert.equal(allowed(request('https://untrusted-preview.vercel.app'),canonical),false);
});
test('diagnostics omit credentials, cookies, query strings and invalid forwarded header content', () => {
  const r=request(canonical,{authorization:'Bearer private-test-secret',cookie:'jarvis_session=private-test-cookie','x-forwarded-host':'bad host'},'http://localhost:3000/api?code=private-test-code');
  const result=status(r,canonical);
  assert.equal(result.forwardedHost,null);
  assert.equal(JSON.stringify(result).includes('private-test'),false);
});

test('OAuth callbacks require the configured public target and ignore forwarded-host spoofing',()=>{
 assert.equal(callbackAllowed(request(undefined,{host:'jarvis-kiro.vercel.app','sec-fetch-site':'cross-site'}),canonical),true);
 assert.equal(callbackAllowed(request(undefined,{'x-forwarded-host':'jarvis-kiro.vercel.app'}),canonical),false);
 assert.equal(callbackAllowed(request(undefined,{},canonical+'/callback'),canonical),true);
 assert.equal(callbackAllowed(request(undefined,{host:'evil.example'}),canonical),false);
 assert.equal(callbackAllowed(request(),undefined),false);
});
