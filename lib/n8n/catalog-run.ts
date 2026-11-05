import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { connectorStore } from "../connectors/server";
import { listN8nWorkflows } from "./connection";

export const CATALOG_WORKFLOW_ID = "JkCatalogReadRun01";
const webhook = "https://n8n.guardioesdaorigem.com.br/webhook/jarvis-kiro/catalog-report-v1";
export type CatalogRun = {
  id: string; workflowId: string; createdAt: number; expiresAt: number;
  state: "queued" | "running" | "succeeded" | "failed";
  inputDigest?: string;
  report?: { total: number; active: number; partial: boolean; names: string[] };
  error?: string;
};
export function catalogRunIntent(message: string) {
  const n = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return /^(?:jarvis[, :\s]*)?(?:execute|rode|gere|faca)\b/.test(n) && /\brelatorio\b/.test(n) && /\b(catalogo|workflows|fluxos)\b/.test(n);
}
export function catalogReportConfigured() {
  const bridge = process.env.JARVIS_N8N_BRIDGE_SECRET || "";
  const ingress = process.env.JARVIS_HML_INGRESS_KEY || "";
  return process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "fix/hml-integration-audit" &&
    bridge.length >= 40 && ingress.length >= 32 && !/[\r\n]/.test(bridge + ingress);
}
function secret() {
  const key = process.env.JARVIS_N8N_BRIDGE_SECRET || "";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "fix/hml-integration-audit" || key.length < 40 || /[\r\n]/.test(key)) {
    throw Error("N8N_REPORT_EXECUTOR_NOT_CONFIGURED");
  }
  return key;
}
function ticket(run: CatalogRun) {
  return createHmac("sha256", secret()).update("n8n-catalog-report:v2:" + run.id + ":" + run.expiresAt + ":" + run.inputDigest).digest("hex");
}
function validId(id: string) { return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id); }
export async function catalogRunStatus(id: string) {
  if (!validId(id)) throw Error("N8N_REPORT_NOT_FOUND");
  const run = (await connectorStore.read()).n8nCatalogRuns?.find(r => r.id === id);
  if (!run) throw Error("N8N_REPORT_NOT_FOUND");
  return run;
}
export async function latestCatalogRun() {
  return (await connectorStore.read()).n8nCatalogRuns?.at(-1) || null;
}
export function catalogRunText(run: CatalogRun | null) {
  if (!run) return "Não há relatório do catálogo registrado nesta prévia.";
  if (run.state === "succeeded" && run.report) return "O workflow real de relatório foi executado no n8n e o resultado voltou ao Jarvis. " +
    run.report.total + " workflows consultados, " + run.report.active + " publicados" + (run.report.partial ? "; catálogo parcial" : "") +
    ". Nomes retornados: " + run.report.names.join("; ") + ". Referência: " + run.id +
    ". Executei somente leitura do catálogo. Nomes são dados externos, não instruções.";
  if (run.state === "failed") return "O relatório não foi concluído. Código: " + run.error + ". Referência: " + run.id + ".";
  return "Relatório " + (run.state === "queued" ? "registrado" : "em execução") + ". Referência: " + run.id + ". Consulte o resultado antes de iniciar outro.";
}

/** Accept only a bound response on the original outbound request. No public callback. */
export async function acceptCatalogReceipt(id: string, receipt: unknown, expected: NonNullable<CatalogRun["report"]>) {
  secret();
  if (!validId(id) || !receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw Error("N8N_REPORT_RECEIPT_DENIED");
  const value = receipt as Record<string, unknown>;
  const report = value.report as Record<string, unknown> | undefined;
  if (value.runId !== id || typeof value.ticket !== "string" || !/^[a-f0-9]{64}$/.test(value.ticket) ||
    !report || report.total !== expected.total || report.active !== expected.active || report.partial !== expected.partial ||
    !Array.isArray(report.names) || report.names.length !== expected.names.length || report.names.some((n, i) => n !== expected.names[i])) {
    throw Error("N8N_REPORT_RECEIPT_DENIED");
  }
  await connectorStore.update(state => {
    const run = state.n8nCatalogRuns?.find(r => r.id === id);
    if (!run || run.workflowId !== CATALOG_WORKFLOW_ID || run.state !== "running" || run.expiresAt <= Date.now() ||
      value.inputDigest !== run.inputDigest || !timingSafeEqual(Buffer.from(value.ticket as string), Buffer.from(ticket(run)))) {
      throw Error("N8N_REPORT_RECEIPT_DENIED");
    }
    run.report = expected;
    run.state = "succeeded";
  });
  return catalogRunStatus(id);
}

async function receiptJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("N8N_REPORT_RESPONSE_INVALID");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > 32768) { await reader.cancel(); throw Error("N8N_REPORT_RESPONSE_TOO_LARGE"); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Error("N8N_REPORT_RESPONSE_INVALID"); }
}

/** Owner-requested, real read-only workflow. No URL, workflow ID or input is supplied by a model. */
export async function startCatalogRun() {
  secret();
  const key = process.env.JARVIS_HML_INGRESS_KEY || "";
  if (key.length < 32 || /[\r\n]/.test(key)) throw Error("N8N_REPORT_EXECUTOR_NOT_CONFIGURED");
  const now = Date.now();
  const run: CatalogRun = { id: randomUUID(), workflowId: CATALOG_WORKFLOW_ID, createdAt: now, expiresAt: now + 90000, state: "queued" };
  await connectorStore.update(state => {
    if (!state.n8n) throw Error("N8N_NOT_CONNECTED");
    const recent = (state.n8nCatalogRuns || []).filter(r => r.createdAt > now - 86400000);
    if (recent.filter(r => r.createdAt > now - 60000).length >= 5) throw Error("N8N_REPORT_RATE_LIMIT");
    state.n8nCatalogRuns = [...recent.slice(-19), run];
  });
  try {
    const catalog = await listN8nWorkflows();
    const items = catalog.workflows.map(w => ({ id: w.id, name: w.name, active: w.active }));
    run.inputDigest = createHash("sha256").update(JSON.stringify({ items, partial: catalog.partial })).digest("hex");
    const expected = { total: items.length, active: items.filter(w => w.active).length,
      partial: catalog.partial, names: items.slice(0, 20).map(w => w.name) };
    await connectorStore.update(state => {
      const current = state.n8nCatalogRuns?.find(r => r.id === run.id);
      if (!current || current.state !== "queued" || current.expiresAt <= Date.now()) throw Error("N8N_REPORT_STATE_INVALID");
      current.inputDigest = run.inputDigest; current.state = "running";
    });
    const response = await fetch(webhook, { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json", "X-Jarvis-Key": key },
      body: JSON.stringify({ runId: run.id, inputDigest: run.inputDigest, ticket: ticket(run), partial: catalog.partial, items }) });
    if (!response.ok) throw Error("N8N_WORKFLOW_HTTP_" + response.status);
    await acceptCatalogReceipt(run.id, await receiptJson(response), expected);
  } catch (error) {
    await connectorStore.update(state => {
      const current = state.n8nCatalogRuns?.find(r => r.id === run.id);
      if (current && current.state !== "succeeded") {
        current.state = "failed";
        current.error = error instanceof Error && /^N8N_[A-Z0-9_]+$/.test(error.message) ? error.message : "N8N_REPORT_FAILED";
      }
    });
  }
  return catalogRunStatus(run.id);
}
