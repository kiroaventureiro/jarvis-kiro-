export const ORIGIN = 'https://jarvis-kiro-git-fix-hml-integration-audit-umiversokiro.vercel.app';
export function senderAllowed(sender) {
  try { const u=new URL(sender.url); return sender.frameId===0 && Number.isInteger(sender.tab?.id) && !sender.tab.incognito && u.origin===ORIGIN && u.pathname==='/integracoes/navegador'; } catch { return false; }
}
export function publicUrl(value) {
  try { const u=new URL(value); if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;u.search='';u.hash='';return u.href.slice(0,1000); } catch { return null; }
}
export function validateAction(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_ACTION');
  const {op,tabId,url,label,text}=value;
  const allowed={list:['op'],open:['op','url'],focus:['op','tabId'],navigate:['op','tabId','url'],read:['op','tabId'],fill:['op','tabId','label','text']};
  if(typeof op!=='string'||!Object.hasOwn(allowed,op))throw Error('INVALID_ACTION');
  const fields=allowed[op];
  if(!fields||Object.keys(value).length!==fields.length||Object.keys(value).some(k=>!fields.includes(k)))throw Error('INVALID_ACTION');
  if(fields.includes('tabId')&&(!Number.isSafeInteger(tabId)||tabId<0))throw Error('INVALID_TAB');
  if(fields.includes('url')) { let u;try{u=new URL(url);}catch{throw Error('INVALID_URL');}if(typeof url!=='string'||url.length>2000||u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_URL'); }
  if(op==='fill'&&(typeof label!=='string'||label.length<2||label.length>100||typeof text!=='string'||text.length>2000||/senha|password|token|secret|segredo|cart[aã]o|card|cvv|otp|c[oó]digo de verifica[cç][aã]o/i.test(label)))throw Error('SENSITIVE_OR_INVALID_FIELD');
  return Object.fromEntries(fields.map(k=>[k,value[k]]));
}
/** Runs only in an isolated script on the tab explicitly activated by the owner. */
export function pageOperation(op,label,text) {
  if(op==='read')return {text:(document.body?.innerText||'').slice(0,8000),untrusted:true,truncated:(document.body?.innerText||'').length>8000};
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const fields=[...document.querySelectorAll('input,textarea')].filter(e=>{
    const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.disabled&&!e.readOnly;
  }).filter(e=>{
    const names=[e.getAttribute('aria-label'),e.getAttribute('placeholder'),...[...(e.labels||[])].map(l=>l.textContent)].filter(Boolean);
    return names.some(n=>normalize(n)===normalize(label));
  });
  if(fields.length!==1)throw Error('FIELD_NOT_UNIQUE');
  const field=fields[0];
  if(!['text','search','email','url','tel','textarea'].includes(field.type)||/password|credit|cc-|otp|one-time|token|secret|senha|card|cvv|cart[aã]o/i.test([field.name,field.id,field.autocomplete,field.getAttribute('aria-label'),label].join(' ')))throw Error('SENSITIVE_FIELD_DENIED');
  const prototype=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,text);
  field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  return {filled:true,submitted:false};
}
