# JK Visual Freedom + investigação geral

Data: 28/10/2026. Branch feature/diretor-tecnico-agent. Base: ba62189741ded3b5a3f999258b0ab86dffc61f24.

## Compreensão e investigação

Uma camada de intenção antecede geografia, história e pesquisa contextual. Nome de país não acrescenta mapa automaticamente. O mapa obrigatório foi retirado da apresentação econômica: gráficos e observações são suficientes quando não há pedido geográfico.

A interpretação semântica agora pode receber um pedido sem nomes técnicos ou palavras previstas. Ela ocorre antes dos filtros lexicais; entidades explícitas, vínculos e permissões ainda são validados pelo código. Continuação pode selecionar o contexto autorizado existente. Uma interpretação não pode substituir um projeto ausente por outro nem transformar uma modificação explícita em autorização de execução.

Foi corrigido um defeito do classificador: o pedido de classificação anterior concatenava instruções e catálogo no texto do usuário, ultrapassando o limite de 1.500 caracteres antes de chegar ao provedor. O catálogo e o contrato agora são mensagens de sistema internas; o texto do usuário continua separado e limitado.

O classificador usa a autorização e o orçamento Abacus já existentes, sem nova contratação. JARVIS_COGNITIVE_SEMANTIC_ENABLED=false o desliga explicitamente. Quando há credencial e autorização de uso já configuradas, pode interpretar pedidos fora dos gatilhos locais. Isso pode consumir uma chamada adicional dentro da cota existente; não se promete custo idêntico por pergunta. Testes usam respostas simuladas e não acionam modelo pago.

## Pesquisa pública gratuita

KnowledgeResearch consulta referências públicas da Wikipédia em português, com alternativa em inglês quando não há resultado, sobre assuntos não cadastrados no aplicativo. Guarda título, link, revisão, horário e atribuição de licença. Tem limites de tamanho/tempo e cache de referências públicas. Consultas identificadas como privadas, credenciais ou dados pessoais não são enviadas automaticamente.

Quando a Abacus já está autorizada, as referências entram como dados externos não confiáveis no contexto da síntese. Sem modelo autorizado, pode retornar os excertos de referência com atribuição e limitações explícitas. Essa alternativa é enciclopédica: não substitui notícias de hoje, pesquisa de toda a web, geocodificação de ruas ou uma análise independente completa.

A consulta externa real foi verificada para semicondutores e retornou três fontes com revisão e atribuição. Fonte técnica: https://www.mediawiki.org/wiki/API:Search ; extração: https://www.mediawiki.org/wiki/Extension:TextExtracts ; termos de reutilização: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use .

## Busca web via Abacus

O adaptador Responses API foi implementado e testado com respostas simuladas. Pode disponibilizar somente web_search, contar uso, distinguir pesquisa confirmada de resposta sem consulta e entregar citações. Não disponibiliza código, compras ou controle de computador. Não persiste resposta no provedor por padrão e não repete chamadas pagas após falhas.

A ativação financeira NÃO foi feita. Exige simultaneamente a política Abacus existente, chave no servidor e configuração explícita de JARVIS_ABACUS_WEB_RESEARCH_ALLOWED=true, JARVIS_ABACUS_WEB_MODEL e JARVIS_ABACUS_WEB_MAX_OUTPUT_TOKENS (350 a 4.000). O modelo deve ser compatível e autorizado na conta; isso não foi presumido ou testado com créditos reais. Fontes: https://api.abacus.ai/help/route-llm/responses . Não há recarga, compra ou serviço novo ativado.

## Voz

Ativar escuta contínua não chama mais a limpeza da narração. O controlador distingue fala própria de fala externa e acompanha o estado do gerenciador de áudio. Enquanto uma resposta é narrada, a escuta fica armada, com reconhecimento suspenso; retoma após a apresentação. O indicador não afirma microfone ativo quando ele não está ativo.

Nova pergunta por teclado cancela a resposta anterior, suspende o reconhecimento durante o processamento e conserva o modo armado. Desligar só a escuta não cancela uma narração iniciada pelo teclado. Permanecem consentimento inicial, proteção contra eco e alternativas manuais. A escuta não é prometida com página fechada ou celular bloqueado.

O watchdog da síntese respeita pausas nativas longas; cancelamentos limpam o estado de pausa antes da próxima fala. A coordenação continua sendo por capítulos, não alinhamento palavra a palavra. Interrupção por voz simultânea ao alto-falante não foi implementada como barge-in irrestrito.

## Linguagem visual

Mapas, gráficos, mídia, escrita curta e capítulos da timeline usam superfícies transparentes, sem bordas ou sombras de cartão. Comparações e leitura densa mantêm contenção legível quando necessário. Os contêineres DOM continuam para acessibilidade, controles e medição; não impõem aparência de dashboard.

Mapa protagonista fica sem parágrafos colados ao redor na apresentação automática; conteúdo e fontes permanecem na exploração e exportação. Fundo ganhou planos de circuitos, malha em perspectiva, base orbital e luz volumétrica sutil, preservando o núcleo JK. São projeções web com profundidade visual, não uma simulação física de holografia.

As transições respeitam movimento reduzido. O modo paisagem compacta cabeçalhos para não reduzir a leitura abaixo da área mínima necessária nem sobrepor o compositor.

## Autodesenvolvimento e limites reais

A investigação pode buscar fontes fora da memória e os conectores continuam oferecendo diagnóstico e preparação supervisionada de melhorias. Esta entrega não retreina pesos do modelo, não cria permissões e não publica alterações no próprio código sem o fluxo de aprovação, branch, testes e Preview existente. O catálogo segue extensível por adaptadores reais.

Permanecem os limites financeiros e de saída já existentes. Nenhuma produção, main, migração, credencial ou serviço pago novo foi alterado. Resultados de testes e o Preview do commit final estão no relatório de entrega.

A ferramenta da sessão neural também passa a consultar referências públicas e leituras locais dos projetos autorizados, sem iniciar um modelo adicional para essa consulta. A troca da sessão neural para escuta contínua pode ser armada durante a resposta e aguarda o término do áudio antes de encerrar a entrada neural. Esse fluxo é verificado com WebRTC e áudio simulados; não foi efetuada sessão paga real.
