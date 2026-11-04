# Execução HML: alterações aplicadas e validação

## Aplicado no banco HML

Instalados os scripts `HML-EXECUTION-MIGRATION.sql` e `HML-RECOVERY-MIGRATION.sql`. Adicionadas tabelas de aprovações, tentativas, eventos, outbox e agendamento de retry. Funções `record_approval`, `begin_attempt`, `complete_simulated_success`, `record_failure` e `recover_jobs` implementadas para capacidades `simulation.*`.

Nada foi instalado no banco do Jarvis ou em produção. O papel PUBLIC não recebeu execução nas funções novas. O executor segue exclusivamente simulado.

## Aplicado no n8n

- Entrada publicada anteriormente com chamada parametrizada de `register_command`.
- Consulta de diagnóstico da reserva substituída por `reserve_jobs` com limites e identidades fixas; testada no editor.
- Três workflows previamente inativos (`Controle de aprovações`, `Despachante`, `Registro de falhas`) receberam as referências da credencial PostgreSQL HML existente nos nós de banco. No Registro de falhas, habilitada apenas a operação de banco HML.
- Nenhum webhook novo de aprovação foi publicado. A autenticação própria de aprovação ainda está pendente.
- O despachante é manual e não foi transformado em agendador automático.

## Testes

- `tests/hml-execution.sql`: aprovação vinculada, replay, reserva, token incorreto, exclusão de tentativa duplicada, sucesso/outbox e falhas transitória/permanente/incerta. Passou, com ROLLBACK.
- `tests/hml-recovery.sql`: atraso entre retries, recuperação, três tentativas e quarentena. Passou, com ROLLBACK.
- Quatro tarefas explicitamente sintéticas foram registradas em HML para testes reais via editor do n8n. O despachante executou o simulador e os subfluxos. Confirmação no PostgreSQL:

| Cenário | Estado do comando | Estado da tentativa |
| --- | --- | --- |
| success | succeeded | succeeded |
| transient | retry_wait | retry_wait |
| permanent | failed | failed |
| uncertain | reconciliation_required | reconciliation_required |

O caso de sucesso gerou um único evento de resultado em outbox. A entrega desse evento permanece `blocked`; isso não comprova retorno ao Jarvis. Os quatro registros sintéticos foram mantidos como evidência, sem apagar dados.

## Dependências restantes

1. Criar diretamente na interface uma credencial Header Auth separada para a autoridade de aprovação. A lista atual contém Ingresso, Recuperação, X-Jarvis-Key e PostgreSQL, sem uma credencial própria de aprovação. Formulário aberto, cabeçalho `X-Jarvis-Approval-Key` preenchido, valor não preenchido pelo agente.
2. Vincular a autoridade e validar o webhook autenticado antes de publicação.
3. Concluir a entrega/consulta dos resultados pelo Jarvis e validar uma solicitação feita pela interface aprovada. O fluxo legado de Entrega e o webhook legado de Recuperação não foram anunciados como concluídos nesta etapa.
4. Validar a ligação ao deploy efetivamente usado pelo usuário antes de qualquer publicação Vercel. Não houve alteração do design, voz, Abatos ou Gemini.

Cópias internas preservadas no contêiner n8n: `/tmp/jarvis-audit-workflows.json` (inicial) e `/tmp/jarvis-audit-current.json` (após entrada e reserva). Elas não incluem exportação de credenciais, mas podem conter configuração operacional; não publicar essas cópias no GitHub.
