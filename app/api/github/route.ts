import { NextResponse } from "next/server";
import { authorized } from "../../../lib/auth";
export const dynamic = "force-dynamic";
const USER = "kiroaventureiro";
export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Autenticação necessária para consultar repositórios privados." }, { status: 401 });
  const token = process.env.GITHUB_READ_TOKEN;
  if (!token) return NextResponse.json({ error: "Configure GITHUB_READ_TOKEN no servidor com permissão somente leitura." }, { status: 503 });
  try {
    const response = await fetch(`https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return NextResponse.json({ error: "GitHub indisponível ou credencial sem permissão.", status: response.status }, { status: 502 });
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return NextResponse.json({ error: "Resposta inesperada." }, { status: 502 });
    const repositories = data.filter((r: any) => r.owner?.login?.toLowerCase() === USER).map((r: any) => ({
      name: r.name, private: r.private, url: r.html_url,
      updatedAt: r.updated_at, pushedAt: r.pushed_at,
      description: r.description, defaultBranch: r.default_branch
    }));
    return NextResponse.json({ source: "github", fetchedAt: new Date().toISOString(), count: repositories.length, repositories }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Falha de conexão ao GitHub." }, { status: 502 }); }
}
