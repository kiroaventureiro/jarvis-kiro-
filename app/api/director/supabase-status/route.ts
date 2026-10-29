import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { operationalRegistry } from "../../../../lib/operational/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const snapshot = await operationalRegistry.read({
    verify: true,
    ids: ["supabase-memory"],
    signal: request.signal,
  });
  const operational = snapshot.integrations.find(
    (x) => x.id === "supabase-memory",
  )!;
  return NextResponse.json(
    {
      source: "operational_registry",
      environment: snapshot.environment,
      fetchedAt: operational.checkedAt,
      reachable: operational.verified,
      operational,
      note: "Escopo somente de leitura: tabela de memória e descriptografia quando existir registro. Não comprova gravação ou todas as políticas RLS.",
    },
    {
      status: !operational.configured
        ? 503
        : operational.state === "temporarily_unavailable"
          ? 502
          : 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
