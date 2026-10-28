import { authorized } from "../../../../../lib/auth";
import {
  abacusHub,
  saveObservation,
} from "../../../../../lib/abacus/hub-server";
import { sameOrigin, boundedBody } from "../../../../../lib/abacus/http";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  try {
    return Response.json(
      await abacusHub(
        new URL(request.url).searchParams.get("verify") === "1",
        request.signal,
      ),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Catálogo indisponível. Nenhum acesso foi presumido." },
      { status: 502, headers },
    );
  }
}
export async function PUT(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  if (!sameOrigin(request))
    return Response.json(
      { error: "Origem inválida" },
      { status: 403, headers },
    );
  try {
    return Response.json(
      { observation: await saveObservation(await boundedBody(request, 8000)) },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && /INVALID_|BODY_LIMIT/.test(error.message)
            ? "Observação inválida ou extensa."
            : "Não foi possível salvar no cofre criptografado deste ambiente.",
      },
      { status: 400, headers },
    );
  }
}
