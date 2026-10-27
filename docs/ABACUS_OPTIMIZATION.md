# Abacus RouteLLM — otimização segura no Jarvis Kiro

Data: 26/10/2026. Branch exclusiva feature/diretor-tecnico-agent. Base auditada: 667f9b8d25da59c3101e55541f2c149fd04bf98c.

## Escopo e auditoria

Inspecionados autenticação, rota Abacus, adaptador RouteLLM, orçamento de voz, cliente do HUD, memória curada, roteamento de provedores e duas Centrais de Conexões. As mudanças recentes de catálogo/conexões foram sincronizadas antes da implementação e preservadas. Não houve alteração nas credenciais, em lib/auth, na arquitetura OpenAI Realtime ou no fluxo de análise de anexos.

A versão anterior enviava somente a mensagem atual, aguardava JSON completo, descartava informações úteis de consumo e reduzia erros do provedor a uma falha genérica. Havia duas implementações de fetch no HUD e o contador de chamadas podia mostrar uma janela já vencida.

## Implementação

- Cliente único para texto e voz. Envia até oito mensagens anteriores, limitadas a 600 caracteres por mensagem e 3.600 no total. Histórico permanece somente na sessão da página; não é memória persistente nem sincronização com ChatLLM. Papéis system/tool e parâmetros de modelo, ferramentas, mídia ou credenciais enviados pelo navegador são rejeitados.
- Contexto de projetos vem do índice curado existente, com até dois registros, resumos limitados, origem, confiança e data. A busca considera o pedido e os últimos pedidos do usuário. Registros e histórico são tratados como dados não confiáveis; não concedem ferramentas nem representam estado ao vivo.
- RouteLLM permanece o seletor automático. Perfis de conversa, código e análise ajustam orientação, mantendo o limite de 350 tokens de saída. Nenhum modelo premium específico é escolhido automaticamente pelo Jarvis. O modelo efetivamente retornado é contabilizado após sucesso.
- Streaming SSE com decodificação UTF-8, cancelamento, timeout de 20 segundos, limite de eventos/corpo e confirmação terminal. JSON permanece compatível. Saída incompleta não vira resposta concluída. Limite de tokens é informado ao usuário. Não há retry automático de chamadas potencialmente cobradas.
- Erros 429 preservam indicação de espera, limitada a 300 segundos. Falhas de credencial, rede, timeout e resposta inválida recebem mensagens públicas sem corpo bruto do provedor.
- Trava de envio por teclado evita pedidos simultâneos. Cancelamento interrompe a origem do streaming. A fala aguarda resposta concluída; no computador, narração continua oculta quando há voz e aparece como alternativa quando não há. No celular, transcrição continua visível. Resultados de arquivos permanecem separados.
- Métricas sem prompts: tentativas, conclusões, falhas, cancelamentos, tokens de entrada/saída/cache e modelos retornados. Respostas sem usage debitam uma reserva conservadora no limite local, separada dos tokens efetivamente informados. Não se apresenta essa reserva como consumo faturado.
- Limite adicional padrão: 60.000 tokens/hora por instância, configurável por JARVIS_ABACUS_MAX_TOKENS_PER_HOUR entre 1.000 e 1.000.000. Reserva usa bytes UTF-8 e margem antes da chamada; é uma estimativa conservadora, não tokenização exata.
- As autorizações de custo existentes continuam obrigatórias: JARVIS_ABACUS_PAID_ALLOWED e JARVIS_ABACUS_MAX_CALLS_PER_HOUR. Nenhuma foi habilitada nesta tarefa. Contadores são temporários, reiniciam com a instância e não constituem teto financeiro global. Custo monetário e saldo de créditos permanecem desconhecidos no servidor.
- Novo painel AbacusStatus em /conexoes e /integracoes, consultado apenas por ação do usuário. GET autenticado lê estado local, sem modelo externo. O catálogo continua sem alegar conexão real.
- Manifesto prepara imagem, áudio e vídeo como capacidades futuras, sem execução. Pesquisa web, agentes, ferramentas e automações externas não foram habilitados.

## Referências públicas verificadas

A documentação de [RouteLLM](https://abacus.ai/help/route-llm/) descreve seleção automática e catálogo; a de [Chat Completions](https://abacus.ai/help/route-llm/chat-completions/) descreve histórico, SSE, finalização e usage. As páginas de [imagem](https://abacus.ai/help/route-llm/chat-completions/image-analysis) e [áudio](https://abacus.ai/help/route-llm/chat-completions/audio) documentam modalidades adicionais, sujeitas a modelos, parâmetros e cobrança próprios. Não foram migradas a sessão Realtime ou as APIs de anexos.

## Validação e limites

149 testes Node aprovados na suíte final, incluindo 15 novos testes comportamentais do transporte, contexto, orçamento e cliente. TypeScript aprovado. Preview local automatizado com respostas simuladas valida streaming, continuidade, HUD desktop/mobile, estado da Abacus, 429 sem repetição e rejeição real 401 nas rotas locais. Regressões existentes de voz, HUD e anexos também executadas. Build e CI são registrados na evidência final da tarefa.

Nenhuma chamada real a modelo pago foi feita. Sem essa autorização, qualidade, latência, preço, cache e modelo final reais de uma conta não foram medidos. Não houve publicação em produção, merge na main, recarga automática ou contratação.

## Evolução recomendada

1. Orçamento e estatísticas persistentes compartilhados entre instâncias, antes de considerar o limite financeiro global.
2. Catálogo autenticado /v1/models e tabela de preços verificável por modelo, somente após autorização de leitura e validação da integração; não copiar identificadores de marketing para execução.
3. Memória persistente opt-in, por proprietário/projeto, com exclusão e origem; não confundir com memória do ChatLLM.
4. Imagem/áudio/vídeo com rotas e orçamento específicos, duração/quantidade máximas e confirmação de execução. Ferramentas externas exigem permissões e trilha de resultados reais.
