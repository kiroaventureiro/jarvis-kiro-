import {NextResponse} from "next/server";
import {authorized} from "../../../../lib/auth";
import {planAIProviders,type AIMode} from "../../../../lib/ai-provider-selector";
export const dynamic="force-dynamic";
const allowed=["chat","voice","code","research","images","video","audio","music","design"];
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const mode=new URL(request.url).searchParams.get("mode")??"chat";
 if(!allowed.includes(mode))return NextResponse.json({error:"Categoria inválida"},{status:400});
 return NextResponse.json({...planAIProviders(mode as AIMode),note:"Roteamento planejado, sem execução ou cobrança."},{headers:{"Cache-Control":"no-store"}});
}
