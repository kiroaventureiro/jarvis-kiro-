import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { askNavi, NaviError, safeNaviHistory } from "../../../../lib/openai/navi-executor";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Sessão necessária" }, {status:401});
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({error:"Origem inválida"}, {status:403});
  if (Number(request.headers.get("content-length") || 0) > 36000)
    return NextResponse.json({error:"Pedido muito grande"}, {status:413});
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 36000) return NextResponse.json({error:"Pedido muito grande"}, {status:413});
    body = JSON.parse(raw);
  } catch { return NextResponse.json({error:"JSON inválido"}, {status:400}); }
  if (!body || typeof body !== "object") return NextResponse.json({error:"Pedido inválido"}, {status:400});
  const b = body as Record<string, unknown>;
  try {
    const history = safeNaviHistory(b.history);
    if (typeof b.message !== "string") return NextResponse.json({error:"Mensagem inválida"}, {status:400});
    const result = await askNavi(b.message, history, {env:process.env,signal:request.signal});
    return NextResponse.json({available:true, text:result.text, model:result.model, provider:"openai_navi", usage:null}, {headers:{"Cache-Control":"private, no-store"}});
  } catch (e) {
    const code = e instanceof NaviError ? e.code : "UNAVAILABLE";
    const message: Record<string, string> = {
      DISABLED:"Ponte Navi não habilitada.",
      NOT_CONFIGURED:"A OpenAI API não está configurada.",
      BILLING_NOT_AUTHORIZED:"A cobrança independente da OpenAI API ainda não foi autorizada.",
      INVALID_RESPONSE:"Pedido ou resposta inválida.",
      UNAVAILABLE:"Não consegui acessar o provedor agora.",
    };
    return NextResponse.json({error:message[code] || message.UNAVAILABLE}, {status:code==="DISABLED"||code==="NOT_CONFIGURED"||code==="BILLING_NOT_AUTHORIZED"?503:code==="INVALID_RESPONSE"?400:502,headers:{"Cache-Control":"private, no-store"}});
  }
}
