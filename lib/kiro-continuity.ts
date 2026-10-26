import "server-only";
import catalog from "../config/kiro-continuity-rules.json";
export type ContinuitySeverity="hard"|"default";
export function projectContinuity(project:string){
 return catalog.rules.filter(r=>r.project===project).map(r=>({...r,source:"curated_owner_brief",liveVerified:false}));
}
export function continuityChecklist(project:string){
 const rules=projectContinuity(project);
 return {project,source:"curated_seed",rules,needsEditorialReview:catalog.reviewRequiredForNewCanon,
 generationExecuted:false};
}
export const CONTINUITY_POLICY={mayAutoPublish:false,mayOverwriteCanon:false,
 mayUseExternalContentWithoutConsent:false,characterIdentityReviewRequired:true} as const;
