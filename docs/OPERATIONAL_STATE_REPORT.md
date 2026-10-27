# Correção do estado operacional — Jarvis Kiro

Data: 27/10/2026. Branch exclusiva: feature/diretor-tecnico-agent. Base auditada: 73e3c7602ac61d74f71ba7d136cbedb93cbe28d8.

## Diagnóstico

Havia três fontes incompatíveis: o contexto da Abacus tratava presença de variáveis como capacidade; o perfil marcava todas as integrações como desconectadas; as instruções da voz nativa repetiam uma lista histórica de serviços não conectados. O catálogo de projetos, por outro lado, já era reconhecido. Conhecer um projeto e estar conectado a um serviço são fatos diferentes.

## Implementação

O registro central em lib/operational reúne configuração, autorização, disponibilidade de orçamento e evidência datada do ambiente atual. Estados:

| Estado                       | Significado                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Não configurado              | Configuração necessária ausente neste ambiente.                                                           |
| Credenciais configuradas     | Configuração presente, ainda sem confirmação atual e suficiente.                                          |
| Conexão validada             | Uma operação autorizada respondeu, no escopo explicitado.                                                 |
| Operacional e autorizado     | Evidência suficiente para a capacidade indicada e autorização vigente. Não autoriza novas ações externas. |
| Temporariamente indisponível | Verificação recente falhou ou o orçamento existente impede uso. A configuração não é apagada.             |

As evidências duram 60 segundos e ficam isoladas por ambiente e impressão interna das configurações. A impressão não é devolvida ao cliente. Instâncias sem evidência não herdam o estado de outra instância; pedem nova confirmação. Verificação vencida não significa desconexão. Verificações simultâneas compartilham a mesma consulta.

Abacus: GET autenticado ao catálogo /v1/models, com timeout, limite de tamanho e bloqueio de redirecionamento. Nenhum modelo é executado por essa verificação. O catálogo e a presença de route-llm são informados com seu escopo; não comprovam que uma geração terminou. Gerações efetivamente autorizadas registram sucesso ou falha real. O bloqueio de uso pago e os limites existentes permanecem intactos.

Supabase: endpoint HTTPS permitido, chave de servidor e chave AES-256 válida são avaliados separadamente da conexão. A verificação faz apenas leitura da tabela existente. Se houver registro, tenta descriptografá-lo no servidor e descarta o conteúdo, devolvendo somente metadados de estado. Tabela vazia prova acesso à tabela, sem inventar teste de criptografia. Gravação só é comprovada após uma operação manual autorizada; não há escrita automática de teste, restauração automática nem envio do histórico ao modelo pelo registro operacional.

As cinco perguntas solicitadas são atendidas pelo resolvedor local autenticado, sem geração paga. Outras conversas recebem o contexto operacional canônico junto do catálogo KIRO. A voz nativa dispõe de uma ferramenta interna estritamente de leitura; argumentos, nome, deduplicação, cancelamento e limite por turno são verificados. A continuação da resposta não pode repetir a ferramenta indefinidamente.

Inventário do diretor técnico, perfil, prontidão, Central de Conexões, status Abacus, status Supabase, texto e voz passam a compartilhar os mesmos estados. O HUD e a regra de áudio no computador/texto no celular foram preservados. Os arquivos dos oito projetos KIRO e das 188 plataformas não foram alterados.

## Evidência externa e limites

Em consulta autorizada somente de leitura pela conexão Supabase do proprietário, o projeto jarvis-kiro apareceu ACTIVE_HEALTHY. A consulta de metadados confirmou public.jarvis_owner_memory, RLS habilitada e as colunas owner_id e encrypted_history. Não foram lidos históricos reais nem credenciais, nem alterados dados ou esquema. Esta evidência da conta conectada não comprova a chave de criptografia ou as variáveis da aplicação em cada Preview. As políticas RLS não receberam uma auditoria completa nesta tarefa.

A documentação oficial confirma o catálogo autenticado da Abacus em https://abacus.ai/help/route-llm/ e a separação entre grants e RLS no Supabase em https://supabase.com/docs/guides/api/securing-your-api. A ferramenta da voz segue o contrato de function_call_output em https://developers.openai.com/api/docs/guides/realtime-conversations.

O cache de evidências e os contadores existentes são locais à instância. Para limites globais entre várias instâncias, é necessária evolução específica de armazenamento compartilhado; não foi alterada a política de custos. Serviços sem probe implementado ficam configurados/pendentes, sem conexão inventada. Uma leitura bem-sucedida não comprova gravação. A consulta de catálogo não comprova uma resposta do modelo. Falhas reais não são substituídas por resultados simulados.

## Validação

- 171 testes Node aprovados, incluindo 14 testes comportamentais novos do registro, cinco perguntas, expiração, isolamento, deduplicação, leitura criptografada, autenticação, bloqueio de custos e ferramenta da voz.
- TypeScript sem erros.
- Build Next.js concluído.
- Teste no navegador contra as rotas reais de uma instância local isolada: sessão de teste, Abacus e Supabase simulados, modelos pagos bloqueados. As cinco perguntas responderam; uma geração comum foi recusada; contadores de chamadas e tentativas permaneceram em zero. Metadados não expuseram chaves, ciphertext ou conteúdo de memória.
- Computador: resposta falada sem transcrição no HUD. Celular: resposta escrita preservada. Central de Conexões: estados e escopos corretos. Acesso sem sessão: 401 nos endpoints protegidos.
- Regressões de navegador no build atual: 12 cenários de voz, quatro de HUD e quatro de anexos aprovados, com APIs externas simuladas. Incluem desligamento, permissão negada, áudio indisponível, autenticação, layout, arrastar/colar e cancelamento.
- O teste local utiliza localhost, endereço canônico observado no Next; a proteção de origem não foi modificada.

Os testes com serviços simulados comprovam o comportamento do aplicativo, não uma geração paga real nem o funcionamento das credenciais de um ambiente remoto. Nenhum modelo pago foi chamado para validação. Nenhuma configuração de recarga, plano ou produção foi alterada. Não houve merge na main.

## Arquivos

Núcleo: lib/operational/{state,questions,probes,registry,server,realtime-tool}.ts, lib/jarvis-operational-context.ts, lib/jarvis-profile.ts, lib/integration-readiness.ts.

Integração: lib/abacus-routellm.ts, lib/abacus/protocol.ts, lib/server-memory.ts, lib/voice/{abacus-gateway,cost-policy}.ts, lib/jarvis-realtime.ts; rotas director/{operational-status,abacus,connections,integration-readiness,memory-history,profile,supabase-status} e api/voice.

Interface: JarvisExperience.tsx, AbacusStatus.tsx e MemorySyncSettings.tsx.

Validação: tests/operational-state.test.mjs, tests/fixtures/operational-runtime.cjs, tests/browser/operational-smoke.cjs e atualização de quatro testes existentes de perfil/provedores/voz/prontidão.

O relatório de entrega local reúne os resultados de navegador e os estados finais de CI/Preview junto desta base técnica.
