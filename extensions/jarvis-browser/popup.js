let id;
const status=document.getElementById('status'),approve=document.getElementById('approve'),deny=document.getElementById('deny');
const result=await chrome.runtime.sendMessage({type:'review'});
document.getElementById('id').textContent=result.extensionId||chrome.runtime.id;
if(result.request){id=result.request.id;status.textContent='Pedido: '+result.request.state;document.getElementById('request').textContent=JSON.stringify(result.request.action,null,2);approve.disabled=deny.disabled=result.request.state!=='pending';}
else status.textContent='Sem pedido válido. Solicite uma ação em Jarvis → Conexões → Navegador.';
async function decide(type){approve.disabled=deny.disabled=true;const r=await chrome.runtime.sendMessage({type,id});status.textContent=r.ok?'Resultado: '+r.state:'Não confirmado: '+r.error;}
approve.addEventListener('click',()=>void decide('approve'));
deny.addEventListener('click',()=>void decide('deny'));
