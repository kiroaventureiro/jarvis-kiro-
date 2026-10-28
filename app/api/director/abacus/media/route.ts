import { authorized } from "../../../../../lib/auth";
import { executeMedia } from "../../../../../lib/abacus/hub-server";
import { sameOrigin, boundedBody } from "../../../../../lib/abacus/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  if (!sameOrigin(request))
    return Response.json(
      { error: "Origem inválida" },
      { status: 403, headers },
    );
  try {
    return Response.json(
      await executeMedia(await boundedBody(request, 2100000), request.signal),
      { headers },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNAVAILABLE";
    const denied = [
      "MEDIA_BUDGET_REQUIRED",
      "ABACUS_NOT_CONFIGURED",
      "MODEL_NOT_IN_ACCOUNT_CATALOG",
    ].includes(code);
    return Response.json(
      {
        error: denied
          ? "Geração não iniciada: verifique a autorização, o orçamento e o modelo disponível nesta conta."
          : /INVALID_|BODY_LIMIT/.test(code)
            ? "Pedido ou resposta multimodal inválida."
            : "Não foi possível concluir a geração. Não há nova tentativa automática.",
        code: denied ? code : "MEDIA_UNAVAILABLE",
      },
      {
        status: denied ? 403 : /INVALID_|BODY_LIMIT/.test(code) ? 400 : 502,
        headers,
      },
    );
  }
}
