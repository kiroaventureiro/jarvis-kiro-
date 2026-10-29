const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});try{
 const catalog=JSON.parse(await fs.readFile('config/connection-catalog.json','utf8'));
 await fs.mkdir('/tmp/jarvis-workspace-evidence',{recursive:true});
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__cameraRequests=0;window.__stopped=0;
   HTMLMediaElement.prototype.play=async()=>{};
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async options=>{window.__cameraRequests++;if(options.audio!==false)throw Error('Microphone forbidden');const stream=new MediaStream();stream.getTracks=()=>[{stop:()=>window.__stopped++}];return stream;}}});
  });
  let ready=false;const payloads=[];
  await page.route('**/api/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/director/connections')return route.fulfill({json:catalog});
   if(u.pathname==='/api/director/workspace-connectors'){
    if(route.request().method()==='POST'){
     const body=route.request().postDataJSON();payloads.push(body);
     if(body.op==='read')return route.fulfill({json:{checkedAt:'2026-10-29T00:00:00Z',items:[{id:'file1',name:'Roteiro Kiro'}]}});
     if(body.op==='authorize')return route.fulfill({json:{authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'}});
    }
    return route.fulfill({json:{providers:[{provider:'google',authorizationReady:ready,missing:ready?[]:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'],connected:ready,services:ready?['google-drive']:[],verifiedAt:{},callback:'https://jarvis.example/api/director/workspace-connectors/google/callback'},{provider:'microsoft',authorizationReady:false,missing:['MICROSOFT_CLIENT_ID'],connected:false,services:[],verifiedAt:{},callback:null}],services:[{id:'google-drive',provider:'google',name:'Drive · Docs · Sheets · Slides',scope:'https://www.googleapis.com/auth/drive.metadata.readonly'},{id:'gmail',provider:'google',name:'Gmail',scope:'https://www.googleapis.com/auth/gmail.metadata'}]}});
   }
   return route.fulfill({status:401,json:{error:'Sessão de teste sem credenciais reais'}});
  });
  await page.goto('http://127.0.0.1:3147/conexoes');
  const google=page.getByRole('button',{name:'Autorizar serviços selecionados no Google',exact:true});await google.waitFor();
  assert.equal(await google.isDisabled(),true);assert.equal(await page.evaluate(()=>window.__cameraRequests),0);
  await page.getByRole('button',{name:'Permitir e abrir câmera',exact:true}).click();
  await page.getByRole('button',{name:'Desligar câmera',exact:true}).waitFor();
  await page.getByRole('button',{name:'Desligar câmera',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__stopped),1);assert.deepEqual(payloads,[]);
  ready=true;await page.reload();await page.getByRole('button',{name:'Verificar e listar Drive · Docs · Sheets · Slides',exact:true}).click();
  await page.getByText('Roteiro Kiro',{exact:true}).waitFor();
  assert.deepEqual(payloads,[{op:'read',service:'google-drive'}]);
  const workspace=page.getByRole('region',{name:'Conectar Google e Microsoft'});
  await workspace.getByRole('checkbox',{name:'Gmail',exact:true}).check();assert.equal(await google.isEnabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await workspace.screenshot({path:'/tmp/jarvis-workspace-evidence/workspace-'+width+'.png'});
  await page.getByLabel('Buscar plataforma').fill('OBS Studio');await page.getByText('Leitura local implementada · autorização no OBS necessária',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,passed:true,missingConfigurationBlocksConsent:true,scopedMetadataRead:true,cameraRequiresGesture:true,cameraTracksStopped:true}));await context.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
