# Issue #4 — integração MCP/conector

Investigação de 29/10/2026 na branch `feature/diretor-tecnico-agent`.
Escopo: https://github.com/kiroaventureiro/jarvis-kiro-/issues/4.
Sem inferência, credenciais solicitadas, instalação, deploy ou ativação de cobrança.

## Mecanismos verificados e limites

| Mecanismo | O que oferece | Serve para delegar do Jarvis usando automaticamente a conta Plus? |
| --- | --- | --- |
| Codex como cliente MCP | Consome ferramentas de servidores STDIO/HTTP, com autenticação por servidor | Não; a direção é Codex → ferramentas Jarvis |
| Antigo `codex mcp-server` | Removido na documentação atual e ausente do help do CLI 0.163.0 instalado | Não é uma solução atual a instalar |
| MCP público de documentação OpenAI | Pesquisa/leitura de documentação | Não executa tarefas |
| Plugins/conectores presentes neste chat | Capacidades concedidas ao cliente deste chat | Não concedem permissões ao backend Jarvis; não foi localizada ferramenta de delegação Cloud entre as ferramentas disponíveis |
| Codex app-server / SDK | Controle programático de threads, eventos e resultados em processo de execução próprio | São mecanismos oficiais; ainda exigem runtime, isolamento e autenticação próprios. Não equivalem a conector Cloud hospedado |
| Agents API | API oficial com harness Codex gerenciado, sessões, eventos e artefatos | Exige permissões de API; modelos, ferramentas e sandbox hospedado têm cobrança de API. Não foi ativada |
| `codex cloud` | CLI experimental de tarefas Cloud | A consulta de leitura falhou no transporte neste processo; criação e vínculo ao Jarvis não comprovados |

Não foi encontrado nas fontes consultadas um conector MCP oficial hospedado que
permita a um backend externo criar/acompanhar/recuperar tarefas Codex Cloud usando
automaticamente a sessão Plus deste chat. Isso não significa inexistência de toda
API de execução: a Agents API existe, mas tem autorização e cobrança distintas.
O app-server usa JSON-RPC próprio; isso, sozinho, não o torna um servidor MCP.

Fontes oficiais consultadas:

- https://developers.openai.com/codex/mcp — configuração do Codex como cliente MCP.
- https://developers.openai.com/codex/sdk — SDK e remoção do antigo servidor MCP.
- https://developers.openai.com/codex/app-server — protocolo, autenticação e eventos.
- https://developers.openai.com/learn/docs-mcp — MCP somente de documentação.
- https://developers.openai.com/api/docs/guides/agents-api/overview — execução gerenciada e cobrança.

Documentação online pode descrever capacidades mais recentes que o CLI instalado;
a presença de um mecanismo documentado não comprova acesso da conta neste runtime.

## Menor interface MCP do lado Jarvis — proposta, não endpoint publicado

Não criar outro armazenamento, máquina de estados, executor ou abstração de fila.
Um adaptador MCP autenticado poderia expor somente estas três ferramentas:

| Ferramenta proposta | Reutilização existente | Semântica |
| --- | --- | --- |
| `codex_capabilities` | `codexWorkerReadiness()` / GET `/api/director/codex` | Informa `not_connected`; sem inferência |
| `codex_prepare_task` | POST `/api/director/codex`, `planCodexDelegation`, `createCodexTask` | Cria somente rascunho persistido; `started:false`, `queued:false`; não é tarefa Cloud |
| `codex_get_task` | GET `/api/director/codex/tasks/[id]`, `getCodexTask` | Consulta estado e `resultReference` registrado; sem resultado verificado, não anuncia conclusão remota |

Preparação aceita `kind`, `task` e apenas o repositório/branch autorizados; consulta
aceita UUID de tarefa pertencente ao escopo autorizado. O adaptador precisa impor
autenticação e escopos próprios em cada chamada e preservar os limites existentes.
Não encaminhar cookies deste chat nem presumir que a sessão do navegador Jarvis
funcione como OAuth para um cliente MCP. Não expor instruções privadas por endpoint
anônimo. `codex_prepare_task` é uma escrita, não deve ser anunciada como read-only.

Não expor aprovação, dispatch, execução de shell nem ingestão arbitrária de resultados
nessa primeira interface. A aprovação continua pelo fluxo existente; ingestão remota
necessita autenticação do executor e vínculo verificável entre tarefa, commit e resultado.
Conectar Codex a esse MCP permitiria ao Codex consultar/preparar tarefas no Jarvis;
isso não faria o Jarvis iniciar o Codex sem um canal de execução adicional.

## Melhoria implementada e evidência real

O diagnóstico existente agora distingue `cloud_transport_failed` de rejeição 401/403,
timeout e erro genérico, sem imprimir mensagens brutas potencialmente sensíveis.
Não altera permissões nem promove o executor a conectado.

- `codex --help` e `codex mcp --help`: cliente MCP presente; `mcp-server` ausente.
- Issue e comentários consultados pelo conector GitHub; nenhum comentário existente.
- Busca da branch pelo conector GitHub confirmou seu nome, sem fornecer SHA.
- `git ls-remote --exit-code origin refs/heads/feature/diretor-tecnico-agent`:
  saída 128, falha de conexão ao proxy na porta 8080. Não se confirmou o SHA remoto atual.
- `node tests/codex-cloud-diagnostic.test.mjs`: 5 testes passaram.
- `node scripts/codex-cloud-diagnostic.mjs`: saída 1, `cloud_transport_failed`,
  `cloudAuthentication:not_verified`, `taskCreationVerified:false`,
  `jarvisExecutorConnected:false`. As cinco configurações Jarvis verificadas por
  presença estavam ausentes; nenhum valor secreto foi lido ou registrado.

Os testes de diagnóstico usam respostas controladas para verificar classificação,
confidencialidade e comandos somente leitura; não comprovam acesso remoto.

## Ponto de parada e próximo passo único

Não publicar nem cadastrar um servidor MCP, nem iniciar execução. O backend ainda
não dispõe neste processo de sessão, cofre e assinatura configurados; um conector
remoto também precisa de URL de teste acessível e autorização suportada por cliente.
Não usar chaves de API como substituição silenciosa da conta Plus.

Quando retornar, o proprietário poderá autorizar uma validação em ambiente de teste
na nuvem, sem produção, com autenticação própria do conector e cofre configurado por
meio seguro. Esse é o próximo passo único para a interface Jarvis proposta; nenhuma
credencial deve ser enviada pelo chat. Ele ainda não autoriza inferência ou cobrança.
Se o requisito for especificamente Jarvis → execução Codex sem intervenção,
o canal de execução e sua cota terão de ser aprovados separadamente antes do primeiro job.

Não foram criados commits nem efetuado push: o SHA remoto não pôde ser verificado.
As melhorias permanecem locais na branch experimental para revisão.
