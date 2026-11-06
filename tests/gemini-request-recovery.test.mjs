import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let callbacks, audio, command, states, replies, responses, calls, connections;
let source=ts.transpileModule(fs.readFileSync('lib/voice/gemini-live-adapter.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
// Inject the SDK/audio boundaries, exercising the real adapter state machine.
globalThis.__recovery={connect:c=>{callbacks=c;connections++;},respond:r=>responses.push(r),audio:a=>{audio=a;}};
source=source.replace(/import[^;]+from "@google\/genai";/,
 `const GoogleGenAI=class { live={connect:async ({callbacks})=>{globalThis.__recovery.connect(callbacks);return {close(){},sendRealtimeInput(){},sendClientContent(){},sendToolResponse(r){globalThis.__recovery.respond(r);}};}};};`)
 .replace(/import[^;]+from "\.\/gemini-audio";/,
 `const GeminiAudio=class {constructor(){globalThis.__recovery.audio(this);} unlockPlayback(){} async start(){} pauseCapture(){} interrupt(){} close(){this.closed=true;} volume(){} play(data){(this.played??=[]).push(data);} };`)
 .replace(/import[^;]+from "\.\/gemini-config";/,'const GEMINI_JARVIS_TOOL="jarvis_conversation";');
const {GeminiLiveVoiceAdapter}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,160));
async function setup(t){
 states=[];replies=[];responses=[];calls=[];connections=0;
 command=async()=>{throw new Error('Origem não autorizada: private diagnostic');};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({token:'test-only',model:'test-model',newSessionExpiresAt:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString()})});
 const adapter=new GeminiLiveVoiceAdapter({command:(text,signal)=>{calls.push({text,signal});return command(text,signal);},onUser(){},onReply:r=>replies.push(r),onState:s=>states.push(s),onSpeechUnavailable(){},volume:()=>1,desktopAudioAllowed:()=>true,navigate(){}});
 t.after(()=>{adapter.stop();globalThis.fetch=originalFetch;});
 adapter.start();await tick();return adapter;
}
function turn(id,text){
 callbacks.onmessage({serverContent:{inputTranscription:{text,finished:true}}});
 callbacks.onmessage({toolCall:{functionCalls:[{id,name:'jarvis_conversation',args:{}}]}});
}

test('a rejected core request finishes the tool call and preserves voice for the next turn',async t=>{
 await setup(t);
 turn('failed-turn','Consulta de teste');await tick();
 assert.equal(calls.length,1,'never automatically retry a potentially side-effecting request');
 assert.equal(audio.closed,undefined);
 assert.equal(states.at(-1).connected,true);
 assert.equal(connections,1);
 assert.equal(responses[0].functionResponses[0].id,'failed-turn');
 assert.match(replies[0].text,/Nenhuma execução foi confirmada/);
 assert.doesNotMatch(JSON.stringify(responses),/private diagnostic/);
 callbacks.onmessage({serverContent:{modelTurn:{parts:[{inlineData:{mimeType:'audio/pcm',data:'failure-notice-audio'}}]}}});
 assert.deepEqual(audio.played,['failure-notice-audio']);
 audio.onDrained();
 assert.equal(states.at(-1).phase,'waiting');
 command=async()=>({text:'Resposta confirmada'});
 turn('next-turn','Outra pergunta');await tick();
 assert.equal(calls.length,2);
 assert.equal(responses.at(-1).functionResponses[0].response.text,'Resposta confirmada');
 assert.equal(connections,1);
});

test('an interrupted failing request cannot answer over a newer turn',async t=>{
 await setup(t);let reject;
 command=()=>new Promise((_resolve,r)=>{reject=r;});
 turn('old-turn','Pergunta interrompida');await tick();
 callbacks.onmessage({serverContent:{interrupted:true}});
 assert.equal(calls[0].signal.aborted,true);
 reject(new Error('late failure'));await tick();
 assert.equal(responses.length,0);
 assert.equal(replies.length,0);
 assert.equal(states.at(-1).connected,true);
 command=async()=>({text:'Nova resposta'});
 turn('new-turn','Pergunta nova');await tick();
 assert.equal(responses[0].functionResponses[0].id,'new-turn');
});

test('stopping during a pending failed request never revives the microphone or socket',async t=>{
 const adapter=await setup(t);let reject;
 command=()=>new Promise((_resolve,r)=>{reject=r;});
 turn('stopped-turn','Pergunta');await tick();adapter.stop();
 reject(new Error('late failure'));await tick();
 assert.equal(responses.length,0);
 assert.equal(replies.length,0);
 assert.equal(states.at(-1).connected,false);
 assert.equal(connections,1);
});
