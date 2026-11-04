import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const endpoint = "https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/approvals";
const fields = new Set(["approvalId", "jobId", "planId", "digest", "capability", "decision", "expiresAt"]);
const id = /^[A-Za-z0-9_-]{1,128}$/;

/** Owner-session transport for explicit HML decisions. This never authorizes a real executor. */
export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "ORIGIN_DENIED" }, { status: 403, headers });
  }
  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) throw Error();
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) throw Error();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error();
    body = parsed as Record<string, unknown>;
    if (Object.keys(body).some(key => !fields.has(key)) || Object.keys(body).length !== fields.size) throw Error();
    for (const key of ["approvalId", "jobId", "planId"]) {
      if (typeof body[key] !== "string" || !id.test(body[key] as string)) throw Error();
    }
    if (typeof body.digest !== "string" || !/^[a-f0-9]{64}$/.test(body.digest)) throw Error();
    if (typeof body.capability !== "string" || !/^simulation\.(success|transient|permanent|uncertain|interruption)$/.test(body.capability)) throw Error();
    if (body.decision !== "approve" && body.decision !== "reject") throw Error();
    const expiry = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 15 * 60000) throw Error();
    body.expiresAt = new Date(expiry).toISOString();
  } catch {
    return NextResponse.json({ error: "INVALID_HML_DECISION" }, { status: 400, headers });
  }
  const key = process.env.JARVIS_HML_APPROVAL_KEY;
  if (!key || key.length < 32 || /[\r\n]/.test(key) || key === process.env.JARVIS_HML_INGRESS_KEY) {
    return NextResponse.json({ error: "HML_APPROVAL_NOT_CONFIGURED" }, { status: 503, headers });
  }
  try {
    const upstream = await fetch(endpoint, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "X-Jarvis-Approval-Key": key },
      body: JSON.stringify({ ...body, environment: "homologation" }),
    });
    const raw = await upstream.text();
    if (raw.length > 16384) throw Error();
    const receipt: unknown = JSON.parse(raw);
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw Error();
    const r = receipt as Record<string, unknown>;
    const matches = r.persisted === true && r.decisionRecorded === true &&
      r.environment === "homologation" && r.approvalId === body.approvalId && r.jobId === body.jobId &&
      r.planId === body.planId && r.digest === body.digest && r.capability === body.capability &&
      r.decision === body.decision && r.decisionCurrent === true &&
      typeof r.expiresAt === "string" && Date.parse(r.expiresAt) === Date.parse(body.expiresAt as string) && r.executorMode === "mock_only" &&
      r.realExecutorAuthorized === false && r.externalActionPerformed === false;
    if (!upstream.ok || !matches) {
      return NextResponse.json({ decisionRecorded: false, error: "HML_DECISION_NOT_CONFIRMED", upstreamStatus: upstream.status }, { status: 502, headers });
    }
    // Return only allowlisted receipt data; never upstream headers or credential material.
    return NextResponse.json({ decisionRecorded: true, persisted: true, environment: "homologation",
      approvalId: body.approvalId, jobId: body.jobId, planId: body.planId, digest: body.digest,
      capability: body.capability, decision: body.decision, jobState: r.jobState,
      decisionStatus: r.decisionStatus, executorMode: "mock_only", realExecutorAuthorized: false,
    }, { headers });
  } catch {
    return NextResponse.json({ decisionRecorded: false, error: "HML_APPROVAL_UNAVAILABLE" }, { status: 502, headers });
  }
}
