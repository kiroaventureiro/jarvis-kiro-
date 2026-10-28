import { answerAbacusPlatformQuestion } from "../../../../lib/abacus/platform-read";
import {
  answerAbacusHub,
  answerMediaRequest,
} from "../../../../lib/abacus/hub-server";
import { answerPublicLibrary } from "../../../../lib/research/library-server";
import { webResearchPolicy } from "../../../../lib/research/web";
import { answerWebResearch } from "../../../../lib/research/web-server";
import {
  answerKnowledge,
  knowledgeResearch,
} from "../../../../lib/research/knowledge-server";
import { answerPlaceReference } from "../../../../lib/research/places";
import { answerImages } from "../../../../lib/research/images";
import { answerResearch } from "../../../../lib/research/server";
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
      webResearch: {
        configured:
          webResearchPolicy(process.env).enabled &&
          !!process.env.ABACUS_API_KEY,
        paidCallsAllowed: permission.allowed,
        accountEntitlementVerified: false,
      },
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
      (await answerAbacusPlatformQuestion(message, signal)) ||
      (await answerAbacusHub(message, signal)) ||
      (await answerMediaRequest(message, signal)) ||
      (await answerPublicLibrary(message, signal)) ||
      answerPlaceReference(message) ||
      (await answerImages(message, signal)) ||
      (await answerResearch(message, signal)) ||
      (await answerNativeRequest(message, signal)) ||
      (await answerOperationalQuestion(message, signal)) ||
      localVisualReference(message) ||
      (await answerWebResearch(message, signal)) ||
      (!process.env.ABACUS_API_KEY ||
      !costPermission("abacus", process.env).allowed
        ? await answerKnowledge(message, signal)
        : null),
    prepare: async (message, signal, input) => {
      try {
        const research = await knowledgeResearch.search(message, signal);
        return research?.sources.length ? { ...input, research } : input;
      } catch (error) {
        if (signal.aborted) throw error;
        return input;
      }
    },
    reply: askAbacus,
    stream: streamAbacus,
  });
}
