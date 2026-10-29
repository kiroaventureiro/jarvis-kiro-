const {chromium}=require('playwright'),{WebSocketServer}=require('next/dist/compiled/ws'),{createHash}=require('node:crypto'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),ts=require('typescript');
const password='fixture-only-obs-password',salt='test-salt',challenge='test-challenge';const sha=s=>createHash('sha256').update(s).digest('base64');
(async()=>{
 const server=new WebSocketServer({host:'127.0.0.1',port:4455});await new Promise(resolve=>server.once('listening',resolve));
 const frames=[],origins=[];const errors=[];
 server.on('connection',(socket,request)=>{
  origins.push(request.headers.origin);let identified=false;
  socket.send(JSON.stringify({op:0,d:{rpcVersion:1,authentication:{salt,challenge}}}));
  socket.on('message',raw=>{
   const packet=JSON.parse(raw);frames.push(packet);
   if(packet.op===1){if(packet.d.authentication!==sha(sha(password+salt)+challenge))return socket.close(4009);identified=true;socket.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}}));return;}
   if(!identified||packet.op!==6)return socket.close(4003);
   const response={GetVersion:{obsVersion:'31.1.0',obsWebSocketVersion:'5.6.0'},GetSceneList:{currentProgramSceneName:'KIRO TV ao vivo',scenes:[{sceneName:'KIRO TV ao vivo'},{sceneName:'Intervalo'}]},GetStreamStatus:{outputActive:false},GetRecordStatus:{outputActive:true}}[packet.d.requestType];
   if(!response)return socket.close(4007);
   socket.send(JSON.stringify({op:7,d:{requestId:packet.d.requestId,requestType:packet.d.requestType,requestStatus:{result:true,code:100},responseData:response}}));
  });
 });
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  await fs.mkdir('/tmp/jarvis-obs-evidence',{recursive:true});
  // Verify real browser WebSocket traffic from a secure origin, with default browser security.
  const secure=await browser.newContext();const page=await secure.newPage();page.on('console',event=>{if(event.type()==='error')console.log('SECURE_BROWSER_ERROR',event.text())});
  await page.route('https://jarvis-obs.test/**',r=>r.fulfill({contentType:'text/html',body:'<button id="connect">Consultar</button><output id="status"></output>'}));
  await page.goto('https://jarvis-obs.test/');
  await secure.grantPermissions(['local-network-access'],{origin:'https://jarvis-obs.test'});

  const source=ts.transpileModule(await fs.readFile('lib/obs/local-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  await page.addScriptTag({content:'window.exports={};\n'+source});
  await page.evaluate(pwd=>{document.getElementById('connect').onclick=async()=>{try{window.__result=await window.exports.inspectLocalObs({port:4455,password:pwd});document.getElementById('status').textContent='verified'}catch(e){document.getElementById('status').textContent=e.code||'failed'}}},password);
  await page.locator('#connect').click();await page.waitForFunction(()=>document.getElementById('status').textContent!=='');
  const status=await page.locator('#status').textContent();assert.equal(status,'verified','HTTPS → loopback must pass without disabling browser protections');
  assert.equal((await page.evaluate(()=>window.__result)).currentScene,'KIRO TV ao vivo');console.log(JSON.stringify({secureOrigin:true,realWebSocket:true,authenticated:true,passed:true}));await secure.close();
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),ui=await context.newPage();ui.on('pageerror',e=>errors.push(e.message));const posts=[];ui.on('request',r=>{if(r.method()==='POST')posts.push(r.postData()||'')});
   await ui.route('**/api/**',r=>r.fulfill({status:401,json:{error:'Fixture without private accounts'}}));
   const frameCount=frames.length;
   await ui.goto('http://127.0.0.1:3147/conexoes');
   const panel=ui.getByRole('region',{name:'OBS Kiro TV local'});await panel.waitFor();assert.equal(frames.length,frameCount,'no OBS network connection before user gesture');
   await panel.getByLabel('Senha WebSocket do OBS',{exact:true}).fill(password);
   await panel.getByRole('button',{name:'Verificar OBS local',exact:true}).click();
   await panel.getByText(/Leitura confirmada em/).waitFor();
   assert.equal(await panel.getByLabel('Senha WebSocket do OBS',{exact:true}).inputValue(),'');
   assert.match(await panel.textContent(),/KIRO TV ao vivo/);assert.deepEqual(posts,[]);
   assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await panel.screenshot({path:'/tmp/jarvis-obs-evidence/obs-'+width+'.png'});
   console.log(JSON.stringify({width,passed:true,passwordCleared:true,noServerPost:true,realWebSocket:true}));await context.close();
  }
  assert.equal(JSON.stringify(frames).includes(password),false);
  assert.ok(frames.every(p=>p.op===1||p.op===6&&['GetVersion','GetSceneList','GetStreamStatus','GetRecordStatus'].includes(p.d.requestType)));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();for(const socket of server.clients)socket.terminate();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
