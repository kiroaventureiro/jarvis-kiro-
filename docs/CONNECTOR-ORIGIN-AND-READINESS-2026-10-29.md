# Conexões: origem, configuração e prontidão — 29/10/2026

Solicitação baseada no relatório do proprietário sobre o produto oficial.
Base de produção confirmada: `f670eb78655f1589fa3c1627ac687686e39db73c`,
deployment `dpl_2LK21vpt8W2H3eVi63Rit58zA242`, READY.
As mudanças foram preparadas na branch experimental sincronizada com essa base,
preservando as entregas anteriores, para o fluxo de PR adotado pelo repositório.

## A. Condição causal reproduzida e limite da evidência

A versão anterior exigia simultaneamente que `Origin` pertencesse à lista
permitida **e** fosse igual a `new URL(request.url).origin`. A solicitação de
regressão usa `Origin: https://jarvis-kiro.vercel.app` com URL interna
`http://localhost:3000/api/director/connectors`: a igualdade anterior rejeita
essa condição; a nova política aceita a origem pública cadastrada. Um teste da
rota real em loopback também confirma que a origem pública alcança a validação
do corpo, sem chamar um provedor. Origem externa continua recebendo 403.

**Não foi possível confirmar os headers da tentativa real do proprietário.**
A leitura de logs Vercel retornou 403 para a sessão, sem CLI Vercel disponível.
Não atribuir a falha definitivamente ao proxy, cache ou token. O diagnóstico
autenticado acrescentado à Central permite registrar a evidência da solicitação
real em caso de nova recusa, sem pedir repetição de credenciais no chat.

Na rota de conectores, autenticação vem antes da origem, e origem antes do corpo,
cofre e credencial. Logo, um 403 emitido por essa guarda não comprova token
inválido: a tentativa é recusada antes de o token ser processado.

## B. Bloqueios e configuração observada em produção

- `/` e `/conexoes`: HTTP 200. API de conectores sem sessão: HTTP 401.
- `JARVIS_CONNECTOR_ORIGIN`: valor público confirmado como
  `https://jarvis-kiro.vercel.app`.
- Variáveis de cofre, criptografia, namespace, senha e assinatura de sessão
  aparecem no alvo production. Valores secretos não foram descriptografados.
  Presença não comprova chave correta, RLS ou acesso real ao cofre.
- Os endpoints configurados de memória (`SUPABASE_URL`) e cofre dedicado
  (`JARVIS_CONNECTOR_STORE_URL`) são diferentes. O código do cofre não usa a
  credencial de memória como fallback. Não foram trocadas credenciais ou projetos.
- `JARVIS_CONNECTOR_WRITE_RESOURCES` não consta no alvo production. Portanto,
  conectar e autorizar leitura não habilita escrita: recursos permitidos pelo
  servidor continuam necessários.
- Nenhum cadastro OAuth nativo/Google/Microsoft foi encontrado nos metadados
  de production. GitHub/Supabase/Vercel oferecem token pessoal como alternativa;
  Google/Microsoft ainda dependem de aplicativos OAuth cadastrados.
- Sessão de senha: cookie HttpOnly, Secure em produção, SameSite=Strict,
  path `/`, sem domínio amplo, validade de um dia. Não houve login real do
  proprietário nesta revisão. WebAuthn mantém sua própria origem cadastrada;
  suas verificações não foram relaxadas.

## C. Correções implementadas

- `lib/request-origin.ts`: política compartilhada de origem pública, independente
  da URL interna do proxy. Não usa Host/X-Forwarded-Host para conceder confiança
  a um Origin externo. Configuração explícita inválida falha de forma fechada.
- Conectores nativos e Google/Microsoft conservam Origin obrigatório. Outros
  handlers que já aceitavam clientes sem Origin conservam esse contrato, com
  bloqueio cross-site e a mesma lista explícita para os Origins presentes:
  Abacus, gateway de voz, anexos, pesquisa, Navi, planejamento/aprovação/dispatch
  Codex e projetos. Isso não ativa execução Codex/Navi ou custos.
- Callbacks OAuth GET validam o destino público configurado por URL ou Host
  exato; não confiam em X-Forwarded-Host isoladamente. As validações existentes de state, PKCE quando suportado, cookie de
  vinculação, expiração e uso único permanecem no cliente OAuth.
  Redirecionamento e cookie Secure usam o destino configurado, não a URL interna.
- `/api/director/connectors?diagnostics=1`: somente proprietário; verifica
  configuração sem chamadas ao cofre/provedores. Exibe campos públicos de origem,
  nomes de configurações ausentes e flags; não retorna valores secretos.
- Recusa de origem inclui código e diagnóstico de headers selecionados. Nunca
  inclui Cookie, Authorization, corpo, URL com query ou código OAuth. A interface
  mostra os detalhes somente em uma seção de diagnóstico do erro.
- O botão principal abre o formulário seguro de token quando OAuth não existe.
  Guias com links oficiais explicam os diferentes tokens e permissões dos três
  provedores; etapas distinguem autorização, verificação e escopo salvo.
- GitHub ganhou paginação na Central e validação no servidor de recursos de
  páginas posteriores. Seleção explícita limitada a 100 recursos, descoberta a
  dez páginas de 100. Nenhum ID vindo do navegador é aceito sem nova descoberta.
  Vercel lista até 100 projetos; Supabase até 200. Não anunciar listagem ilimitada.
- Cada um dos 200 itens do catálogo tem instruções de preparação. Isso não cria
  adaptadores, credenciais ou conexão universal por URL arbitrária.
- Corrigida a interpretação de “Jarvis, verifique o site Guardiões da Origem”:
  chamar o assistente pelo nome não transforma o projeto citado no próprio Jarvis.

## D. Permissões e operações reais

| Provedor | Implementado | Não habilitado por esta entrega |
| --- | --- | --- |
| GitHub | Descoberta dos repositórios acessíveis ao token; leitura de repo/arquivo/branches/commits/issues/PRs; verificações de CI; branch jk/, commit e abertura de PR com aprovação | Exclusão/administração irrestrita, merge, alteração direta de main, atualização geral de PRs ou disparo arbitrário de workflows |
| Supabase | Management API para projetos, schemas, consultas limitadas, diagnósticos/logs; operações estruturadas previstas no catálogo com aprovação/allowlist | SQL arbitrário, uso de service role como token administrativo, escrita automática em banco production |
| Vercel | Conta/equipe, projetos, deployments, build logs e referência aos logs runtime; preview e variável de branch autorizados | Promoção production, leitura de segredos de variáveis, streaming arbitrário de logs ou acesso que o token não possua |

O registro `runtime_logs` do adaptador devolve referência ao painel, não ingestão
completa de observabilidade. Escopo do provedor, seleção local de recursos,
allowlist do servidor e aprovação do plano são controles diferentes.

## E. Testes e falhas intermediárias

- `npm test`: 120 arquivos passaram, zero falhas/ignorados na execução final.
- Testes nativos: 32 passaram, incluindo seleção de página posterior e diagnóstico
  do projeto citado. Política de origem: cinco cenários; rota de verificação:
  quatro cenários, incluindo diagnóstico sem acesso ao cofre/provedores.
- `npm run build`: aprovado com TypeScript.
- `tests/browser/connectors-smoke.cjs`: 13 cenários aprovados em servidor Next
  local, com transporte explícito que bloqueia toda API externa não simulada.
  Cobertura: 401/403, proxy, configuração, alternativa de token, três provedores,
  cifra, seleção, aprovação/execução única, bloqueios de produção/main, diagnóstico
  contextual, custo separado, redaction, desktop/mobile, revogação e OAuth/replay.
- A primeira rodada apontou loaders de teste e asserts estáticos ligados à
  implementação antiga de origem; foram atualizados para a política compartilhada.
  Também foi corrigida a assinatura GET incompatível com o tipo exigido pelo Next.
- O teste de navegador encontrou o erro real de roteamento do nome Jarvis; foi
  corrigido no produto, com regressão, e o fluxo completo foi repetido com sucesso.

Evidências locais: `/tmp/jarvis-connector-final-tests.log`,
`/tmp/jarvis-native-final.log`, `/tmp/jarvis-connector-build.log`,
`/tmp/jarvis-connector-browser.log` e `/tmp/jarvis-connector-flow/`.
Capturas com contas conectadas representam **fixtures**, não as contas reais.
A falha de desempenho WebGL por software registrada na auditoria anterior não
foi reavaliada nesta entrega.

## F. Publicação e verificação real pendente

A identificação do PR, SHA final, CI e deployment deve ser conferida no resultado
da execução, sem confundir o deployment de base acima com uma nova publicação.
Rollback: deployment READY de base identificado no início deste relatório.
Nenhuma credencial, configuração production, política de escrita ou serviço pago
foi alterado por esta correção de código. Não foi iniciado executor adicional.

## G. Ações que dependem do proprietário

1. Autorizar suas contas por OAuth configurado ou token pessoal no formulário
   dedicado do Jarvis; não fornecer tokens em chat. Conexões deste Codex não são
   transferidas para o Jarvis. Sessão assinada de teste não equivale à do dono.
2. Selecionar e salvar os recursos/permissões. Para escrita, definir os IDs exatos
   permitidos na política do servidor; não liberar todos os recursos por padrão.
3. Se optar por OAuth, registrar os aplicativos/callbacks oficiais. Para
   Google/Microsoft esse cadastro continua obrigatório.

Não foi possível provar autorização real, persistência entre sessões reais ou
leitura/escrita em contas privadas. Se um erro continuar, usar o diagnóstico
autenticado para identificar a camada, sem declarar todas as conexões operacionais.
