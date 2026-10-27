import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { answerResearch } from "../../../../lib/research/server";
import { localVisualReference } from "../../../../lib/holo/orchestrator";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 8000)
    return NextResponse.json(
      { error: "Consulta muito extensa" },
      { status: 413 },
    );
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    let raw = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 8000) {
          await reader.cancel();
          return NextResponse.json(
            { error: "Consulta muito extensa" },
            { status: 413 },
          );
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    if (raw.length > 8000)
      return NextResponse.json(
        { error: "Consulta muito extensa" },
        { status: 413 },
      );
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  }
  if (
    !body ||
    typeof body.query !== "string" ||
    !body.query.trim() ||
    body.query.length > 1500
  )
    return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  try {
    const reply =
      (await answerResearch(body.query, request.signal)) ||
      localVisualReference(body.query);
    return NextResponse.json(
      reply
        ? { available: true, ...reply }
        : {
            available: false,
            text: "Esta consulta não tem uma fonte de pesquisa integrada. Não foi feita pesquisa geral na internet.",
          },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "A consulta foi interrompida ou a fonte está indisponível." },
      { status: 502 },
    );
  }
}
