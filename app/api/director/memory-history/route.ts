import {NextResponse} from "next/server";
import {authorized} from "../../../../lib/auth";
import {memoryConfigured,readServerMemory,writeServerMemory,clearServerMemory} from "../../../../lib/server-memory";
export const dynamic="force-dynamic";
const respond=(value:object,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 if(!(await authorized()))return respond({error:"Não autorizado"},401);
 if(!memoryConfigured())return respond({configured:false,history:[],note:"Memória sincronizada não configurada"});
 try{return respond({configured:true,history:await readServerMemory()})}catch{return respond({error:"Memória temporariamente indisponível"},503)}
}
export async function PUT(request:Request){
 if(!(await authorized()))return respond({error:"Não autorizado"},401);
 if(!memoryConfigured())return respond({error:"Memória sincronizada não configurada"},503);
 let input:unknown;try{input=await request.json()}catch{return respond({error:"JSON inválido"},400)}
 if(!input||typeof input!=="object"||!Array.isArray((input as {history?:unknown}).history))return respond({error:"Histórico inválido"},400);
 const values=(input as {history:unknown[]}).history;
 if(values.length>20||JSON.stringify(values).length>20000||!values.every(v=>!!v&&typeof v==="object"&&["user","assistant"].includes((v as {role?:string}).role??"")&&typeof (v as {content?:unknown}).content==="string"&&(v as {content:string}).content.length<=800))return respond({error:"Histórico excede limites"},400);
 try{return respond({saved:await writeServerMemory(values as {role:"user"|"assistant";content:string}[])})}catch{return respond({error:"Não foi possível salvar"},503)}
}
export async function DELETE(){
 if(!(await authorized()))return respond({error:"Não autorizado"},401);
 if(!memoryConfigured())return respond({error:"Memória sincronizada não configurada"},503);
 try{await clearServerMemory();return respond({cleared:true})}catch{return respond({error:"Não foi possível apagar"},503)}
}
