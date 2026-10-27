# Conectores nativos de desenvolvimento do JK

Implementação na branch feature/diretor-tecnico-agent. GitHub, Supabase Management API e Vercel têm adaptadores reais no servidor e gerenciamento em /conexoes. O catálogo existente de 188 plataformas e os oito projetos KIRO permanecem preservados. Contas conectadas nas ferramentas do Codex não são automaticamente contas conectadas ao JK.

## Estado e pré-requisitos

Nenhuma conta real foi conectada durante esta implementação. O cofre, os aplicativos OAuth e seus callbacks precisam ser configurados pelo proprietário antes do uso. A tela informa essa pendência e não declara funcionamento pela simples presença de variáveis.

1. Escolher um backend Supabase dedicado aos conectores ou credenciais administrativas separadas e explicitamente autorizadas. Aplicar, após aprovação, docs/sql/connector-vault-setup.sql. Esse SQL é uma proposta de instalação, não foi aplicado automaticamente. Não reutilizar a service role da memória.
2. Criar uma chave aleatória de 32 bytes, guardar em gerenciador de segredos e configurar as variáveis abaixo exclusivamente no servidor. Nunca adicionar valores ao Git, NEXT*PUBLIC*\*, conversa da IA ou arquivos de relatório.
3. Cadastrar aplicativos oficiais nos provedores, instalar somente nos projetos pretendidos e configurar callbacks exatos.
4. No JK, autenticar como proprietário, clicar Conectar, autorizar no provedor, testar a conexão e selecionar projetos/permissões. O retorno OAuth verifica o estado de uso único, o navegador iniciador e a validade da sessão que autorizou o início.
5. Liberar IDs de desenvolvimento na allowlist do servidor. Isso não substitui a aprovação de cada plano. Sem allowlist, só leitura.

Variáveis do cofre:

| Variável                         | Finalidade                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JARVIS_CONNECTOR_STORE_URL       | Origem HTTPS de um backend Supabase dedicado (\*.supabase.co), sem caminho                                           |
| JARVIS_CONNECTOR_STORE_KEY       | Credencial de servidor com acesso apenas necessário à tabela do cofre                                                |
| JARVIS_CONNECTOR_ENCRYPTION_KEY  | 32 bytes aleatórios codificados em base64; manter backup seguro                                                      |
| JARVIS_CONNECTOR_NAMESPACE       | Identificador de instalação, padrão jk; usar namespace distinto por branch/Preview quando houver contas diferentes   |
| JARVIS_CONNECTOR_ORIGIN          | URL estável HTTPS deste ambiente; HTTP somente localhost para desenvolvimento                                        |
| JARVIS_CONNECTOR_WRITE_RESOURCES | JSON com IDs explicitamente liberados: {"github":["owner/repo"],"supabase":["project-ref-dev"],"vercel":["prj_dev"]} |

O identificador do cofre inclui VERCEL_ENV (development, preview, production) e namespace. A criptografia AES-256-GCM autentica esse identificador como AAD. Mesmo copiado para outro ambiente, o ciphertext não é aceito. Usar uma origem estável e namespace próprio para OAuth; URLs descartáveis de Preview precisam ter callback previamente registrado no provedor. Não apontar Preview para cofre de produção.

Aplicativos OAuth, somente servidor:

- JARVIS_DEV_GITHUB_CLIENT_ID / JARVIS_DEV_GITHUB_CLIENT_SECRET
- JARVIS_DEV_SUPABASE_CLIENT_ID / JARVIS_DEV_SUPABASE_CLIENT_SECRET
- JARVIS_DEV_VERCEL_CLIENT_ID / JARVIS_DEV_VERCEL_CLIENT_SECRET / JARVIS_DEV_VERCEL_INTEGRATION_SLUG

Callbacks: ORIGIN/api/director/connectors/oauth/github/callback; ORIGIN/api/director/connectors/oauth/supabase/callback; ORIGIN/api/director/connectors/oauth/vercel/callback.

## Permissões dos provedores

GitHub: preferir GitHub App instalada em repositórios selecionados. Habilitar apenas Metadata e Contents read, Issues read, Pull requests read, Actions/Checks/Commit statuses read para consultas. Habilitar Contents write e Pull requests write somente quando o proprietário desejar branches, commits e PRs. Nenhum endpoint de merge é implementado. O fluxo de usuário usa PKCE S256; permissões efetivas continuam limitadas à instalação e ao usuário. Quando o provedor não informa escopos no retorno, a UI diz isso explicitamente: as permissões locais do JK não provam permissões concedidas pelo provedor. Renovação de token tem lease para evitar renovação concorrente.

Supabase: registrar integração OAuth com os escopos mínimos da Management API definidos no cadastro do aplicativo: leitura de projetos, metadados/banco, logs/diagnósticos; escrita de banco somente para o uso administrativo desejado. Conferir os nomes atuais na documentação oficial ao registrar. O JK usa PKCE e autenticação Basic do cliente no token endpoint. O token da Management API é separado da credencial de memória. JWT service role e sb*secret*\* não são aceitos no formulário administrativo. A leitura SQL usa o endpoint read-only real; não depende apenas de uma validação de texto SQL.

Vercel: registrar uma integração externa com leitura dos projetos/deployments, logs de build e, apenas se necessário, criação de deployments e variáveis de ambiente. O fluxo de instalação oficial preserva state e usa configuração/equipe retornadas pelo provedor. Recursos continuam limitados aos projetos selecionados na integração e no JK. Não confundir o token de integração com o acesso existente do Codex à Vercel.

Alternativa manual: formulário de senha dedicado na Central envia o token diretamente à rota autenticada do servidor. Não usa localStorage, histórico de chat, transcrição ou credenciais NEXT_PUBLIC. O token permanece apenas na memória do formulário até o envio e é limpo depois. Para GitHub, usar PAT com acesso fino e repositórios selecionados; para Supabase, token Management API; para Vercel, token de escopo limitado. Tokens manuais exigem revogação no painel do provedor. Não compartilhar tokens em conversa.

## Capacidades entregues

| Provedor                | Leitura                                                                                                 | Gravação aprovada                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GitHub                  | Repositórios autorizados, arquivo em ref/SHA, branches, commits, issues, PRs, check runs e status       | Branch jk/\*, commit de até seis arquivos em branch de desenvolvimento, PR em rascunho                                        |
| Supabase administrativo | Projetos, schemas/tabelas public, seleção limitada de colunas/linhas, advisors e logs Postgres recentes | Criar tabela via migração gerada com RLS e sem grants públicos, insert escalar e update/delete por ID com limite de uma linha |
| Vercel                  | Projetos, deployments, estado e eventos de build                                                        | Criar Preview de um SHA GitHub exato, criar variável encrypted somente em Preview e branch jk/\*                              |

Limites deliberados: não há SQL arbitrário, mudanças em auth/storage/vault, migração arbitrária, exclusão de projetos/tabelas, merge, promoção para produção, aliases de domínio, configuração global ou edição de variáveis compartilhadas. As tabelas de credenciais/memória/passkeys são bloqueadas. Atualizar/apagar por ID usa subconsulta escalar de ctid; ID duplicado provoca erro, sem alteração de múltiplas linhas. Triggers e efeitos do banco continuam sujeitos ao escopo e à revisão do proprietário.

Logs de runtime Vercel e métricas de desempenho: nesta versão, apenas acesso contextual ao painel oficial após conferir o deployment/projeto. Não há ingestão direta de runtime, stream de observabilidade nem monitoramento recorrente. Consultas de logs da API Supabase e eventos de build Vercel estão implementadas, mas seus resultados reais dependem do plano e das permissões; não foram executadas em contas reais nesta entrega.

Descoberta limitada: GitHub até 100 repositórios por página da API (UI inicial usa primeira página), Vercel até 100 projetos e Supabase até 200. O escopo salva até 20 recursos da primeira listagem validada; para contas maiores, restringir a instalação no provedor. Paginação completa na UI permanece evolução futura.

## Aprovação, execução e segurança

Cada plano contém parâmetros normalizados, digest SHA-256, versões dos escopos, prazo de 30 minutos e no máximo sete etapas. Gravações requerem digitar APROVAR seguido do trecho do digest na tela do proprietário. A aprovação fica vinculada à sessão autenticada e ao plano; texto de arquivo, issue, log ou resposta de IA não autoriza nada. Alterar o escopo, desconectar, trocar credencial ou expirar invalida o plano.

Todas as rotas exigem a sessão do proprietário, e mutações verificam Origin e Sec-Fetch-Site. OAuth usa state aleatório de uso único, cookie HttpOnly/SameSite=Lax de ligação ao navegador, PKCE quando suportado e troca de código só no servidor. O cookie de sessão principal permanece Strict. OAuth expirado/repetido não é aceito. Em deploy HTTPS, cookie OAuth Secure. Nenhuma credencial é enviada ao modelo.

O cofre guarda um único registro cifrado por ambiente/namespace, com revisão compare-and-swap e até quatro tentativas de conflito. Planos e estados de execução ficam dentro do ciphertext. A auditoria retém até 300 eventos e a UI mostra os últimos 100; não é um arquivo histórico permanente. Conservar auditoria externa durável com política própria é evolução futura. Não salvar texto bruto de requisições, tokens ou callbacks em logs de infraestrutura; revisar política de logs do provedor durante instalação.

Hosts externos são fixos, redirects bloqueados, requisições/respostas limitadas e erros públicos sanitizados. Segredos conhecidos e padrões comuns são ocultados. Isso não substitui classificar dados privados: o proprietário deve revisar arquivos e dados escolhidos. Resultados externos são apresentados como texto/dados, nunca HTML executável, comandos de sistema ou instruções privilegiadas.

A execução marca cada etapa antes de chamar o provedor. A concorrência não pode executar a mesma etapa duas vezes. Etapas concluídas não são repetidas ao continuar. Após cerca de 20 segundos, entre etapas, o plano pode ficar pendente para continuação explícita; requisições têm duração máxima de 180 segundos e timeouts individuais. Um timeout/falha ambígua após mutação fica incerto: conferir no provedor, sem retry automático. Não há transação atômica entre provedores nem rollback automático de commit/migração/deploy. Uma chamada já enviada pode concluir após desconexão; as etapas seguintes são interrompidas pelo escopo revogado.

Desconectar remove o acesso e a credencial local. Revogar tenta a API oficial quando OAuth permite; PATs ou capacidades não disponíveis exigem revogação manual no link do provedor. Falha de revogação OAuth preserva apenas no cofre a credencial necessária à nova tentativa e bloqueia seu uso operacional. Desinstalar o GitHub App e revogar grants de usuário são ações diferentes: gerenciar a instalação também no painel oficial.

## Planejamento de correções

O proprietário vincula um repositório e um projeto Vercel ao mesmo projeto KIRO. Pedidos como verifique o site Guardiões da Origem produzem um diagnóstico somente de leitura e um resultado contextual no HUD. Texto/voz mantêm a política de áudio anterior; a home não ganha um painel administrativo permanente.

A proposta com IA exige autorização separada no formulário e a política/orçamento Abacus já existente. Nenhum modelo pago é chamado nos testes. O limite de resposta Abacus anterior é preservado: esta versão suporta pequenas substituições em até três arquivos escolhidos, não um agente geral de programação. Resposta truncada/inválida é rejeitada. O modelo recebe trechos limitados, não tokens de provedores; propõe JSON de substituições exatas. Caminhos, tamanho, ocorrência única e conteúdo sensível são verificados antes de preparar o plano.

Plano: criar branch jk/\* no SHA lido; aplicar diff aprovado sem force; abrir PR em rascunho; aguardar checks/status do mesmo SHA; solicitar Preview somente quando todos os checks encontrados reportam sucesso. Nenhum check encontrado não prova testes aprovados. Neutral/skipped permanecem pendentes. O commit só aceita a árvore base confirmada e a branch ainda no SHA aprovado. A Vercel verifica a ligação GitHub/repoId do projeto e recebe SHA exato, sem target de produção.

O JK não roda shell, npm ou código externo local. Os testes são os workflows já presentes no repositório e executados pelo provedor após push autorizado. A inspeção de runs-on é conservadora e não é uma auditoria completa de YAML/actions, rede, segredos ou supply chain; revisar os workflows antes de habilitar escrita. Commit/PR também podem disparar outras automações já configuradas, inclusive Preview automático independente do plano. O proprietário deve verificar essa configuração no provedor antes de autorizar alterações. Testes locais isolados via sandbox e correções grandes continuam pendentes.

## Validação reproduzível

- node --test tests/\*.test.mjs
- node node_modules/typescript/bin/tsc --noEmit
- npm run build
- Fixture exclusiva de loopback: JARVIS_CONNECTORS_TEST_FIXTURE=1; node -r ./tests/fixtures/connectors-runtime.cjs node_modules/next/dist/bin/next start -H localhost -p 3156
- Em outro terminal: TEST_BASE_URL=http://localhost:3156; node tests/browser/connectors-smoke.cjs

A fixture é carregada apenas por -r com flag explícita e host loopback. Nenhuma rota da aplicação importa a fixture; ela usa credenciais falsas e bloqueia rede externa. As rotas reais, sessão assinada, criptografia/CAS, UI e validações são exercitadas, enquanto OAuth/API dos provedores são simulados. Testes reais de conta exigem cadastro/configuração e consentimento posterior; não declarar conexão real a partir desses resultados.

## Referências oficiais consultadas

- GitHub App user token + PKCE: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- Supabase OAuth: https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
- Supabase scopes: https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes
- SQL read-only: https://supabase.com/docs/reference/api/v1-read-only-query
- Migrações: https://supabase.com/docs/reference/api/v1-apply-a-migration
- Vercel integração externa e state: https://vercel.com/docs/integrations/create-integration/submit-integration
- Vercel token/configuração: https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- Deployments/Preview: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment
