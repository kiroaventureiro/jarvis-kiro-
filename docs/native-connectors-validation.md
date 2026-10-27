# Validação dos conectores nativos — 2026-10-27

Repositório kiroaventureiro/jarvis-kiro-, branch feature/diretor-tecnico-agent. Base auditada: c0904604827ebb57dfcfed04efc0cedc74a980b3. Nenhum merge, publicação em produção, conexão real de contas, configuração de aplicativos OAuth, aplicação de SQL ou ativação de serviço pago foi realizada nesta validação.

## Resultado local

| Verificação                    | Resultado                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Testes Node existentes e novos | 203 aprovados, zero falhas; 25 específicos de conectores                               |
| TypeScript --noEmit            | Aprovado                                                                               |
| Build Next.js 15.5.28          | Aprovado, incluindo as três novas rotas de conectores                                  |
| Navegador: conectores          | 12 cenários aprovados                                                                  |
| Navegador: voz                 | 12 cenários de regressão aprovados                                                     |
| Navegador: HUD                 | 4 cenários de regressão aprovados                                                      |
| Navegador: anexos/arraste      | 4 cenários de regressão aprovados                                                      |
| Catálogos                      | Oito projetos KIRO e 188 plataformas preservados; arquivos dos catálogos não alterados |

Os testes do navegador usam Chrome instalado, desktop 1440x1000 e celular 390x844, além das larguras e simulações iOS dos testes existentes. Os testes de voz simulam APIs do navegador: não demonstram qualidade real de microfone/voz nem execução nativa em iPhone.

## O que foi efetivamente executado

As rotas e componentes reais do JK foram executados contra um servidor Next de loopback. Somente o transporte externo foi substituído pela fixture explícita tests/fixtures/connectors-runtime.cjs. Ela bloqueia todos os destinos externos não simulados e não é importada por nenhuma rota da aplicação.

Foram verificados: sessão assinada do proprietário; rejeição 401/403; formulários dedicados dos três provedores; armazenamento cifrado e revisão CAS; descoberta e seleção de recursos; vínculo de projeto KIRO; plano somente de leitura; plano de branch aprovado na UI; bloqueio de repetição; mudança de escopo; expiração; concorrência e renovação de token; revogação local/manual/OAuth; callback state/PKCE de uso único; tratamento de 401/403/429/503; limitação de corpo/resposta; bloqueio de destinos arbitrários; injeções de target production e main; leitura SQL real pelo adaptador read-only; geração de migração com RLS; update/delete limitados a uma linha; gating do Preview por checks do SHA; respostas externas sem autoridade; dados sensíveis ocultados; diagnóstico pela rota de texto e resultado contextual no HUD.

Também foram simulados: falha ambígua após gravação sem retry, perda de permissão durante renovação, árvore base incompleta, workflows com runners não confirmados/reutilizáveis, proposta de modelo limitada a diff revisável e tentativa de proposta sem autorização de custos. Nenhuma chamada de geração de IA foi executada.

## O que não foi verificado em conta real

- Instalação/autorização de GitHub App, OAuth Supabase ou integração externa Vercel.
- Credenciais e scopes reais, revogação remota real, paginação de uma conta grande.
- Criação real de branch/commit/PR por estes conectores.
- SELECT, logs, migração ou alteração de dados em banco real por estes conectores.
- Deployment, variável de ambiente ou eventos de build reais por estes conectores.
- Proposta de correção via modelo Abacus real; o orçamento e a política existentes foram preservados.

O cadastro dos aplicativos, o cofre dedicado e a autorização por conta são pré-requisitos de instalação. A implementação não apresenta contas como conectadas sem teste. Conexões das ferramentas do Codex não são transferidas para o JK.

## Implementado e pendente

Implementado: adaptadores de API; OAuth/PKCE onde aplicável; alternativa de token cifrado; Central com seleção de escopo, teste, desconexão/revogação e histórico; planos imutáveis aprovados por sessão/digest; execução persistente por etapas; diagnóstico e pequenas propostas de correção; integração com o registro operacional e resultados do HUD.

Pendências de evolução: ingestão direta de logs runtime/performance Vercel (há link ao painel); SQL/migrações arbitrárias; agente geral de programação; testes locais de código externo em sandbox; paginação completa na UI; arquivo de auditoria permanente além da retenção recente. Nenhum desses itens é anunciado como operacional.

O CI é externo, a partir dos workflows existentes. A detecção de runners hospedados é conservadora e não certifica toda a cadeia de actions, segredos ou automações. Commit e PR podem disparar automações independentes previamente configuradas no provedor. A aprovação do plano explica esse efeito. O JK não executa shell nem promove para produção.

## Evidências e instruções

O guia docs/native-development-connectors.md contém instalação, variáveis sem valores, callbacks, permissões, limites, custos e procedimento de teste. docs/sql/connector-vault-setup.sql é uma proposta não aplicada.

As evidências locais da sessão estão em outputs/native-connectors: all-tests.tap, typescript.log, build.log, browser-results.json, browser.log, screenshots e regressões voice/hud/attachments. Screenshots de conectores conectados mostram exclusivamente contas fictícias da fixture. O relatório final da sessão acrescenta o SHA publicado na branch, CI e URL do Preview quando confirmados.
