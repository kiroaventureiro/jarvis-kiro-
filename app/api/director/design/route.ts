import { authorized } from "../../../../lib/auth";
import { sameOrigin, boundedBody } from "../../../../lib/abacus/http";
import { executeMedia } from "../../../../lib/abacus/hub-server";
import { designImageRequest } from "../../../../lib/design/request";
import { parseVisionDesign } from "../../../../lib/design/core";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json(
      { error: "Sessão do proprietário necessária." },
      { status: 401, headers },
    );
  if (!sameOrigin(request))
    return Response.json(
      { error: "Origem inválida." },
      { status: 403, headers },
    );
  try {
    const input = designImageRequest(await boundedBody(request, 2100000));
    const result = await executeMedia(input, request.signal, 1200);
    return Response.json(
      {
        spec: parseVisionDesign(result.text),
        model: result.model,
        note: "Proposta aproximada extraída por visão; revise a estrutura antes de gerar arquivos.",
      },
      { headers },
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNAVAILABLE";
    const denied = /BUDGET|NOT_CONFIGURED|MODEL_NOT_IN_ACCOUNT/.test(code);
    const invalid = /INVALID_|BODY_LIMIT/.test(code);
    return Response.json(
      {
        error: denied
          ? "Análise não iniciada: confira autorização, modelo e limites da Abacus."
          : invalid
            ? "Referência inválida ou sem autorização de envio."
            : "A análise não produziu uma estrutura válida. Não houve nova tentativa automática; uma chamada já iniciada pode ter consumo.",
      },
      { status: denied ? 403 : invalid ? 400 : 502, headers },
    );
  }
}
