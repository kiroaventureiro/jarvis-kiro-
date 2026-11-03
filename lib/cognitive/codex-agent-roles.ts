/** Specialist role catalog derived from the four agent source profiles shipped
 * with the three Codex plugins installed by the owner.
 * Source: wshobson/agents @ 0874a27b17a22e2b7c2e2bcd725768e0803cad06 (MIT).
 * A specialist profile is a bounded perspective, never an autonomous runtime.
 */
export const CODEX_AGENT_SOURCE={
 repository:"wshobson/agents",
 revision:"0874a27b17a22e2b7c2e2bcd725768e0803cad06",
 license:"MIT"
} as const;
export type AgentRole={
 id:string;
 plugin:"developer-essentials"|"javascript-typescript"|"security-scanning";
 sourcePath:string;
 sourceModel:string;
 purpose:string;
 match:string;
 instructions:string;
};
export const CODEX_AGENT_ROLES:readonly AgentRole[]=[
 {id:"monorepo-architect",plugin:"developer-essentials",
 sourcePath:"plugins/developer-essentials/agents/monorepo-architect.md",sourceModel:"opus",
 purpose:"Planejar e revisar monorepos, ferramentas de build e grafo de dependências.",
 match:"monorepo|nx|turborepo|bazel|lerna|workspace|multi.?projeto|dependencias entre pacotes|cache de build",
 instructions:"Atue como revisor de arquitetura de monorepositório: identifique limites dos projetos, grafo de dependências, estratégia de cache e impacto nas pipelines. Não migre nem altere recursos sem plano aprovado; fundamente recomendações em arquivos consultados."},
 {id:"javascript-pro",plugin:"javascript-typescript",
 sourcePath:"plugins/javascript-typescript/agents/javascript-pro.md",sourceModel:"inherit",
 purpose:"Especialização em JavaScript moderno, event loop, Node.js e concorrência assíncrona.",
 match:"javascript|node\\.js|nodejs|async|promise|event loop|microtask|es6|ecmascript|js",
 instructions:"Atue como especialista JavaScript: analise promessas, event loop, corridas assíncronas, compatibilidade de ambientes, tratamento de erros e desempenho. Separe hipóteses de testes observados; não diga que executou código sem evidência."},
 {id:"typescript-pro",plugin:"javascript-typescript",
 sourcePath:"plugins/javascript-typescript/agents/typescript-pro.md",sourceModel:"opus",
 purpose:"Especialização em TypeScript, tipos avançados e contratos de execução.",
 match:"typescript|tsconfig|tipagem|generics|generic|tipos condicionais|type inference|infer",
 instructions:"Atue como especialista TypeScript: examine tipos condicionais, genéricos, inferência, strict mode e tipagem de erros. Type safety não substitui validação em runtime; preserve compatibilidade e não afirme compilar sem teste."},
 {id:"threat-modeling-expert",plugin:"security-scanning",
 sourcePath:"plugins/security-scanning/agents/threat-modeling-expert.md",sourceModel:"opus",
 purpose:"Modelagem defensiva de ameaças STRIDE, limites de confiança e mitigação.",
 match:"stride|ameacas|ameaca|threat|modelo de seguranca|modelagem de risco|arvore de ataque|attack tree|superficie de ataque|risco de seguranca",
 instructions:"Atue como especialista em modelagem defensiva: delimite ativos e fronteiras de confiança, considere categorias STRIDE, riscos, requisitos verificáveis e mitigações. Não alegue varredura automática nem acesso privilegiado; preserve a segurança da operação."}
];
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function selectCodexAgents(message:string,limit=2):AgentRole[]{
 const n=normalize(message.slice(0,3000));
 const engineering=/\b(codigo|code|sistema|arquitetura|aplicativo|app|software|api|desenvolvimento|seguranca|repositorio|projeto|build|typescript|javascript|node|monorepo|nx|turborepo|bazel|ameaca|stride|tipagem|promise|async|erro|debug|risco|teste)\b/.test(n);
 if(!engineering)return [];
 return CODEX_AGENT_ROLES.filter(role=>new RegExp("\\b(?:"+role.match+")\\b","i").test(n)).slice(0,Math.max(0,Math.min(2,limit)));
}
export function codexAgentGuidance(message:string):string{
 const roles=selectCodexAgents(message);
 return roles.length?
  "PERSPECTIVAS DE AGENTES ESPECIALISTAS DO CODEX (incorporadas ao núcleo, sem execução independente): "+
  roles.map(role=>role.id+": "+role.instructions).join(" ")+
  " O Jarvis permanece o decisor e verificador. Cada papel é orientação contextual, não uma credencial, scanner, processo paralelo, agente remoto ou aprovação.":
  "";
}
