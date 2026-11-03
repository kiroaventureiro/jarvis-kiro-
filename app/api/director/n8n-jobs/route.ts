import {NextResponse} from "next/server";
import {authorized} from "../../../../lib/auth";
import {requestOriginAllowed} from "../../../../lib/request-origin";
import {enqueue,status} from "../../../../lib/n8n/bridge";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers});
 try{return NextResponse.json(await status(),{headers});}catch{return NextResponse.json({error:"UNAVAILABLE"},{status:503,headers});}
}
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers});
 if(!requestOriginAllowed(request))return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers});
 try{const raw=await request.text();if(raw.length>2400)throw Error("INVALID");
 const body=JSON.parse(raw) as Record<string,unknown>;
 if(typeof body.workflow!=="string"||!body.payload||typeof body.payload!=="object"||Array.isArray(body.payload))throw Error("INVALID");
 return NextResponse.json(await enqueue(body.workflow,body.payload as Record<string,string>),{headers});
 }catch{return NextResponse.json({error:"REQUEST_REJECTED"},{status:400,headers});}
}
