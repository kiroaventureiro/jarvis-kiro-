import {NextResponse} from "next/server";
import {bridgeAuth,lease,finish,bridgeEnabled} from "../../../../lib/n8n/bridge";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){
 if(!bridgeAuth(request.headers.get("authorization")))return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 try{return NextResponse.json(await lease(),{headers});}catch{return NextResponse.json({error:"BRIDGE_UNAVAILABLE"},{status:503,headers});}
}
export async function POST(request:Request){
 if(!bridgeAuth(request.headers.get("authorization")))return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 if(!bridgeEnabled())return NextResponse.json({error:"BRIDGE_UNAVAILABLE"},{status:503,headers});
 try{
 const raw=await request.text();if(raw.length>3000)throw Error("LIMIT");
 const data=JSON.parse(raw) as Record<string,unknown>;
 if(typeof data.id!=="string"||typeof data.ok!=="boolean"||typeof data.result!=="string")throw Error("INVALID");
 return NextResponse.json(await finish(data.id,data.ok,data.result),{headers});
 }catch{return NextResponse.json({error:"INVALID_RESULT"},{status:400,headers});}
}
