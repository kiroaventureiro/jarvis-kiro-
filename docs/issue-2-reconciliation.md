# Issue #2 — reconciliação e checkpoints

## Origem recuperada

O trabalho local interrompido estava implementando o Criador de interfaces nativo: lib/design, /criador, análise visual autenticada, prévia isolada, extração estática de HTML/CSS e ZIP. Os sete testes iniciais passavam; o primeiro build falhou por um parêntese excedente no botão ZIP, corrigido antes desta reconciliação. Não havia uma entrega publicada dessa capacidade.

A base desse trabalho era 32ff0d3fd4e674e1b6818d17c575e26665806b69. A branch avançou em 26 commits do Navi até fca6787923815effda2e33b26b9a713c84905985. Foram incorporados os nove arquivos modificados/adicionados de memória, cofre, comandos de projetos e Developer Platform. A rota Abacus foi reconciliada preservando os dois roteadores. Não foram criados painéis de memória nem removidos projetos, conectores ou as correções de fala anteriores.

## Causas do incidente

1. O endpoint /api/director/research, usado pela ferramenta neural, não chamava answerAbacusPlatformQuestion. O endpoint de texto tinha prioridade corrigida pelo Navi, mas o caminho de voz ainda podia ignorá-lo.
2. A expressão wantsNames continha limite de palavra escapado como texto. Frases de listagem podiam cair no resumo de contagem.
3. Uma chamada genérica jarvis_operational_status não bastava para listar nomes. Agora o cliente redireciona essa chamada para a leitura real quando a pergunta do usuário pede recursos Abacus/Avacus/Abagus.

## Implementação

- Texto, streaming local e pesquisa neural priorizam a leitura autenticada de projetos/deployments; sem hardcode de contagens ou nomes.
- Parse de campos projectName/deploymentName, GET apenas em dois métodos permitidos, corpo limitado, tempo total de 18 segundos, máximo de 20 projetos, 30 deployments por projeto e 60 deployments na resposta. Limites, marcadores de paginação e falhas de consultas produzem resultado parcial. IDs ficam nas requisições internas.
- Sem projetos, não classificar uma consulta não executada de deployments como validada. Falhas não viram negação genérica de uma ferramenta implementada.
- Matriz tipada supported/unsupported/not_verified, separando Developer Platform, chatbot deployado, conversa AI Agent, ponte de navegador e tarefas/mídia.
- Probe opcional somente de leitura getDeploymentConversation para um identificador fornecido pelo proprietário. Confirma apenas metadados e não executa continuação ou cria conversa.
- Sessões de voz têm admissão persistente no cofre existente quando configurado, com atualização por revisão do mesmo StateStore. Relatos de uso são limitados e deduplicados; não guardam texto ou áudio. A voz e o texto podem consultar o consumo. Tokens recebidos via navegador são client_reported, não fatura nem teto financeiro confiável.
- VAD configurado explicitamente para criar respostas e interromper fala quando o usuário volta a falar. Desligar somente o microfone mantém a saída de áudio, preservando o comportamento anterior.
- Política de modelo aceita gpt-realtime e gpt-realtime-2.1 mediante configuração do servidor, sem fallback pago. O padrão continua gpt-realtime. A migração não foi ativada: a tabela oficial consultada mostra saída de texto a US$24/milhão no 2.1 contra US$16/milhão no anterior; áudio permanece US$32/US$64 por milhão para entrada/saída. Revisar orçamento antes de habilitar.

## Superfícies Abacus e prova necessária

| Superfície | Implementação | Limite da prova |
|---|---|---|
| RouteLLM | Catálogo e adaptadores existentes preservados | Catálogo não comprova execução de todos os modelos |
| Developer Platform | Leitura e nomes por texto/ferramenta de voz | Verificar em Preview autenticado no commit desta entrega |
| Chatbot deployado | Contrato oficial identificado | Exige deployment compatível e deploymentToken; nenhuma inferência paga testada |
| AI Agent da aba | Probe documentado de metadados, se o ID for aceito | ID da UI não é assumido equivalente; continuação e criação continuam não verificadas |
| Ponte navegador do JK | Não instalada | Exige runtime isolado, sessão protegida e aprovação de operações/gastos; não reutilizar cookies do Codex |
| Vídeo, apps e tarefas do ChatLLM | Não executados | Não inferir permissões a partir de projetos/deployments |
| Criador de interfaces | Capacidade nativa, independente das skills do Codex | Protótipo estático; extração não clona React/WebGL |

## Fontes oficiais consultadas

- https://abacusai.github.io/api-python/autoapi/abacusai/client/index.html — list_projects, list_deployments, get_deployment_conversation e get_conversation_response.
- https://api.abacus.ai/help/developer-platform/useCases/CHAT_LLM — implantação e API de chatbots.
- https://developers.openai.com/api/docs/guides/realtime-vad — interrupção de resposta com VAD.
- https://developers.openai.com/api/docs/guides/voice-latency-cost?voice-api=realtime — medição e limites de contexto.
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1 e /gpt-realtime — preços e capacidades.
- https://developers.openai.com/api/docs/deprecations — gpt-realtime previsto para remoção em 20/01/2027.

## Checkpoints de aceite

A. Texto retorna nomes da API. B. Ferramenta de voz retorna os mesmos nomes por rota real. Ambos têm testes com respostas simuladas, variantes de ASR e streaming. READY/CI não substituem a prova funcional do Preview.

C. Compatibilidade de deployment com chat ainda precisa de metadados e credencial específica, sem solicitar segredo em conversa. D. Delegação de tarefa paga não foi executada. E. Continuação da conversa AI Agent existente ainda depende de confirmação de suporte/autorização do provedor; o probe não dá essa permissão.

Teste acústico real com microfone Windows e iPhone permanece necessário para validar latência, interrupção, eco e retomada. A simulação de navegador não deve ser relatada como teste físico. Sem merge na main, sem mudança de produção e sem execução paga nos testes.
