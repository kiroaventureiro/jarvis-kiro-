import { localVisualReference } from "../../../../lib/holo/orchestrator";
import { answerNativeRequest } from "../../../../lib/connectors/server";
import {
  answerOperationalQuestion,
  operationalSnapshot,
} from "../../../../lib/operational/server";
import { abacusUsage, tokenLimit } from "../../../../lib/abacus/usage";
import { ABACUS_CAPABILITIES } from "../../../../lib/abacus/capabilities";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { askAbacus, streamAbacus } from "../../../../lib/abacus-routellm";
import {
  costPermission,
  providerCallBudget,
} from "../../../../lib/voice/cost-policy";
import { processAbacusRequest } from "../../../../lib/voice/abacus-gateway";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const permission = costPermission("abacus", process.env);
  return NextResponse.json(
    {
      provider: "abacus",
      configured: !!process.env.ABACUS_API_KEY,
      active:
        operationalSnapshot().integrations.find((x) => x.id === "abacus")
          ?.state === "operational_authorized",
      operational: operationalSnapshot().integrations.find(
        (x) => x.id === "abacus",
      ),
      model: "route-llm",
      paidCallsAllowed: permission.allowed,
      callsPerHour: permission.callsPerHour,
      usage: providerCallBudget.stats("abacus"),
      telemetry: abacusUsage.stats(),
      tokenLimitPerHour: tokenLimit(process.env),
      capabilities: ABACUS_CAPABILITIES,
      note: "Sem chamada externa de status; os limites são temporários por instância, não uma garantia financeira distribuída.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return processAbacusRequest(request, {
    configured: () => !!process.env.ABACUS_API_KEY,
    permission: () => costPermission("abacus", process.env),
    admit: (permission) => providerCallBudget.admit("abacus", permission),
    localReply: async (message, signal) =>
      (await answerNativeRequest(message)) ||
      (await answerOperationalQuestion(message, signal)) ||
      localVisualReference(message),
    reply: askAbacus,
    stream: streamAbacus,
  });
}
