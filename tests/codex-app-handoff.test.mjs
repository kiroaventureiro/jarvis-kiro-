import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/codex/app-handoff.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {appHandoffIntent,prepareAppHandoff,JARVIS_ORIGIN}=exports;
test('Natural requests route to Codex or ChatGPT without a fixed prefix',()=>{
 for(const text of ['Jarvis, peça ao Codex para revisar o jogo Sistema Origem','Codex, revise meus testes','Envie ao Codex uma análise'])assert.equal(appHandoffIntent(text),'codex');
 for(const text of ['pergunte ao Navi sobre minha ideia','Abra o ChatGPT para ajudar no planejamento'])assert.equal(appHandoffIntent(text),'chatgpt');
 for(const text of ['Olá Jarvis','Qual o status do Codex?'])assert.equal(appHandoffIntent(text),null);
});
test('Official URL encodes Unicode and query characters; allowed origin only, no local path',()=>{
 const h=prepareAppHandoff('Revise no Codex: ação, coração & café? #jogo + 100% 😀','codex');
 const url=new URL(h.codexUrl);
 assert.equal(url.searchParams.get('prompt'),h.prompt);
 assert.equal(url.searchParams.get('originUrl'),JARVIS_ORIGIN);
 assert.equal(url.searchParams.has('path'),false);
 assert.ok(h.codexUrl.includes(encodeURIComponent('ação')));
 assert.throws(()=>prepareAppHandoff('revise','codex','https://evil.example/repo'),/INVALID_ORIGIN/);
});
test('Suspect secrets are refused, including past the truncation boundary',()=>{
 for(const secret of ['sk-1234567890secret','token=segredo','senha: segredo','Bearer segredo','-----BEGIN PRIVATE KEY-----','eyJheader.payload.signature'])assert.throws(()=>prepareAppHandoff('x'.repeat(900)+secret,'codex'),/SENSITIVE_REQUEST/);
});
test('Long and malformed Unicode inputs are bounded; web fallbacks never claim prefill',()=>{
 const h=prepareAppHandoff('😀'.repeat(10000)+'\ud800','codex');
 assert.equal(h.truncated,true);
 assert.ok(h.codexUrl.length<8000);
 assert.equal(new URL(h.codexUrl).searchParams.get('prompt'),h.prompt);
 assert.equal(h.codexWebUrl,'https://chatgpt.com/codex');
 assert.equal(h.chatgptUrl,'https://chatgpt.com/');
 assert.match(h.prompt,/não há execução iniciada/i);
});
test('UI uses native gesture links, keeps fallbacks visible and never opens a popup programmatically',()=>{
 const ui=fs.readFileSync('app/components/JarvisExperience.tsx','utf8');
 assert.match(ui,/href=\{appHandoff.codexUrl\}/);
 assert.match(ui,/conversationalAppHandoff\(text\)/);
 assert.match(ui,/conversationalAppHandoff\(spoken\)/);
 const panel=ui.slice(ui.indexOf('{appHandoff ? ('),ui.indexOf('{error ? ('));
 assert.doesNotMatch(panel,/window.open|fetch\(/);
 assert.match(panel,/Cópia automática indisponível/);
 assert.match(panel,/Se o aplicativo não abriu/);
});

test('Browser actions prepare safe search and service links without API access',()=>{
 const {browserActionIntent}=exports;
 const search=browserActionIntent('Jarvis, pesquise no Google sobre ação e café');
 assert.equal(new URL(search.url).hostname,'www.google.com');
 assert.equal(new URL(search.url).searchParams.get('q'),'ação e café');
 assert.equal(browserActionIntent('abra o navegador').url,'https://www.google.com/');
 assert.equal(browserActionIntent('abra a Microsoft').url,'https://www.microsoft365.com/');
 assert.equal(browserActionIntent('abra GitHub').url,'https://github.com/');
 assert.equal(browserActionIntent('Jarvis, entre no GitHub').url,'https://github.com/');
 assert.equal(browserActionIntent('Navi, entre no GitHub').url,'https://github.com/');
 assert.equal(browserActionIntent('Navi, abra o repositório do Jarvis no GitHub').url,'https://github.com/kiroaventureiro/jarvis-kiro-');
 assert.equal(browserActionIntent('Navi, abra a Vercel').url,'https://vercel.com/umiversokiro/jarvis-kiro');
 assert.equal(browserActionIntent('vá ao GitHub').url,'https://github.com/');
 assert.equal(browserActionIntent('abra o GitHub no navegador').url,'https://github.com/');
 assert.equal(browserActionIntent('abra o repositório do Jarvis no GitHub').url,'https://github.com/kiroaventureiro/jarvis-kiro-');
 assert.equal(browserActionIntent('qual a diferença entre GitHub e Vercel?'),null);
 assert.equal(browserActionIntent('qual o status do Google?'),null);
 assert.throws(()=>browserActionIntent('pesquise no Google token=secreto'),/SENSITIVE_REQUEST/);
 assert.equal(browserActionIntent('abra Codex para revisar'),null);
});
