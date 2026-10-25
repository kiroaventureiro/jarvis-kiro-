import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
const NAME="jarvis_session";
function signature(exp:string){const secret=process.env.JARVIS_SESSION_SECRET;if(!secret || secret.length<32)return "";return createHmac("sha256",secret).update(exp).digest("hex");}
export function valid(value?:string){if(!value)return false;const [expiry,mac]=value.split(".");if(!/^\d+$/.test(expiry||"") || Number(expiry)<Date.now())return false;const expected=signature(expiry);return !!expected && !!mac && mac.length===expected.length && timingSafeEqual(Buffer.from(mac),Buffer.from(expected));}
export async function authorized(){return valid((await cookies()).get(NAME)?.value)}
export function session(){const expiry=String(Date.now()+86400000);return expiry+"."+signature(expiry)}
export function passwordMatches(pass:string){const expected=process.env.JARVIS_ACCESS_PASSWORD;if(!expected || expected.length<12)return false;const hash=(v:string)=>createHmac("sha256","jarvis-password").update(v).digest();return timingSafeEqual(hash(pass),hash(expected))}
export const cookieName=NAME;
