/** Local companion command contract. Planning and validation only: no OS access in website. */
export type CompanionCapability = "open_file_picker"|"save_download"|"window_focus"|"window_minimize"|"audio_volume";
export type CompanionRequest = {
  requestId:string;
  capability:CompanionCapability;
  userApproved:boolean;
  issuedAt:number;
  expiresAt:number;
  payload:Record<string,unknown>;
};
const allowed:CompanionCapability[]=["open_file_picker","save_download","window_focus","window_minimize","audio_volume"];
export function validateCompanionRequest(request:CompanionRequest,now:number):boolean {
  if(!request||!allowed.includes(request.capability)||request.userApproved!==true)return false;
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(request.requestId))return false;
  if(!Number.isFinite(request.issuedAt)||!Number.isFinite(request.expiresAt)||request.issuedAt>now+5000||
    request.expiresAt<=now||request.expiresAt-request.issuedAt>60000)return false;
  if(!request.payload||typeof request.payload!=="object"||Array.isArray(request.payload))return false;
  return Object.keys(request.payload).length<=8;
}
export const companionStatus={desktopConnected:false,browserExtensionConnected:false,canAccessLocalFiles:false} as const;
