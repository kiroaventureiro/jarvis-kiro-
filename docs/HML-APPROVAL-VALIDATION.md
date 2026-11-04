# Aprovação HML com identidades separadas

O proprietário autorizou explicitamente as identidades `jarvis-kiro-hml` para entrada e `jarvis-kiro-hml-approval` para aprovação.

## Aplicado

- Funções HML atualizadas com a identidade de aprovação autorizada. Reserva e recuperação alinhadas. Não alterados os registros anteriores de auditoria.
- Workflow `JK | HML | Controle de aprovações` publicado com a credencial `Header Auth account`, criada e preenchida diretamente pelo proprietário. O agente não leu o valor da chave.
- Configuração de autoridade e separação habilitada após autorização; ações externas continuam desativadas.
- Despachante alinhado à identidade nova em sua configuração e consulta de reserva.

## Verificação real

- Chamada sem chave: HTTP 403.
- Chamada usando a referência da credencial dentro do próprio n8n, com contrato vazio: HTTP 400, `INVALID_APPROVAL_CONTRACT_OR_BINDING`. Autenticação atravessada; nenhum comando aprovado.
- Aprovação de uma tarefa exclusivamente sintética: HTTP 201, `decisionRecorded: true`, `persisted: true`, `jobState: pending`.
- Despachante executou essa tarefa. Banco confirmou `succeeded` no comando e tentativa, autoridade `jarvis-kiro-hml-approval` e resultado em outbox ainda com entrega `blocked`.
- Testes SQL de execução e recuperação repetidos com as novas identidades: passaram, com ROLLBACK.
- O fluxo manual `JK | HML | Teste autenticacao de aprovacao` foi adicionado para auditoria, sem ativação automática. Ao final, o corpo de teste foi restaurado para `{}`.

## Rota de servidor preparada

`POST /api/orchestration/hml/approvals`, com sessão de proprietário, mesma origem, campos permitidos, capacidades somente de simulação, prazo máximo de quinze minutos e validação do recibo vinculado. Chave enviada apenas no servidor para o endpoint fixo do n8n. Recibos divergentes, decisões superadas e autorização de executor real são recusados.

Variável necessária: `JARVIS_HML_APPROVAL_KEY`, tipo Secret, no ambiente Preview do projeto Vercel `jarvis-kiro`. Deve conter a mesma chave inserida no Header Auth de aprovação, diferente de `JARVIS_HML_INGRESS_KEY`. Formulário preparado pelo agente, sem valor preenchido nem salvamento.

Oito testes das rotas de entrada e aprovação passaram. A rota preparada ainda não foi enviada ao GitHub nem publicada na Vercel. Retorno completo dos resultados ao Jarvis e execução fora de simulação continuam pendentes. Nenhuma alteração em interface, voz, Abatos ou Gemini.
