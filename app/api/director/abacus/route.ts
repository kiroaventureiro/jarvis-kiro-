import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { askAbacus } from "../../../../lib/abacus-routellm";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({provider:"abacus",configured:!!process.env.ABACUS_API_KEY,
 active:false,model:"route-llm",note:"Apenas chamadas explícitas por POST; nenhuma integração automática habilitada."},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 if(!process.env.ABACUS_API_KEY)return NextResponse.json({error:"Chave Abacus não configurada no servidor"},{status:503});
 let data:unknown;
 try{data=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}
 if(!data||typeof data!=="object"||Array.isArray(data))return NextResponse.json({error:"Pedido inválido"},{status:400});
 const {message}=data as {message?:unknown};
 if(typeof message!=="string"||message.trim().length<1||message.length>1500)
 return NextResponse.json({error:"Mensagem inválida"},{status:400});
 try{const reply=await askAbacus(message);return NextResponse.json(reply,{headers:{"Cache-Control":"no-store"}})}
 catch{return NextResponse.json({error:"Falha na solicitação à Abacus"},{status:502})}
}
