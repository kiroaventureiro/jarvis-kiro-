# Jarvis: opções oficiais para execução Codex (29/10/2026)

## Evidência verificada
- Codex Cloud CLI experimental foi detectado, mas a leitura autenticada retornou HTTP 401 no ambiente de diagnóstico; nenhuma execução foi demonstrada.
- O Codex SDK oferece execução programática de *threads* por um processo servidor com runtime próprio. Isso **não** significa que o SDK invoque automaticamente os chats já abertos na interface Codex Cloud.
- O Codex app-server permite construir clientes com eventos, histórico, aprovação e autenticação. Sua sessão não pode ser presumida a partir do navegador do usuário.

Documentação oficial:
- https://learn.chatgpt.com/docs/codex-sdk
- https://learn.chatgpt.com/docs/auth
- https://learn.chatgpt.com/docs/developer-commands

## Caminho A — Cloud
Manter o diagnóstico somente leitura (`npm run diagnose:codex`). Não tentar capturar cookies/tokens, não reutilizar credenciais de sessão, não presumir IDs de ambiente ou permissões de criar tarefas. Retomar quando existir identidade suportada com consulta autenticada comprovada.

## Caminho B — Worker SDK isolado (alternativa)
Criar processo separado do Next.js, com checkout de repositório restrito a `kiroaventureiro/jarvis-kiro-`, branch `feature/diretor-tecnico-agent`, permissões mínimas, isolamento, autenticação própria, aprovações vinculadas à tarefa, fila durável, proteção contra replay e retorno de resultados assinado.

### Pré-condições antes de ativar
1. Operador autentica o worker por fluxo oficialmente suportado. Nenhuma chave é solicitada pelo chat. Verificar custos/entitlements antes de uma execução.
2. Confirmar checkout isolado, armazenamento seguro de segredos, limite de tempo e logs sem credenciais.
3. Confirmar cofre persistente do Jarvis, recibos assinados com validade e autorização explícita de cada tarefa.
4. Implementar fila/claim atômico, idempotência, reconciliação de falhas, cancelamento e resultado autenticado. Só publicar estado `running` após aceite verificado pelo executor.
5. Fazer primeiro teste de leitura/revisão na branch experimental; não tocar `main` nem publicar produção.

## Estado atual e limite
O SDK é uma **opção de arquitetura**, não um executor já conectado. `codexWorkerReadiness().execution` deve permanecer `not_connected`, e `/api/director/codex/dispatch` deve continuar recusando envio. Não adicionar flags para fingir disponibilidade nem executar agentes pelo processo web Next.js.

## Caminho C — Login oficial com ChatGPT para app-server
A OpenAI documenta "Sign in with ChatGPT" (SIWC), que fornece ao aplicativo um token OAuth autorizado e distingue autenticação de permissão de uso do plano. Com autorização explícita do usuário, um processo isolado pode iniciar Codex app-server com um provedor Responses para plano ChatGPT e acompanhar eventos `turn/completed`. Isso é distinto de chamar tarefas já existentes do Codex Cloud.

Fontes oficiais: https://developers.openai.com/siwc/token-sharing-open-source e https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server

Implementação futura exige: fluxo de registro/login/PKCE suportado, confirmação de escopo autorizado, armazenamento e renovação segura de tokens **no worker**, controle de custos e consentimento, sandbox, limites de repositório, fila e recibos. Não armazenar token no navegador ou cofre genérico; não copiar token do Codex/ChatGPT. Sem esse login concluído, permanecer bloqueado.

## Decisão de engenharia
Próximo teste deve ser autenticação de **leitura** suportada, sem criar tarefas nem gerar custos. Após comprovação, executar tarefa de revisão somente com autorização específica. Priorizar o caminho que realmente usa os benefícios de conta autorizados, sem supor que um token de login da interface funcione no Cloud CLI. Não confundir autenticação ChatGPT com cobrança da API.

## Investigação operacional da issue #3 — 29/10/2026

Verificação com `codex-cli 0.163.0`, usando somente interfaces oficiais, com rede
autorizada e sem ler arquivos de credenciais:

| Prova | Resultado |
| --- | --- |
| `codex login status` | Login ChatGPT detectado localmente; não comprova aceitação remota |
| `npm run diagnose:codex` | `cloud_authentication_rejected`; consulta Cloud retorna HTTP 401 |
| `codex app-server --stdio`, RPC `initialize` | Handshake local concluído |
| RPC `account/read`, `refreshToken: false` | Conta ChatGPT presente; plano `unknown`; não valida autenticação remota |
| RPC `account/rateLimits/read` | Falha de autenticação HTTP 401; limites e créditos não confirmados |
| Filesystem do diretório de estado Codex | Somente leitura, confirmado por `statvfs`, sem examinar seu conteúdo |

O 401 também ocorre pela interface oficial do app-server, portanto não está limitado
ao comando experimental Cloud. A causa interna do token rejeitado (expiração, escopo
ou identidade inapropriada) não foi determinada: não se inspecionou o token e as
respostas oficiais não permitem concluir isso. Não houve logout nem tentativa de
substituir a autenticação gerenciada. O app-server de diagnóstico foi encerrado;
nenhum `thread/start`, `turn/start` ou `cloud exec` foi enviado.

### Reautenticação segura e autorização necessária

A documentação oficial recomenda `codex login --device-auth` para ambientes sem
navegador. O proprietário precisa habilitar login por código de dispositivo nas
configurações de segurança ChatGPT; em workspace gerenciado, o administrador pode
precisar liberar essa permissão. O usuário conclui a confirmação no navegador
oficial, sem entregar tokens ou cookies ao Jarvis/chat.

Não é possível gravar normalmente esse login no diretório de estado atual, que é
somente leitura. Para continuar aqui, é necessária autorização explícita para criar
um diretório de autenticação exclusivo e protegido, gravável, e iniciar o login
oficial apontando `CODEX_HOME` para ele **apenas nos comandos desse teste**. Esse
diretório conteria credenciais criadas pelo próprio fluxo oficial, fora do Git, e
exige armazenamento seguro e política de retenção; não é uma cópia da sessão atual.
Alternativamente, o operador pode fornecer um worker próprio já reautenticado
oficialmente, com armazenamento protegido. Nenhum desses caminhos foi ativado.

Depois do consentimento e login, repetir primeiro a consulta de leitura e a consulta
de limites. Uma primeira tarefa requer ainda confirmação do environment ID Cloud
correto, das permissões de repositório e do uso autorizado da cota já existente,
sem compra de créditos ou habilitação de cobrança. A issue exige autorização
explícita para esse primeiro job. Sem essas confirmações, não há prova de execução.

### Mecanismos confirmados, com seus limites

- O CLI instalado oferece `codex cloud exec --env <ENV_ID> --branch <BRANCH>` e
  consulta por `cloud status`. É um mecanismo oficial experimental de envio Cloud;
  sua autorização efetiva neste ambiente continua rejeitada, e o ID Cloud do projeto
  não foi confirmado. Não é uma API HTTP pública inferida de endpoints internos.
- O protocolo app-server é um mecanismo oficial programático para um worker iniciar
  threads/turnos e receber eventos. O transporte local foi comprovado, mas a conta
  remota e a execução não. Ele não equivale a criar tarefas hospedadas no Codex Cloud.
- O SDK é documentado oficialmente como opção de controle programático do agente;
  não foi instalado nem apresentado como integração funcional do Jarvis.

Fontes oficiais consultadas com sucesso:
https://developers.openai.com/codex/auth,
https://developers.openai.com/codex/app-server,
https://developers.openai.com/codex/sdk e
https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server.
Autenticação Cloud exige ChatGPT; trocar para chave de API não é uma correção
equivalente e implicaria outro modelo de cobrança. O estado do Jarvis permanece
`not_connected`, sem alteração de código ou estruturas adicionais nesta investigação.
