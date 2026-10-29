const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const out=process.env.TEST_OUTPUT_DIR||'/tmp/jarvis-handoff-evidence';
 await fs.mkdir(out,{recursive:true});
 try {
  for(const width of [1440,390,320]) {
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];const requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(r.url().includes('/api/director/'))requests.push(r.url())});
   await page.addInitScript(()=>{window.open=()=>{throw Error('popup must not be used')};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});});
   await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:3147');
   await page.getByRole('button',{name:'Escrever mensagem',exact:true}).focus();
   await page.getByRole('button',{name:'Escrever mensagem',exact:true}).click();
   const input=page.getByRole('textbox',{name:'Mensagem para o Jarvis'});
   await input.fill('Jarvis, peça ao Codex para revisar o jogo Sistema Origem');
   await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
   const panel=page.getByRole('region',{name:'Pedido para outro aplicativo'});
   await panel.waitFor();
   const prompt=await page.getByRole('textbox',{name:'Pedido preparado'}).inputValue();
   const link=page.getByRole('link',{name:'Abrir Codex com pedido',exact:true});
   const url=new URL(await link.getAttribute('href'));
   assert.equal(url.searchParams.get('prompt'),prompt);
   assert.ok(prompt.includes('Sistema Origem'));
   assert.equal(url.searchParams.has('path'),false);
   await page.getByRole('button',{name:'Copiar pedido',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__copied),prompt);
   // Preserve user gesture and exercise handler, without opening an external app in CI.
   await link.evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));
   await link.click();
   await panel.getByText(/Abertura solicitada/).waitFor();
   assert.equal(await page.getByRole('link',{name:'Abrir Codex Web',exact:true}).getAttribute('href'),'https://chatgpt.com/codex');
   assert.equal(await page.getByRole('link',{name:'Abrir ChatGPT',exact:true}).getAttribute('href'),'https://chatgpt.com/');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await panel.screenshot({path:out+'/handoff-'+width+'.png'});
   await page.getByRole('button',{name:'Fechar pedido',exact:true}).click();
   await input.fill('pergunte ao Navi como organizar minhas ideias');
   await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
   await panel.getByRole('heading',{name:'Pedido para o ChatGPT',exact:true}).waitFor();
   assert.equal(await page.getByRole('link',{name:'Abrir Codex com pedido',exact:true}).count(),0);
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));
   await page.getByRole('button',{name:'Copiar pedido',exact:true}).click();
   await panel.getByText(/Cópia automática indisponível/).waitFor();
   await page.getByRole('button',{name:'Fechar pedido',exact:true}).click();
   await input.fill('Jarvis, pesquise no Google sobre ação e café');
   await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
   const apps=page.getByRole('region',{name:'Aplicativos',exact:true});
   await apps.waitFor();
   const searchLink=apps.getByRole('link',{name:'Abrir Pesquisa no navegador',exact:true});
   assert.equal(new URL(await searchLink.getAttribute('href')).searchParams.get('q'),'ação e café');
   assert.equal(await apps.getByRole('link',{name:'Microsoft 365',exact:true}).getAttribute('href'),'https://www.microsoft365.com/');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await apps.screenshot({path:out+'/apps-'+width+'.png'});
   assert.deepEqual(requests,[],'handoff must not call an executor or paid model');
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({width,passed:true,encodedPrompt:true,copy:true,fallback:true,popupFree:true,noExecutorRequests:true}));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
