import "server-only";
export const SOCIAL_METRIC_PLAN = {
 youtube: {readOnly:true,connected:false,requiresApprovalForPublishing:true},
 instagram: {readOnly:true,connected:false,requiresApprovalForPublishing:true},
 tiktok: {readOnly:true,connected:false,requiresApprovalForPublishing:true},
} as const;
export function listSocialReadiness(){
 return Object.entries(SOCIAL_METRIC_PLAN).map(([provider,settings])=>({provider,...settings,verified:false}));
}
