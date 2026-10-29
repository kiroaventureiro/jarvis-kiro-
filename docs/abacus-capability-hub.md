# Abacus no JK: capacidades, conta e integrações

Revisado em 28/10/2026. Branch de desenvolvimento: feature/diretor-tecnico-agent.

## Caminho implementado

Central de Conexões → painel Abacus → rotas autenticadas → catálogo oficial / cofre criptografado → exibição e contexto operacional.
Pedidos naturais explícitos de criação de imagem → catálogo autenticado → primeiro modelo compatível do conjunto conhecido → orçamento existente → uma chamada → mídia e HUD. Não há execução automática só por um modelo sugerir uma ferramenta.

## Descoberta sem geração

GET /api/director/abacus/hub?verify=1 consulta no servidor:

- GET https://routellm.abacus.ai/v1/models.
- GET https://api.abacus.ai/api/v0/listRouteLLMTools.

Timeout, tamanho máximo, sanitização de campos e cache de 60 segundos. Modelos e ferramentas têm estados independentes: falha na lista de ferramentas não apaga um catálogo de modelos válido.
Descobrir ferramentas não as autoriza. supported e requires_connectors são informativos; executionAuthorized é sempre false nesta etapa.
O JK responde a perguntas sobre recursos, conta, modelos, ferramentas e créditos da Abacus sem inventar o acesso.

## Conta privada

PUT /api/director/abacus/hub permite registrar uma observação estruturada e datada do proprietário: plano, saldo observado, serviços cadastrados, tarefas, agentes e quantidades de opções de catálogo.
O registro é guardado no cofre criptografado já existente de conectores, com trilha de auditoria. Não usa uma nova tabela, a chave da memória ou o histórico de conversa como armazenamento.
Sem cofre disponível, o salvamento falha explicitamente. Nenhuma informação privada de faturamento foi adicionada ao código versionado.
A observação não constitui saldo em tempo real. Após 24 horas a interface a sinaliza como antiga. Não há scraping contínuo da sessão do navegador.

## Imagem, áudio e análise visual

POST /api/director/abacus/media aceita apenas kind, model, prompt e, para vision, uma imagem base64 explícita.

- Imagem: modalities image, num_images 1.
- Áudio: modalities text+audio, mp3, voz definida para o mecanismo. Não foi feita promessa de timbre masculino confirmado em cada plataforma.
- Vision: conteúdo de imagem entra como dado não confiável, sem ferramentas.

Autenticação, origem, tamanho, modelo do conjunto implementado E presença no catálogo autenticado são verificados antes da geração. Chaves, URLs arbitrárias, ferramentas e endpoints vindos do cliente são rejeitados.
A execução usa a política paga e o orçamento de chamadas/tokens já existentes. Não compra créditos, altera plano ou habilita recarga. Os limites continuam por instância e não garantem teto financeiro distribuído. Não houve teste com geração real faturada nesta entrega.
Resultados base64 são convertidos em Blob no navegador. Imagens geradas pela conversa são registradas na mídia local do HUD. Não se usa armazenamento efêmero de uma função Vercel para servir mídia em outra função.
URLs de imagem precisam passar a política de mídia existente; uma URL assinada incompatível pode ser rejeitada depois de a geração ter ocorrido. Não existe retry automático.
Áudio está disponível para criar, ouvir e baixar no laboratório. A narração principal do HUD mantém o mecanismo existente; este trabalho não troca automaticamente a voz do navegador/OpenAI pela Abacus.
Vídeos, agentes, Brain e automações da interface ChatLLM têm navegação e descrição de estado, mas não um executor de API implementado nesta entrega.

## Novas fontes públicas

Crossref e Open Library foram integradas ao chat e à rota de pesquisa da voz. Consultas naturais de artigos/estudos ou livros/bibliografia produzem quadros com título, autoria, ano e links.
São metadados, não leitura integral ou validação das conclusões. Consultas detectadas como privadas não são enviadas para essas fontes. Não se alega anonimização perfeita.
Somente endpoints HTTPS fixos, leitura, limites de resposta/tempo, cache e limitação por instância. Não há envio de histórico inteiro nem credencial.
Fontes existentes preservadas: Wikipedia, Wikimedia Commons, BCB, IBGE e referências geográficas. As 188 plataformas catalogadas continuam distintas das integrações executáveis.

## Limites que dependem de terceiros

A sessão Abacus aberta no navegador não é uma credencial transferível ao JK.
Conectores OAuth, MCP e ferramentas do ChatLLM não são herdados por uma chave RouteLLM.
Ferramentas registradas podem consumir custo de kernel e várias rodadas, e o resultado da API não fornece auditoria de cada chamada. Por isso este trabalho descobre essas ferramentas, mas não habilita execução opaca de todas elas.
Novos acessos sensíveis e serviços pagos exigem seus fluxos próprios. A aplicação não treina seus próprios pesos nem muda produção autonomamente.

## Evidências

Teste automatizado: tests/abacus-hub.test.mjs.
Teste de navegador isolado: tests/browser/abacus-hub-smoke.cjs.
Fixture apenas em loopback: tests/fixtures/abacus-hub-runtime.cjs.
Consultas reais às fontes públicas foram verificadas separadamente, sem modelo pago.
Os detalhes privados observados na sessão autorizada pertencem ao relatório privado / cofre, e não a esta documentação.

## Documentação oficial consultada

- https://api.abacus.ai/help/route-llm/
- https://api.abacus.ai/help/route-llm/chat-completions/
- https://api.abacus.ai/help/route-llm/chat-completions/image-analysis
- https://api.abacus.ai/help/route-llm/chat-completions/audio
- https://api.abacus.ai/help/route-llm/responses
- https://api.abacus.ai/help/chatllm-ai-super-assistant/faqs/billing
- https://studio.abacus.ai/faq
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- https://openlibrary.org/dev/docs/api/search
