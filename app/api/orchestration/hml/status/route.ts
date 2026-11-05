import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers});
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers});
  let body: Record<string,string>;
  try {
    const raw=await request.text();
    if(Buffer.byteLength(raw,"utf8")>2048)throw Error();
    const value: unknown=JSON.parse(raw);
    if(!value || typeof value!=="object" || Array.isArray(value))throw Error();
    body=value as Record<string,string>;
    if(Object.keys(body).length!==3 || Object.keys(body).some(k=>!["jobId","planId","digest"].includes(k)))throw Error();
    if(typeof body.jobId!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.jobId) || typeof body.planId!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.planId) || typeof body.digest!=="string" || !/^[a-f0-9]{64}$/.test(body.digest))throw Error();
  } catch { return NextResponse.json({error:"INVALID_HML_REFERENCE"},{status:400,headers}); }
  const key=process.env.JARVIS_HML_INGRESS_KEY;
  if(!key || key.length<32 || /[\r\n]/.test(key))return NextResponse.json({error:"HML_STATUS_NOT_CONFIGURED"},{status:503,headers});
  try {
    const upstream=await fetch("https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/status",{
      method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),
      headers:{"Content-Type":"application/json","X-Jarvis-Key":key},body:JSON.stringify(body),
    });
    const raw=await upstream.text();if(raw.length>16384)throw Error();
    const r=JSON.parse(raw) as Record<string,unknown>;
    if(!upstream.ok || !r || typeof r!=="object" || Array.isArray(r))throw Error();
    if(r.found===false)return NextResponse.json({found:false},{status:404,headers});
    const states=["awaiting_approval","pending","leased","running","succeeded","retry_wait","failed","reconciliation_required","quarantined","approval_blocked","context_expired","cancelled"];
    if(r.found!==true || r.environment!=="homologation" || r.jobId!==body.jobId || r.planId!==body.planId || r.digest!==body.digest || typeof r.jobState!=="string" || !states.includes(r.jobState))throw Error();
    const result=r.result as Record<string,unknown>|null;
    if(result && (typeof result!=="object" || Array.isArray(result) || result.simulated!==true || typeof result.resultRef!=="string" || !result.resultRef.startsWith("simulated:success:v1:"+body.jobId+":") || typeof result.resultDigest!=="string" || !/^[a-f0-9]{64}$/.test(result.resultDigest)))throw Error();
    return NextResponse.json({found:true,environment:"homologation",...body,jobState:r.jobState,
      result:result?{resultRef:result.resultRef,resultDigest:result.resultDigest,simulated:true}:null,
      externalActionPerformed:false},{headers});
  }catch{return NextResponse.json({error:"HML_STATUS_UNAVAILABLE"},{status:502,headers});}
}
