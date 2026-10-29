import { authorized } from "../../../../lib/auth";
import { commonsResearch } from "../../../../lib/research/images";
import { commonsTitle } from "../../../../lib/research/commons";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!(await authorized()))
    return Response.json(
      { error: "Sessão necessária." },
      { status: 401, headers },
    );
  const title = commonsTitle(new URL(request.url).searchParams.get("title"));
  if (!title)
    return Response.json(
      { error: "Referência inválida." },
      { status: 400, headers },
    );
  try {
    const image = await commonsResearch.image(title, request.signal);
    return image
      ? Response.json(image, { headers })
      : Response.json(
          { error: "A imagem ou a licença não pôde ser verificada." },
          { status: 404, headers },
        );
  } catch {
    return Response.json(
      { error: "Não foi possível verificar a imagem agora." },
      { status: 503, headers },
    );
  }
}
