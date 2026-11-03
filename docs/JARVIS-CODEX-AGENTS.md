# Jarvis Skill — agentes dos plugins Codex

**Origem examinada:** `wshobson/agents` revisão `0874a27b17a22e2b7c2e2bcd725768e0803cad06`, licenciada MIT. Os plugins instalados pelo proprietário no Codex foram `developer-essentials` 1.0.4, `javascript-typescript` 1.2.3 e `security-scanning` 1.3.2.

## Quatro agentes identificados nesses plugins

| Agente | Plugin | Tarefa especializada | Estado no Jarvis |
| --- | --- | --- | --- |
| `monorepo-architect` | developer-essentials | Monorepo, Nx, Turborepo, Bazel, dependências | Perfil contextual selecionável |
| `javascript-pro` | javascript-typescript | Concorrência, event loop, Node.js, async | Perfil contextual selecionável |
| `typescript-pro` | javascript-typescript | Tipos avançados, contratos e compilação | Perfil contextual selecionável |
| `threat-modeling-expert` | security-scanning | Riscos STRIDE, fronteiras de confiança e mitigação | Perfil contextual selecionável |

Os arquivos-fonte originais permanecem no repositório upstream, com caminhos precisos e revisão fixada em `lib/cognitive/codex-agent-roles.ts`. O adaptador de orientação foi escrito para o Jarvis a partir desses papéis.

## Integração entregue

- `lib/cognitive/codex-agent-roles.ts`: 4 papéis, missão, seletor contextual e diretriz limitada.
- `lib/cognitive/protocol.ts`: integra as perspectivas de agente no mesmo protocolo da persona universal (texto, e canais que recebem este protocolo) sem chamar modelos adicionais automaticamente.
- `GET /api/director/local-skills`: agora apresenta as 20 skills, 4 operações nativas e 4 perfis de agentes, mediante autenticação do proprietário. Os perfis têm `independentExecution:false`.
- `tests/codex-agent-roles.test.mjs`: valida inventário, seleção e limites.
- Interface, voz, permissões e produção não são alteradas por esses perfis.

## Ativação de agentes executores independentes — ainda pendente

O Codex instalado no PC registrou skills nativas; os agentes TOML gerados não foram instalados nem disponibilizados remotamente. A Vercel não executa o Codex CLI do Windows por essa configuração. Para transformar perfis em agentes independentes, é preciso implementar um executor realmente hospedado/autorizado, contrato de delegação, orçamento de chamadas, retorno de evidências, isolamento de ações e aprovação específica para mutações. O Conselho experimental do Jarvis já tem limites de chamadas e autorização por orçamento, mas **não representa quatro processos de agente nem autoriza automaticamente sua execução**.

## Acessos e autorizações

Uma integração cadastrada pode continuar limitada por token, scopes, recursos concedidos, origem do ambiente, autorização da instalação GitHub, credenciais do cofre, validade do OAuth e disponibilidade de API. Nenhuma skill/agent consegue contornar um token com escopo de leitura. O plano seguro é inspecionar cada conexão real, comparar `connected`, `verified`, `grants`, `resources` e o resultado de uma chamada de prova; então solicitar exclusivamente o novo escopo ou autorização necessário. Não exibir chaves, não expandir acesso irrestritamente, não mexer na produção sem aprovação.

**O que está validado aqui:** presença das definições no repositório e build de pré-produção. Não foram comprovados subprocessos especializados, uso de um modelo extra, execução de scanners ou teste de todos os serviços de terceiros.
