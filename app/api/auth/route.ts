import { NextResponse } from "next/server";
import { cookieName,passwordMatches,session } from "../../../lib/auth";
export async function POST(req:Request){const body=await req.json().catch(()=>({}));if(typeof body.password!=="string" || !passwordMatches(body.password))return NextResponse.json({error:"Senha inválida."},{status:401});const result=NextResponse.json({ok:true});result.cookies.set(cookieName,session(),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:86400});return result;}
