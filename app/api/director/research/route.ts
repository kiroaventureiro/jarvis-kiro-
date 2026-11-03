import { requestOriginAllowed } from "../../../../lib/request-origin";
import { answerCodexPlanning } from "../../../../lib/codex/conversation";
import { answerNaviRequest } from "../../../../lib/openai/navi-router";
import { answerNativeRequest } from "../../../../lib/connectors/server";
import { answerCouncilRequest } from "../../../../lib/orchestration/council-server";
import { boundHistory } from "../../../../lib/abacus/protocol";
import { answerVoiceUsageQuestion } from "../../../../lib/voice/usage-answer";
import { answerVoiceStudioQuestion } from "../../../../lib/voice/voicestudio-server";
import { answerAbacusAgentQuestion } from "../../../../lib/abacus/agent-read";
import { answerAbacusPlatformQuestion } from "../../../../lib/abacus/platform-read";
import { answerDesignRequest } from "../../../../lib/design/intent";
import { answerAbacusHub } from "../../../../lib/abacus/hub-server";
import { answerPublicLibrary } from "../../../../lib/research/library-server";
import { answerKnowledge } from "../../../../lib/research/knowledge-server";
import { answerCognitiveRequest } from "../../../../lib/cognitive/server";
import { answerPlaceReference } from "../../../../lib/research/places";
import { answerImages } from "../../../../lib/research/images";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { answerResearch } from "../../../../lib/research/server";
import { localVisualReference } from "../../../../lib/holo/orchestrator";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!requestOriginAllowed(request, process.env.JARVIS_CONNECTOR_ORIGIN, false))
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
  let history;
  try {
    history = boundHistory(body.history, body.query);
  } catch {
    return NextResponse.json({ error: "Histórico inválido" }, { status: 400 });
  }
  try {
    const { normalizeProviderSpeech } = await import("../../../../lib/connectors/provider-speech");
    const understood = normalizeProviderSpeech(body.query, history);
    const { parseGitHubWriteIntent } = await import("../../../../lib/connectors/write-intent");
    const isWrite = !!parseGitHubWriteIntent(understood) || /^(?:sim[,!.]?\s*)?(?:aprovo|autorizo|confirmo|pode executar|pode criar)[.! ]*$/i.test(understood.trim()) || /^(?:jarvis[,!:.]?\s*)?aprovar\s+[a-f0-9]{8}[.!\s]*$/i.test(understood.trim());
    const reply =
      (isWrite ? await answerNativeRequest(understood, request.signal, history, true) : null) ||
      answerCodexPlanning(understood) ||
      (await answerNaviRequest(understood, history, request.signal)) ||
      (await answerCouncilRequest(understood, request.signal, false)) ||
      (await answerNativeRequest(understood, request.signal, history, true)) ||
      (await answerVoiceUsageQuestion(understood)) ||
      (await answerAbacusPlatformQuestion(understood, request.signal)) ||
      (await answerAbacusAgentQuestion(understood, request.signal)) ||
      (await answerVoiceStudioQuestion(understood, request.signal)) ||
      answerDesignRequest(understood) ||
      (await answerAbacusHub(understood, request.signal)) ||
      (await answerPublicLibrary(understood, request.signal)) ||
      answerPlaceReference(understood) ||
      (await answerImages(understood, request.signal)) ||
      (await answerResearch(understood, request.signal)) ||
      localVisualReference(understood) ||
      (await answerCognitiveRequest(understood, request.signal, true)) ||
      (await answerKnowledge(understood, request.signal));
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
