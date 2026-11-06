/** Simple local capability questions, not a general intent router. */
export function capabilityQuestion(input:string):"codex"|"navi"|"companion"|null {
 const s=input.toLowerCase();
 if(!/(dispon[ií]vel|conectad|habilitad|funcionando|consegue usar|pode usar|status|situa[cç][aã]o)/.test(s))return null;
 if(/codex/.test(s))return "codex";
 if(/chatgpt|openai|navi/.test(s))return "navi";
 // The supervised browser extension is independent of the desktop companion.
 // Let the authenticated connector status answer these questions.
 if(/navegador|chrome|edge|extens[aã]o/.test(s) && !/companion|windows/.test(s))return null;
 if(/windows|computador|extens[aã]o|companion/.test(s))return "companion";
 return null;
}
