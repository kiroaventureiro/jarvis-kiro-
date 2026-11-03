/**
 * Conservative correction of provider names damaged by Portuguese speech-to-text.
 * This is an intent hint only: never grants permissions or executes writes.
 */
export function normalizeProviderSpeech(input: string, history: Array<{role:string;content:string}> = []): string {
  const fold=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const n=fold(input);
  const mentionsDevelopment=/\b(repositorios?|projetos?|branches?|commits?|github|git hub|kit hub|deploys?|implantac(?:ao|oes)|vercel|versel|banco|dados|tabelas?|supabase|supa base|codigo|arquivos?|conex(?:ao|oes)|integrac(?:ao|oes)|site)\b/.test(n);
  const previous=history.slice(-8).reverse().find(t=>t.role==="user" && /\b(github|vercel|supabase|repositori|deploy|banco de dados)\b/.test(fold(t.content)));
  const inTechnicalContext=mentionsDevelopment||!!previous;
  let result=input;
  const replace=(pattern:RegExp,to:string)=>{result=result.replace(pattern,to);};
  replace(/\b(?:git\s*hub|kit\s*hub|qui(?:t|te)\s*hub|guite?\s*hub|github)\b/gi,"GitHub");
  replace(/\b(?:supa\s*base|supa\s*baze|supa\s*beise|sofa\s*base|sof[aá]\s*base|super\s*base|supabase)\b/gi,"Supabase");
  replace(/\b(?:vercel|versel|v[ée]rsel|ver\s*cel)\b/gi,"Vercel");
  // "Russell" is a normal name. Interpret it as a platform only alongside
  // deployment vocabulary or when recent conversation explicitly identifies Vercel.
  const vercelContext=/\b(deploys?|deployments?|implantac(?:ao|oes)|hospedagem|builds?|preview|publicac(?:ao|oes)|projetos?|conex(?:ao|oes)|vercel|versel)\b/.test(n)
    || (previous ? /\b(vercel|versel)\b/.test(fold(previous.content)) : false);
  if(inTechnicalContext && vercelContext)replace(/\b(?:russell|rusel|russel|rucel)\b/gi,"Vercel");
  return result;
}
