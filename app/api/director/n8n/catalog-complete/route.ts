import { NextResponse } from "next/server";
import { completeCatalogRun } from "../../../../../lib/n8n/catalog-run";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 512) throw Error();
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 512) throw Error();
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 2 ||
      typeof body.runId !== "string" || typeof body.ticket !== "string") throw Error();
    return NextResponse.json(await completeCatalogRun(body.runId, body.ticket), { headers });
  } catch {
    return NextResponse.json({ error: "N8N_REPORT_CALLBACK_DENIED_OR_FAILED" }, { status: 403, headers });
  }
}
