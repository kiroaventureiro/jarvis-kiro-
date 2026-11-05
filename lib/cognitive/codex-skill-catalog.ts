/** Catalog of the 20 Codex skills installed from wshobson/agents.
 * Adapted metadata/guidance, not an embedded third-party executable runtime.
 * Source pinned in docs/WSHOBSON-AGENTS.md (MIT).
 */
export type CodexSkillGroup = "developer-essentials" | "javascript-typescript" | "security-scanning";
export type CodexSkill = {id:string;group:CodexSkillGroup;description:string;pattern:string;guidance:string};
export const CODEX_SKILL_SOURCE = { repository:"wshobson/agents", revision:"0874a27b17a22e2b7c2e2bcd725768e0803cad06", license:"MIT" } as const;
export const CODEX_SKILLS: readonly CodexSkill[] = [
  {
    "id": "git-advanced-workflows",
    "group": "developer-essentials",
    "description": "Fluxos Git avançados: rebase, cherry-pick, bisect e recuperação.",
    "pattern": "git|rebase|cherry.pick|bisect|branch|merge|conflito",
    "guidance": "Considere histórico, segurança do branch, estratégia de reversão e confirmação do hash final."
  },
  {
    "id": "sql-optimization-patterns",
    "group": "developer-essentials",
    "description": "Otimização SQL, índices e EXPLAIN.",
    "pattern": "sql|consulta|query|indice|index|explain|banco de dados",
    "guidance": "Verifique plano de execução, cardinalidade e índices, sem alegar ganhos não medidos."
  },
  {
    "id": "error-handling-patterns",
    "group": "developer-essentials",
    "description": "Tratamento robusto de falhas e degradação.",
    "pattern": "erro|excecao|falha|timeout|retry|tratamento",
    "guidance": "Distinga falha transitória de permanente, retorno parcial e retentativas idempotentes."
  },
  {
    "id": "code-review-excellence",
    "group": "developer-essentials",
    "description": "Revisão sistemática de código e regressões.",
    "pattern": "review|revisao|revise|auditoria|pull request",
    "guidance": "Priorize bugs e segurança com evidências precisas, sem se limitar à estética."
  },
  {
    "id": "e2e-testing-patterns",
    "group": "developer-essentials",
    "description": "Testes E2E Playwright/Cypress com cenários reais.",
    "pattern": "e2e|ponta a ponta|playwright|cypress|navegador|teste real",
    "guidance": "Cubra trajetória do usuário e falhas reais; simulação não comprova E2E."
  },
  {
    "id": "auth-implementation-patterns",
    "group": "developer-essentials",
    "description": "Autenticação, OAuth, JWT, sessões e permissões.",
    "pattern": "oauth|jwt|login|autenticacao|sessao|permissao|rbac",
    "guidance": "Separe identidade, autorização, escopo, renovação de sessão e proteção de segredos."
  },
  {
    "id": "debugging-strategies",
    "group": "developer-essentials",
    "description": "Depuração sistemática e análise de causa-raiz.",
    "pattern": "debug|depure|bug|diagnostico|erro|travando|lento",
    "guidance": "Compare esperado versus observado, reproduza e isole hipóteses com evidências."
  },
  {
    "id": "monorepo-management",
    "group": "developer-essentials",
    "description": "Organização de monorepositórios e pacotes.",
    "pattern": "monorepo|workspace|multiplos pacotes|pnpm",
    "guidance": "Verifique dependências cruzadas e limites de pacotes, sem migrar estrutura automaticamente."
  },
  {
    "id": "nx-workspace-patterns",
    "group": "developer-essentials",
    "description": "Nx, graph de dependências e cache de tarefas.",
    "pattern": "nx|affected|project graph",
    "guidance": "Avalie configuração Nx, escopo affected e consistência de cache."
  },
  {
    "id": "turborepo-caching",
    "group": "developer-essentials",
    "description": "Cache e pipelines Turborepo.",
    "pattern": "turborepo|turbo|cache remoto|pipeline",
    "guidance": "Verifique entradas/saídas da tarefa e invalidação antes de otimizar cache."
  },
  {
    "id": "bazel-build-optimization",
    "group": "developer-essentials",
    "description": "Bazel, builds herméticos e execução remota.",
    "pattern": "bazel|hermetico|build remoto",
    "guidance": "Confirme reprodutibilidade, dependências explícitas e métricas de build."
  },
  {
    "id": "typescript-advanced-types",
    "group": "javascript-typescript",
    "description": "Tipos avançados TypeScript, genéricos e condicionais.",
    "pattern": "typescript|generics|tipo condicional|tipagem|infer",
    "guidance": "Proteja contratos estáticos e valide entradas também em runtime."
  },
  {
    "id": "nodejs-backend-patterns",
    "group": "javascript-typescript",
    "description": "APIs e servidores Node.js resilientes.",
    "pattern": "node|express|fastify|backend|servidor javascript",
    "guidance": "Revise ciclos assíncronos, limites, autorização e encerramento seguro de recursos."
  },
  {
    "id": "javascript-testing-patterns",
    "group": "javascript-typescript",
    "description": "Testes JS com Jest, Vitest e Testing Library.",
    "pattern": "jest|vitest|testing library|testes? javascript|teste unitario",
    "guidance": "Teste comportamento e casos de falha; separe testes simulados de integração real."
  },
  {
    "id": "modern-javascript-patterns",
    "group": "javascript-typescript",
    "description": "JavaScript moderno, async/await e composição.",
    "pattern": "javascript|ecmascript|es6|async.await|promise",
    "guidance": "Priorize clareza, assincronia segura, compatibilidade e tratamento de rejeições."
  },
  {
    "id": "sast-configuration",
    "group": "security-scanning",
    "description": "Configuração de análise estática de segurança.",
    "pattern": "sast|semgrep|codeql|scanner|analise estatica",
    "guidance": "Oriente análise estática; nunca afirme ter executado scanner sem saída verificável."
  },
  {
    "id": "stride-analysis-patterns",
    "group": "security-scanning",
    "description": "Modelagem STRIDE de ameaças.",
    "pattern": "stride|ameaca|ameacas|threat model|modelagem de ameacas",
    "guidance": "Mapeie spoofing, tampering, repudiation, information disclosure, DoS e elevação de privilégio, com contexto."
  },
  {
    "id": "attack-tree-construction",
    "group": "security-scanning",
    "description": "Árvores de ataque e riscos.",
    "pattern": "arvore de ataque|attack tree|vetor de ataque",
    "guidance": "Identifique objetivos de risco, pré-condições e controles defensivos, sem instruções ofensivas."
  },
  {
    "id": "security-requirement-extraction",
    "group": "security-scanning",
    "description": "Requisitos verificáveis derivados de riscos.",
    "pattern": "requisito de seguranca|criterios de seguranca|aceite de seguranca",
    "guidance": "Transforme riscos em requisitos e critérios de aceite testáveis."
  },
  {
    "id": "threat-mitigation-mapping",
    "group": "security-scanning",
    "description": "Priorização de mitigações e controles.",
    "pattern": "mitigacao|mitigar|risco|vulnerabilidade|vulnerabilidades",
    "guidance": "Relacione risco, impacto, probabilidade e controles proporcionais; identifique incertezas."
  }
];
const normalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function selectCodexSkills(message:string,limit=2):CodexSkill[]{
 const n=normalize(message.slice(0,3000));
 const explicit=CODEX_SKILLS.filter(s=>new RegExp("(?:^|[^a-z0-9-])"+s.id+"(?:$|[^a-z0-9-])").test(n));
 if(explicit.length)return explicit.slice(0,Math.max(0,Math.min(3,limit)));
 const context=/\b(codigo|code|typescript|javascript|node|api|software|aplicativo|repositorio|github|git|deploy|banco|sql|seguranca|vulnerabilidade|testes?|debug|build|monorepo|nx|turbo|bazel|n8n|workflow|estrategia de desenvolvimento)\b/.test(n);
 if(!context)return [];
 const eligible=CODEX_SKILLS.filter(s=>new RegExp("\\b(?:"+s.pattern+")\\b","i").test(n));
 return eligible.slice(0,Math.max(0,Math.min(3,limit)));
}
export function codexSkillsGuidance(message:string):string{
 const chosen=selectCodexSkills(message);
 return chosen.length
  ? "SKILLS DO CODEX APLICADAS AO NÚCLEO JARVIS: "+chosen.map(s=>s.id+": "+s.guidance).join(" ")+" São padrões especializados, não scanners, ferramentas ou subagentes ativos; só alegue execução com prova."
  : "";
}
