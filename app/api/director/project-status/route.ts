import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
const OWNER = "kiroaventureiro";
const REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

/** Read-only project health snapshot. Never send the GitHub token to the client. */
export async function GET(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const repo = new URL(request.url).searchParams.get("repo") ?? "";
  if (!REPO_PATTERN.test(repo)) return NextResponse.json({ error: "Repositório inválido" }, { status: 400 });
  const token = process.env.GITHUB_READ_TOKEN;
  if (!token) return NextResponse.json({ error: "GitHub ainda não conectado" }, { status: 503 });
  try {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({
      error: response.status === 404 ? "Projeto não encontrado ou sem permissão de leitura" : "GitHub indisponível",
    }, { status: response.status === 404 ? 404 : 502 });
    const data = await response.json() as {
      full_name?: string; html_url?: string; description?: string | null;
      private?: boolean; archived?: boolean; disabled?: boolean; default_branch?: string;
      pushed_at?: string | null; updated_at?: string; open_issues_count?: number;
    };
    return NextResponse.json({
      source: "github_live", fetchedAt: new Date().toISOString(),
      project: { name: data.full_name, url: data.html_url, description: data.description,
        isPrivate: data.private, isArchived: data.archived, isDisabled: data.disabled,
        defaultBranch: data.default_branch, lastPushAt: data.pushed_at,
        lastUpdatedAt: data.updated_at, openIssuesAndPullRequests: data.open_issues_count },
      note: "Leitura atual do GitHub. Não representa deploy, testes aprovados ou acesso a outros serviços.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha na consulta ao GitHub" }, { status: 502 });
  }
}
