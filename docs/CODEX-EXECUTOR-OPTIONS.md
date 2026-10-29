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
