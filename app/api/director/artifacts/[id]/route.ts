import { NextResponse } from "next/server";
import { authorized } from "../../../../../../lib/auth";
import { artifactUnavailableMessage, validJarvisArtifactId } from "../../../../../../lib/orchestration/artifact-access";
export const dynamic="force-dynamic";
/** No backing artifact storage is connected yet: never return a fabricated file. */
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
  if (!(await authorized())) return NextResponse.json({error:"Sessão necessária"},{status:401,headers:{"Cache-Control":"no-store"}});
  const {id}=await context.params;
  if (!validJarvisArtifactId(id)) return NextResponse.json({error:"Identificador inválido"},{status:400,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({error:artifactUnavailableMessage()},{status:503,headers:{"Cache-Control":"private, no-store"}});
}
