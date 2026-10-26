import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { askAbacus } from "../../../../lib/abacus-routellm";
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
      active: false,
      model: "route-llm",
      paidCallsAllowed: permission.allowed,
      callsPerHour: permission.callsPerHour,
      usage: providerCallBudget.stats("abacus"),
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
    reply: askAbacus,
  });
}
