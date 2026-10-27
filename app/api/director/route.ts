import { NextResponse } from "next/server";
import { authorized } from "../../../lib/auth";
import { operationalSnapshot } from "../../../lib/operational/server";

export const dynamic = "force-dynamic";

/** Authenticated metadata only; configuration and proof remain separate. */
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão necessária." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const operational = operationalSnapshot();
  const capability = (id: string) => {
    const current = operational.integrations.find((item) => item.id === id)!;
    return {
      status: current.state,
      detail: current.note,
      verified: current.verified,
      authorized: current.authorized,
      checks: current.checks,
      checkedAt: current.checkedAt,
    };
  };
  return NextResponse.json(
    {
      module: "jarvis-technical-director",
      mode: "read_only",
      generatedAt: operational.generatedAt,
      operational,
      capabilities: {
        github: capability("github"),
        voice: capability("openai-voice"),
        supabase: capability("supabase-memory"),
        abacus: capability("abacus"),
        passkeys: {
          status: "requires_device_validation",
          detail:
            "Acesso por dispositivo depende do cadastro e validação do dispositivo.",
        },
        githubCodeWriting: {
          status: "not_implemented",
          detail:
            "Alteração de código, branches e PRs pelo Jarvis ainda não habilitados.",
        },
        n8n: capability("n8n"),
      },
      safeguards: {
        githubWriteDisabled: true,
        productionChangesRequireApproval: true,
        secretsReturned: false,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
