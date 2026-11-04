import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('app/api/orchestration/hml/route.ts', 'utf8');
assert.match(source, /import \{ authorized \} from "@\/lib\/auth"/);
const compiled = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function invoke({ auth = true, origin = 'https://jarvis.example', url = 'https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/commands', body = '{}', upstream = '{"accepted":true,"persisted":true}', upstreamStatus = 202 } = {}) {
  const exports = {};
  const calls = [];
  const fetch = async (...args) => { calls.push(args); return new Response(upstream, { status: upstreamStatus }); };
  const process = { env: { JARVIS_HML_INGRESS_URL: url, JARVIS_HML_INGRESS_KEY: 'x'.repeat(32) } };
  new Function('exports', 'NextResponse', 'authorized', 'fetch', 'process', compiled)(
    exports, { json: (data, options) => Response.json(data, options) }, async () => auth, fetch, process,
  );
  const response = await exports.POST(new Request('https://jarvis.example/api/orchestration/hml', {
    method: 'POST', headers: { origin }, body,
  }));
  return { response, data: await response.json(), calls };
}

test('HML denies unauthenticated and cross-origin requests before transport', async () => {
  for (const options of [{ auth: false }, { origin: 'https://other.example' }]) {
    const result = await invoke(options);
    assert.ok([401, 403].includes(result.response.status));
    assert.equal(result.calls.length, 0);
  }
});
test('HML rejects test webhook URLs, unknown destinations and oversized input', async () => {
  for (const url of ['https://evil.example/webhook/jk-hml/v1/commands', 'https://n8n.guardioesdaorigem.com.br/webhook-test/jk-hml/v1/commands']) {
    const result = await invoke({ url });
    assert.equal(result.response.status, 503);
    assert.equal(result.calls.length, 0);
  }
  assert.equal((await invoke({ body: JSON.stringify({ text: 'x'.repeat(32768) }) })).response.status, 413);
});
test('HML forwards credentials only upstream and preserves the receipt', async () => {
  const { response, data, calls } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(data.status, 202);
  assert.equal(data.result.persisted, true);
  assert.equal(calls[0][1].headers['X-Jarvis-Key'], 'x'.repeat(32));
  assert.equal(calls[0][1].redirect, 'error');
  assert.ok(!JSON.stringify(data).includes('x'.repeat(32)));
});
test('HML never reports an empty, malformed or failed upstream response as accepted', async () => {
  for (const upstream of ['', '<html>login</html>', 'null', '[]']) {
    const { response, data } = await invoke({ upstream });
    assert.equal(response.status, 502);
    assert.equal(data.acceptedByIngress, false);
  }
  const { response, data } = await invoke({ upstream: '{"error":"denied"}', upstreamStatus: 401 });
  assert.equal(response.status, 502);
  assert.equal(data.acceptedByIngress, false);
});
