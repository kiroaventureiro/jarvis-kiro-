import { NextResponse } from "next/server";
import { authorized } from "../../../lib/auth";

export const dynamic = "force-dynamic";

type Capability = { status: "ready" | "needs_configuration" | "not_implemented"; detail: string };

function configured(name: string): boolean { return Boolean(process.env[name]?.trim()); }

/**
 * Safe, authenticated capabilities inventory.
 * It deliberately never returns tokens, hostnames, secret values or internal URLs.
 * Status "ready" means local configuration exists, not that the integration was tested.
 */
export async function GET() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const github: Capability = configured("GITHUB_READ_TOKEN")
    ? { status: "ready", detail: "Credencial de leitura configurada; conexão ainda requer teste." }
    : { status: "needs_configuration", detail: "Falta GITHUB_READ_TOKEN no servidor." };
  const voice: Capability = configured("OPENAI_API_KEY")
    ? { status: "ready", detail: "Chave configurada; voz ainda requer teste." }
    : { status: "needs_configuration", detail: "Falta OPENAI_API_KEY no servidor." };
  const supabase: Capability = configured("SUPABASE_URL") && (configured("SUPABASE_ANON_KEY") || configured("SUPABASE_SERVICE_ROLE_KEY"))
    ? { status: "ready", detail: "Configuração básica presente; banco e permissões ainda requerem teste." }
    : { status: "needs_configuration", detail: "Integração Supabase ainda não configurada com segurança." };

  return NextResponse.json({
    module: "jarvis-technical-director",
    mode: "read_only",
    generatedAt: new Date().toISOString(),
    capabilities: {
      github,
      voice,
      supabase,
      passkeys: { status: "not_implemented", detail: "Acesso por dispositivo ainda não implementado." },
      githubCodeWriting: { status: "not_implemented", detail: "Alteração de código, branches e PRs pelo Jarvis ainda não habilitados." },
      n8n: { status: "not_implemented", detail: "Fluxos preparados; integração operacional não ativada." }
    },
    safeguards: { githubWriteDisabled: true, productionChangesRequireApproval: true, secretsReturned: false }
  }, { headers: { "Cache-Control": "no-store" } });
}
