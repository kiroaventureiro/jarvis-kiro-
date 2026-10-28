import { authorized } from "../../../../lib/auth";
import { connectorStore } from "../../../../lib/connectors/server";
import { sameOrigin, boundedBody } from "../../../../lib/abacus/http";
import {
  recordVoiceUsage,
  voiceUsageStats,
} from "../../../../lib/voice/ledger";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  try {
    return Response.json(
      {
        stats: voiceUsageStats(
          connectorStore.configured()
            ? (await connectorStore.read()).voiceUsage
            : undefined,
        ),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Consumo persistente indisponível." },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  if (!sameOrigin(request))
    return Response.json(
      { error: "Origem inválida" },
      { status: 403, headers },
    );
  try {
    return Response.json(
      {
        stats: await recordVoiceUsage(
          connectorStore,
          await boundedBody(request, 2500),
        ),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Relato de consumo não registrado." },
      { status: 400, headers },
    );
  }
}
