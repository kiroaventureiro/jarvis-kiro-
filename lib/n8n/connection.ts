import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { connectorStore } from "../connectors/server";
import { summarizeWorkflow } from "./workflow-details";

async function readN8nJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("N8N_RESPONSE_INVALID");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 1024 * 1024) { await reader.cancel(); throw Error("N8N_RESPONSE_TOO_LARGE"); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Error("N8N_RESPONSE_INVALID"); }
}

function workflowList(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("N8N_RESPONSE_INVALID");
  const data = raw as { data?: unknown; nextCursor?: unknown };
  if (!Array.isArray(data.data) || data.data.length > 100) throw Error("N8N_RESPONSE_INVALID");
  const workflows = data.data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw Error("N8N_RESPONSE_INVALID");
    const w = value as Record<string, unknown>;
    if (typeof w.id !== "string" || typeof w.name !== "string") throw Error("N8N_RESPONSE_INVALID");
    return { id: w.id.slice(0, 100), name: w.name.slice(0, 150), active: w.active === true };
  });
  return { workflows, executionEnabled: false, partial: typeof data.nextCursor === "string" && !!data.nextCursor };
}

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const n=ip.toLowerCase();
    return n==="::1" || n==="::" || n.startsWith("fc") || n.startsWith("fd") || n.startsWith("fe8") || n.startsWith("fe9") || n.startsWith("fea") || n.startsWith("feb") || n.startsWith("::ffff:");
  }
  const a=ip.split(".").map(Number);
  return a[0]===0 || a[0]===10 || a[0]===127 || a[0]>=224 || (a[0]===169&&a[1]===254) || (a[0]===172&&a[1]>=16&&a[1]<=31) || (a[0]===192&&a[1]===168) || (a[0]===100&&a[1]>=64&&a[1]<=127) || (a[0]===192&&a[1]===0) || (a[0]===198&&(a[1]===18||a[1]===19)) || (a[0]===192&&a[1]===0&&a[2]===2) || (a[0]===198&&a[1]===51&&a[2]===100) || (a[0]===203&&a[1]===0&&a[2]===113);
}
export async function n8nBaseUrl(raw: string): Promise<string> {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.port || u.username || u.password || u.search || u.hash || u.pathname !== "/" || raw.length>250 || isIP(u.hostname)) throw Error("N8N_URL_INVALID");
  const allowed = (process.env.JARVIS_N8N_ALLOWED_HOST || "").toLowerCase().trim();
  if (!((u.hostname.endsWith(".app.n8n.cloud") && u.hostname.length>14) || (allowed && u.hostname === allowed))) throw Error("N8N_HOST_NOT_ALLOWED");
  const addresses=await lookup(u.hostname,{all:true,verbatim:true});
  if (!addresses.length || addresses.some(a=>privateAddress(a.address))) throw Error("N8N_ADDRESS_BLOCKED");
  return u.origin;
}
export async function verifyN8n(baseUrl:string, apiKey:string, signal?:AbortSignal):Promise<void> {
  if (!apiKey || apiKey.length>3000 || /[\r\n]/.test(apiKey)) throw Error("N8N_KEY_INVALID");
  const address=await n8nBaseUrl(baseUrl);
  const response=await fetch(address+"/api/v1/workflows?limit=1",{method:"GET",headers:{"X-N8N-API-KEY":apiKey},cache:"no-store",redirect:"error",signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(9000)])});
  if (!response.ok) throw Error(response.status===401||response.status===403?"N8N_AUTH_DENIED":"N8N_VERIFY_FAILED");
  workflowList(await readN8nJson(response));
}
export async function n8nStatus() {
  if (!connectorStore.configured()) return {vaultConfigured:false,connected:false,verified:false};
  const state=await connectorStore.read();
  return {vaultConfigured:true,connected:!!state.n8n,verified:!!state.n8n?.verifiedAt,baseUrl:state.n8n?.baseUrl||null,verifiedAt:state.n8n?.verifiedAt||null};
}
export async function connectN8n(url:string,apiKey:string,signal?:AbortSignal) {
  if (!connectorStore.configured()) throw Error("VAULT_NOT_CONFIGURED");
  const baseUrl=await n8nBaseUrl(url);
  await verifyN8n(baseUrl,apiKey,signal);
  const verifiedAt=new Date().toISOString();
  await connectorStore.update(state=>{state.n8n={baseUrl,apiKey,connectedAt:verifiedAt,verifiedAt};});
  return {connected:true,verified:true,baseUrl,verifiedAt};
}
export async function testN8n(signal?:AbortSignal) {
  const state=await connectorStore.read();
  if (!state.n8n) throw Error("N8N_NOT_CONNECTED");
  await verifyN8n(state.n8n.baseUrl,state.n8n.apiKey,signal);
  const verifiedAt=new Date().toISOString();
  await connectorStore.update(s=>{const current=s.n8n;if(current && current.baseUrl===state.n8n?.baseUrl && current.apiKey===state.n8n?.apiKey)current.verifiedAt=verifiedAt;});
  return {connected:true,verified:true,baseUrl:state.n8n.baseUrl,verifiedAt};
}
export async function disconnectN8n(){
  await connectorStore.update(state=>{delete state.n8n;});
  return {connected:false,verified:false};
}

export async function listN8nWorkflows(signal?:AbortSignal) {
  const state=await connectorStore.read();
  if (!state.n8n) throw Error("N8N_NOT_CONNECTED");
  const baseUrl=await n8nBaseUrl(state.n8n.baseUrl);
  const response=await fetch(baseUrl+"/api/v1/workflows?limit=100",{
    headers:{"X-N8N-API-KEY":state.n8n.apiKey},
    cache:"no-store",redirect:"error",
    signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(9000)])
  });
  if (!response.ok) throw Error("N8N_WORKFLOWS_UNAVAILABLE");
  return workflowList(await readN8nJson(response));
}

export async function n8nWorkflowDetails(id: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error("N8N_WORKFLOW_ID_INVALID");
  const state = await connectorStore.read();
  if (!state.n8n) throw Error("N8N_NOT_CONNECTED");
  const baseUrl = await n8nBaseUrl(state.n8n.baseUrl);
  const response = await fetch(baseUrl + "/api/v1/workflows/" + encodeURIComponent(id), {
    method: "GET", headers: { "X-N8N-API-KEY": state.n8n.apiKey }, cache: "no-store", redirect: "error",
    signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(9000)]),
  });
  if (!response.ok) throw Error(response.status === 404 ? "N8N_WORKFLOW_NOT_FOUND" : "N8N_WORKFLOW_UNAVAILABLE");
  return summarizeWorkflow(await readN8nJson(response), id);
}
