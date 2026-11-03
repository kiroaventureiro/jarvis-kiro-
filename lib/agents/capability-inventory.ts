export const EXISTING_LOCAL_SKILLS = ["projects.list", "projects.details", "creative.continuity", "creative.scenes"] as const;
export const SPECIALISTS = ["debugging", "review", "testing", "security", "typescript"] as const;
export const EXTERNAL_CANDIDATES = [
"thedotmack/claude-mem","Donchitos/Claude-Code-Game-Studios",
"nightly-labs/openbot","obra/superpowers","JetBrains/thinkrail",
"elayadesign/ai-design-skills","milind-soni/OpenMausBot","HKUDS/DeepTutor",
"pbakaus/impeccable","storytold/photocraft","tashfeenahmed/freellmapi",
"KnifeLemon/Filee","heygen-com/hyperframes","wheresryan22/anatomy",
"JuliusBrussee/caveman","PaddlePaddle/PaddleOCR","tesseract-ocr/tesseract",
"ggml-org/whisper.cpp","mebjas/html5-qrcode","cfahlgren1/webllm-playground",
"mug-jp/maplibregljs-starter","dream-num/univer","rclone/rclone",
"opencv/opencv","penpot/penpot","hoppscotch/hoppscotch",
"makeplane/plane","openobserve/openobserve","apache/superset",
"medusajs/medusa","dgtlmoon/changedetection.io","docmost/docmost"
] as const;
export function capabilityInventory() {
 return {
  schemaVersion: 1,
  local: EXISTING_LOCAL_SKILLS.map(id => ({id, state:"implemented", execution:"authenticated_local_route"})),
  specialists: SPECIALISTS.map(id => ({id, state:"guidance_only", execution:"not_an_independent_agent"})),
  external: EXTERNAL_CANDIDATES.map(repository => ({id:repository.toLowerCase(),repository,state:"candidate_not_installed",execution:"not_connected"})),
  guarantees: {externalReposNeverAutoExecute:true,noImplicitPermissionInheritance:true,noSecretsInResponse:true,noRemoteExecutorClaimed:true},
 };
}
