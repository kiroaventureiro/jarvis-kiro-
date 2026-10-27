import { withNativeConnectors } from "../../../../lib/connectors/native-status";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { operationalRegistry } from "../../../../lib/operational/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const params = new URL(request.url).searchParams,
    service = params.get("service");
  const ids =
    service === "abacus"
      ? ["abacus" as const]
      : service === "supabase-memory"
        ? ["supabase-memory" as const]
        : undefined;
  const snapshot = await operationalRegistry.read({
    verify: params.get("verify") === "1",
    ids,
    signal: request.signal,
  });
  return NextResponse.json(
    await withNativeConnectors(
      snapshot,
      params.get("verify") === "1" && !service,
    ),
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
