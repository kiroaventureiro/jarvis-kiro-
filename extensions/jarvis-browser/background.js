import {senderAllowed,validateAction,publicUrl,pageOperation} from './contract.mjs';
const key='request';
const get=async()=> (await chrome.storage.session.get(key))[key];
const put=async value=>chrome.storage.session.set({[key]:value});
let locked=false;
async function exclusive(fn){if(locked)throw Error('BUSY');locked=true;try{return await fn();}finally{locked=false;}}
function live(r){return r&&r.expiresAt>Date.now();}
async function external(message,sender){
  if(!senderAllowed(sender))throw Error('ORIGIN_DENIED');
  if(message?.type==='hello')return {ok:true,version:1,supervised:true};
  if(message?.type==='propose')return exclusive(async()=>{
    const previous=await get();if(live(previous)&&['pending','executing'].includes(previous.state))throw Error('PENDING_ACTION_EXISTS');
    const action=validateAction(message.action);
    const request={id:crypto.randomUUID(),ownerTab:sender.tab.id,action,state:'pending',expiresAt:Date.now()+300000};
    await put(request);await chrome.action.setBadgeText({text:'1'});
    return {ok:true,id:request.id,state:'pending'};
  });
  if(message?.type==='result'){
    const r=await get();if(!live(r)||r.ownerTab!==sender.tab.id||r.id!==message.id)throw Error('REQUEST_NOT_FOUND');
    return {ok:true,state:r.state,result:r.result||null};
  }
  throw Error('UNKNOWN_MESSAGE');
}
async function perform(action){
  if(action.op==='list')return {tabs:(await chrome.tabs.query({})).filter(t=>!t.incognito&&publicUrl(t.url)).slice(0,50).map(t=>({id:t.id,title:(t.title||'').slice(0,150),url:publicUrl(t.url)})),limit:50};
  if(action.op==='open'){const tab=await chrome.tabs.create({url:action.url,active:true});return {opened:true,tabId:tab.id};}
  const target=await chrome.tabs.get(action.tabId);if(target.incognito||!publicUrl(target.url))throw Error('TAB_DENIED');
  if(action.op==='focus'){await chrome.tabs.update(action.tabId,{active:true});await chrome.windows.update(target.windowId,{focused:true});return {focused:true};}
  if(action.op==='navigate'){await chrome.tabs.update(action.tabId,{url:action.url,active:true});return {navigationRequested:true};}
  const active=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
  if(active?.id!==action.tabId)throw Error('ACTIVATE_TARGET_AND_OPEN_EXTENSION');
  const result=await chrome.scripting.executeScript({target:{tabId:action.tabId},func:pageOperation,args:[action.op,action.label||'',action.text||'']});
  return result[0]?.result||{confirmed:false};
}
async function internal(message,sender){
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))throw Error('REVIEW_DENIED');
  if(message?.type==='review'){const r=await get();return {ok:true,request:live(r)?r:null,extensionId:chrome.runtime.id};}
  return exclusive(async()=>{
    const r=await get();if(!live(r)||r.state!=='pending'||r.id!==message.id)throw Error('REQUEST_NOT_PENDING');
    if(message.type==='deny'){r.state='denied';r.result=null;}
    else if(message.type==='approve'){
      r.state='executing';await put(r);
      try{r.result=await perform(r.action);r.state='completed';}catch{r.state='failed';r.result={error:'ACTION_NOT_CONFIRMED',instruction:'Para leitura/preenchimento, ative a aba de destino e abra o ícone da extensão. A página precisa permitir activeTab.'};}
    }else throw Error('UNKNOWN_REVIEW');
    await put(r);await chrome.action.setBadgeText({text:''});return {ok:true,state:r.state};
  });
}
function listen(fn){return (message,sender,reply)=>{fn(message,sender).then(reply).catch(e=>reply({ok:false,error:e.message}));return true;};}
chrome.runtime.onMessageExternal.addListener(listen(external));
chrome.runtime.onMessage.addListener(listen(internal));
