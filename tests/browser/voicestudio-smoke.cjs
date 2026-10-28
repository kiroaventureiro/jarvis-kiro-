// Self-contained loopback test: own server, fixture session, no real providers.
const cp = require('node:child_process'), fs = require('node:fs/promises'), assert = require('node:assert/strict'), {createHmac}=require('node:crypto'), {chromium}=require('playwright');
const base='http://localhost:3157', out='../../outputs/voicestudio';
const secret='jk-voicestudio-browser-fixture-only';
const server=cp.spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','localhost','-p','3157'],{cwd:process.cwd(),env:{...process.env,JARVIS_SESSION_SECRET:secret,JARVIS_VOICESTUDIO_URL:'',JARVIS_VOICESTUDIO_API_KEY:'',OPENAI_API_KEY:'',ABACUS_API_KEY:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='',browser;
const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),45000);server.stdout.on('data',d=>{log+=d;if(log.includes('Ready in')){clearTimeout(timer);resolve()}});server.stderr.on('data',d=>log+=d);server.on('exit',code=>{clearTimeout(timer);if(code)reject(Error(log))})});
(async()=>{try{
 await fs.mkdir(out,{recursive:true});await ready;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const unauthorized=await context.request.post(base+'/api/voice/studio');assert.equal(unauthorized.status(),401);
 const exp=String(Date.now()+3600000);await context.addCookies([{name:'jarvis_session',value:exp+'.'+createHmac('sha256',secret).update(exp).digest('hex'),url:base,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/configuracoes');await page.getByRole('button',{name:'Testar conexão VoiceStudio'}).click();
 await page.getByText('VoiceStudio ainda não está configurado neste ambiente do JK.',{exact:false}).waitFor();
 const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'VoiceStudio · voz local opcional'})});
 await panel.screenshot({path:out+'/settings-desktop.png'});
 for(const [endpoint,body] of [['abacus',{message:'O VoiceStudio está conectado?'}],['research',{query:'O VoiceStudio está conectado?'}]]){
 const r=await context.request.post(base+'/api/director/'+endpoint,{data:body});assert.equal(r.status(),200);const data=await r.json();assert.equal(data.model,'jk-voicestudio');assert.equal(data.studio.state,'not_configured');assert.equal(data.studio.speechVerified,false);
 }
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();
 const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);await panel.screenshot({path:out+'/settings-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: owner authentication, settings → API → unconfigured result, text routing, neural research endpoint, desktop/mobile bounds; no real provider/model calls.');
}finally{await browser?.close();server.kill();await fs.writeFile(out+'/browser-server.log',log)}})().catch(e=>{console.error(e);process.exitCode=1});
