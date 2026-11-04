import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;
const ALLOWED_HOST = "n8n.guardioesdaorigem.com.br";
const ALLOWED_PATH = "/webhook/jk-hml/v1/commands";

/**
 * Authenticated, server-to-server bridge from Jarvis Kiro to the HML n8n
 * ingress. The n8n credential is never exposed to the browser. This endpoint
 * does not enable external actions and is disabled until both server-side
 * environment variables are configured.
 */
export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403 });
  }

  const configuredUrl = process.env.JARVIS_HML_INGRESS_URL;
  const ingressKey = process.env.JARVIS_HML_INGRESS_KEY;
  if (!configuredUrl || !ingressKey || ingressKey.length < 32 || /[\r\n]/.test(ingressKey)) {
    return NextResponse.json(
      { error: "Ingresso HML não configurado no servidor" },
      { status: 503 },
    );
  }

  let target: URL;
  try {
    target = new URL(configuredUrl);
  } catch {
    return NextResponse.json({ error: "URL de ingresso inválida" }, { status: 503 });
  }
  if (
    target.protocol !== "https:" ||
    target.hostname !== ALLOWED_HOST ||
    target.port ||
    target.username ||
    target.password ||
    target.pathname !== ALLOWED_PATH ||
    target.search ||
    target.hash
  ) {
    return NextResponse.json({ error: "Destino de ingresso não permitido" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Comando excede o limite permitido" }, { status: 413 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Comando excede o limite permitido" }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "O comando deve ser um objeto JSON" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Jarvis-Key": ingressKey,
      },
      body: JSON.stringify(payload),
    });
    const responseText = await upstream.text();
    let responseBody: unknown;
    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      return NextResponse.json(
        { acceptedByIngress: false, status: upstream.status, error: "Resposta não JSON do orquestrador" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
      return NextResponse.json(
        { acceptedByIngress: false, status: upstream.status, error: "Resposta inválida do orquestrador" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { acceptedByIngress: upstream.ok, status: upstream.status, result: responseBody },
      { status: upstream.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Orquestrador HML indisponível" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
