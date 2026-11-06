import { authorized } from "../../../../lib/auth";
import { extensionArchive } from "../../../../lib/browser/extension-archive";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!await authorized()) return Response.json({ error: "Entre como proprietário." }, { status: 401, headers });
  try { return new Response(new Uint8Array(await extensionArchive()), { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="jarvis-browser-preview.zip"', "X-Content-Type-Options": "nosniff" } }); }
  catch { return Response.json({ error: "Arquivo da extensão indisponível." }, { status: 503, headers }); }
}
