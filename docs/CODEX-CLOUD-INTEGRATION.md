# Jarvis ↔ Codex Cloud: estado verificado

Verificação de 29/10/2026, na branch `feature/diretor-tecnico-agent`.
**Não há conexão operacional autenticada com o executor Codex Cloud neste ambiente.**
Nenhuma tarefa remota foi criada, nenhum serviço pago foi ativado e nada foi publicado.

## Análise prática do sistema

O projeto é um aplicativo Next.js 15/React 19. `app/components/JarvisExperience.tsx`
coordena conversa, voz, anexos, resultados e alertas. Há rotas e módulos separados para
autenticação/passkeys, pesquisa, memória, workspace, Abacus, Navi, conectores e criação
visual. Esta alteração se limita ao fluxo Codex; não substitui esses recursos.

O fluxo Codex existente já continha:

- Planejamento e identificação de intenção em `lib/codex/conversation.ts` e `chat-intent.ts`.
- Criação de rascunhos em `POST /api/director/codex`, restrita ao repositório Jarvis e à branch experimental.
- Aprovação explícita por conversa em `JarvisExperience.tsx` e na rota `/codex/approve`.
- Máquina de estados em `task-lifecycle.ts` e persistência em `task-store.ts` usando o
  cofre Supabase criptografado com revisão CAS, sem fallback de produção em memória.
- Primitivas HMAC de comprovantes e envelopes, proteção contra replay e validação de handoff.
  A aceitação de envelope não constitui execução nem autenticação real de um worker.
- Consulta autenticada em `/codex/tasks/[id]`, apresentação de resultados e alertas
  visuais/falados com polling e deduplicação na interface.
- Encaminhamento em `/codex/dispatch` deliberadamente bloqueado, e descoberta de
  capacidades que informa `not_connected`.

As peças de segurança não eram um executor: faltam o adaptador autenticado, uma fila
operacional de execução, checkout isolado e ingestão autenticada de resultados. O cofre
de tarefas tampouco é, por si só, uma fila de execução.

## Evidência do bloqueio

| Verificação real | Resultado |
| --- | --- |
| CLI instalado | `codex-cli 0.163.0` |
| `codex cloud --help` | Oferece `exec`, `list`, `status`, `diff` e `apply`; interface experimental |
| `codex login status` | Informa login ChatGPT; isso não prova autorização do Cloud |
| `codex cloud list --json --limit 1`, com acesso de rede autorizado | HTTP 401; o serviço rejeitou o token de autenticação |
| Ferramentas disponibilizadas neste chat | Nenhuma ferramenta de criação/consulta de tarefas Codex Cloud; as ferramentas de ambiente administram este runtime |
| Configuração do Jarvis neste processo | Ausentes as cinco variáveis verificadas abaixo |

Variáveis verificadas somente por presença, sem ler arquivos de credenciais ou exibir valores:

```text
JARVIS_SESSION_SECRET
JARVIS_CONNECTOR_STORE_URL
JARVIS_CONNECTOR_STORE_KEY
JARVIS_CONNECTOR_ENCRYPTION_KEY
JARVIS_CODEX_WORKER_SIGNING_SECRET
```

O flag `JARVIS_CODEX_WORKER_ENABLED` também foi verificado
separadamente e estava ausente. Sua ativação não conecta um executor.
Os resultados descrevem este processo, não as configurações do Jarvis em produção.
A autenticação GitHub que permitiu buscar a branch não concede autenticação Codex Cloud.
O identificador deste runtime gerenciado não foi tratado como um environment ID do Codex Cloud.

O teste HTTP 401 foi feito com rede autorizada fora da restrição do sandbox. Assim,
não se trata apenas do erro anterior de conexão com o proxy. Não houve tentativa de
extrair/reutilizar tokens do ChatGPT, chamar endpoints internos diretamente ou criar
uma tarefa paga para testar permissões.

## Componentes implementados e utilizáveis

1. `scripts/codex-cloud-diagnostic.mjs`: diagnóstico somente leitura pelo CLI oficial,
   com limites de tempo/tamanho, sem shell e sem imprimir saídas brutas ou dados das tarefas.
   Só considera leitura autenticada confirmada depois de uma resposta JSON válida de `cloud list`.
   Mesmo nesse caso, não declara permissão de criar tarefas nem conexão do Jarvis.
2. `lib/codex/task-approval.ts`: aprovação com estado e escopo revalidados **dentro**
   da atualização CAS do cofre. Quando a chave de assinatura já está configurada,
   tarefa e comprovante são gravados juntos. A assinatura fica no cofre; não é devolvida ao navegador.
3. Comprovante vinculado por SHA-256 ao ID, repositório, branch, tipo e instrução exatos.
   Alterações nesses campos invalidam a autorização. Validade máxima: cinco minutos.
   Assinaturas antigas sem digest continuam verificáveis pela primitiva legada, mas
   não são aceitas pelo novo verificador de aprovação de tarefa.
4. Sem chave de assinatura, a aprovação por conversa continua funcionando quando o
   cofre está disponível, com `approvalReceipt: "signing_key_missing"`; ela não constitui
   autorização criptográfica para execução. O segredo nunca é criado automaticamente.
5. A rota de encaminhamento continua retornando 503 sem iniciar ou enfileirar tarefas.
   Ela verifica o comprovante persistido e informa `approvalVerified` junto do bloqueio
   de disponibilidade. Essa checagem não substitui o worker, replay, fila ou verificação
   de resultados, e uma aprovação válida não habilita o envio.

## Demonstração reproduzível

```bash
npm run diagnose:codex
```

Executar em um contexto com acesso de rede autorizado e o CLI oficial configurado.
Não faz login, não lê arquivos de segredos, não chama `cloud exec` e não aplica diffs.
Se configurações forem mantidas em arquivos `.env`, elas não são carregadas por esse
script; o relatório considera apenas o ambiente do processo.
Resultado observado neste ambiente:

```json
{
  "cliInstalled": true,
  "cliVersion": "0.163.0",
  "cloudCommandsAvailable": true,
  "cloudAuthentication": "rejected",
  "taskCreationVerified": false,
  "jarvisExecutorConnected": false,
  "blocker": "cloud_authentication_rejected"
}
```

O código de saída 1 nesse caso é intencional. Código 0 significa somente leitura
autenticada confirmada; não significa que a integração de execução esteja pronta.

```bash
node --test tests/codex-operational-flow.test.mjs tests/codex-cloud-diagnostic.test.mjs
npm test
npx tsc --noEmit --incremental false
```

O teste operacional chama as implementações reais das rotas e regras com um cofre e
sessão **explicitamente isolados em teste**. Demonstra rascunho → aprovação → assinatura
→ recusa do envio → consulta e alerta, além de adulteração, expiração, origem inválida,
falta de sessão e aprovação duplicada. Não demonstra persistência no Supabase real nem
execução, callback ou resultado do Codex Cloud. Esses serviços não foram simulados
como se estivessem conectados.

## O que falta para uma conexão real

O responsável pelo ambiente precisa disponibilizar uma identidade suportada cujo
acesso ao Codex Cloud passe pelo diagnóstico de leitura. Não envie tokens pelo chat.
Também é necessário confirmar um environment ID Codex Cloud vinculado ao repositório
correto e uma forma suportada de autenticação do processo que executará o adaptador;
a sessão deste chat não deve ser copiada para o Jarvis/Vercel.

O Jarvis requer sessão e cofre dedicado configurados para persistência real. Depois,
será necessário implementar e validar um adaptador isolado para envio, reconciliação
de tarefas, execução sem duplicatas, cancelamento e retorno autenticado de resultados.
O CLI instalado anuncia comandos, mas a autorização real de criação e seus custos
permanecem não verificados. Qualquer validação que consuma créditos precisa respeitar
a restrição atual de não habilitar serviços pagos.

Até lá, mantenha `not_connected`. Não há URL de API presumida, callback público,
worker fictício ou flag que converta configuração em comprovação de funcionamento.
