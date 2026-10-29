# JK — resposta holográfica multimodal

Implementação na branch feature/diretor-tecnico-agent, sobre a base da Central de Conexões e da identidade JK existentes. A referência visual orienta cores, profundidade, núcleo e painéis; não é usada como captura estática de um sistema supostamente conectado.

## Experiência

A home inicia com o núcleo JK, identificação e controles essenciais. Resultados são contextuais: até três painéis no desktop e um de cada vez no celular, com seleção de módulos, expansão, fechamento, reabertura e navegação para /resultados. Uma saudação curta não abre um dashboard.

A barra inferior mantém voz, teclado e áudio e acrescenta acesso a mídia/documento e à Central de Conexões. O seletor de arquivos é oculto; arraste em toda a home e colagem continuam funcionando. Adicionar um arquivo não o envia automaticamente. Os limites e a autorização da análise anterior foram preservados.

No desktop, conversa por teclado, wake word e resultados da análise dos anexos usam voz como prioridade quando existe voz pt-BR, áudio habilitado e volume positivo. Sem fala disponível, a resposta escrita fica acessível no HUD, com expansão. No celular, o texto continua disponível. Títulos, tópicos e resultados visuais não reproduzem automaticamente toda a fala como conversa fixa.

A reprodução de vídeo desliga a escuta na home, evitando captar o áudio do player como novo comando. A escuta não é reativada automaticamente pelo vídeo. O usuário pode ativá-la novamente pelo controle existente.

## Três camadas

1. Núcleo: HolographicCore e política de áudio/estado já existentes, preservados. A fase visual distingue repouso, escuta, processamento, resposta, mídia, execução de análise e erro. As barras de andamento são indeterminadas; não simulam percentual de tarefa nem métricas ausentes.
2. Orquestração: lib/holo/orchestrator.ts e validation.ts. Transformam respostas e resultados conhecidos em cenas tipadas; não fazem uma segunda chamada de modelo. Conversa continua pela Abacus e a sessão neural permanece separada.
3. Ferramentas/saídas: módulos reutilizáveis em app/components/holo, Central de Conexões e coleção transitória /resultados. Nenhum painel executa gravação, shell, merge ou deploy por conta própria.

## Módulos entregues

| Módulo          | Comportamento                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| HoloText Stream | Títulos/frases curtas digitados, tags e opção de fade; respeita movimento reduzido e limpa timers       |
| HoloMap         | Brasil com 27 unidades selecionáveis, zoom, restauração e fonte IBGE; carregado sob demanda             |
| HoloTimeline    | Eventos selecionáveis com explicação e referência                                                       |
| HoloReport      | Resumo, tópicos, versão completa expansível, acesso ao plano e exportação JSON da cena                  |
| HoloMedia       | Imagens locais e URLs explícitas de imagem/vídeo, mini player nativo, erros legíveis e sem autoplay     |
| HoloCompare     | Duas possibilidades lado a lado, extraídas de opções explícitas da resposta                             |
| HoloMetrics     | Barras, linhas, radar e anéis com números recebidos; escala relativa identificada                       |
| HoloConnections | Estados do registro operacional, escopo/evidência e vencimento visual da validação; não presume conexão |

Mapas atualmente disponíveis: Brasil. Não há mapa mundial ou geocodificação automática nesta versão. Para outros temas, o sistema usa os módulos para os quais dispõe de conteúdo, sem inventar coordenadas ou imagens.

## Seleção contextual e origem dos dados

- História/território do Brasil: referência local preparada com mapa IBGE, marcos históricos e roteiro. A resposta identifica que não é pesquisa ao vivo. Não chama modelo pago. Exemplo: JK, me fale da história do Brasil.
- Diagnóstico autorizado: usa o plano real retornado pelos conectores. Contagens representam etapas concluídas/pendentes/falhas; não são um benchmark de velocidade, SEO ou performance do site. Falhas e ausência de autorização continuam visíveis na Central.
- Sistemas/conexões: usa o snapshot operacional do ambiente. Evidência com mais de 60 segundos deixa de aparecer como conexão atualmente validada. Cofre indisponível não significa todos desconectados.
- Criatividade: os tópicos vêm da resposta recebida. Opção A/Opção B pode produzir comparação. Não são inventadas thumbnails ou assets supostamente gerados.
- Arquivos: a análise existente produz relatório resumido e referências das imagens enviadas. No desktop, a síntese do navegador pode falar o resultado; falha da fala libera texto.
- Mídia por URL: pedir para mostrar/reproduzir uma URL HTTPS direta .mp4/.webm ou de imagem suportada prepara o player. O carregamento externo exige clique e mostra o domínio. Não equivale a geração ou análise audiovisual.
- Respostas genéricas longas: síntese em relatório curto; datas explicitamente presentes podem produzir timeline, identificada como extração da resposta sem verificação adicional. Não se convertem números quaisquer em métricas.

A documentação histórica não promete cobertura completa da história do país. As fontes e a distinção entre fronteiras atuais e acontecimentos históricos acompanham os módulos.

## Memória visual e privacidade

Até seis cenas ficam na memória do React durante a navegação interna. Não há localStorage, sessionStorage, IndexedDB ou sincronização remota da coleção visual. O consentimento anterior de histórico textual continua separado e não é ativado por esta implementação.

Prévias de imagens de resultados usam Object URLs próprios da sessão. Assim, navegar para /resultados não exige salvar base64, manter a fila de upload montada ou reenviar a imagem. URLs são revogadas ao limpar a coleção, remover cenas por retenção ou desmontar o provedor. O teto de seis análises e os limites de arquivos existentes limitam a retenção. Recarregar/fechar apaga a coleção; exportação é uma ação explícita.

A exportação entregue é JSON estruturado. Não há exportação PDF, montagem de apresentação, vídeo gerado, busca de imagens ou serviço novo contratado. O payload e o início do download foram testados. Neste ambiente isolado, o Chrome cancela a gravação de downloads inclusive em um teste independente de arquivo .txt; a conclusão do salvamento no navegador real do proprietário ainda precisa de conferência manual.

## Segurança e desempenho

Cenas têm versão, tipos conhecidos, limites de tamanho, quantidade e valores finitos. URLs executáveis, credenciais na URL, hosts privados comuns e mídias SVG/HTML são rejeitados. Texto é renderizado como texto React, sem HTML bruto. Links de ação internos só navegam para áreas conhecidas; não concedem aprovação aos conectores. Segredos com formatos reconhecidos são ocultados; isso não substitui classificar dados privados antes de usá-los.

Não existe autoplay, iframe arbitrário, fetch de mídia no servidor, nova chave no frontend ou instrução executável vinda de arquivo/issue/log. A malha cartográfica é um recurso local atribuído ao IBGE; não faz chamada ao IBGE a cada abertura da home. O mapa é um chunk sob demanda. A política gráfica automática e a alternativa vetorial anteriores permanecem ativas.

Restrições de Safari/iOS continuam aplicáveis. Testes de viewport e user agent no Chrome não representam validação em iPhone físico. Não há escuta com navegador fechado, sistema bloqueado ou aplicativo em segundo plano.

## Fontes da referência Brasil

- Geometria: [IBGE, API oficial de malhas geográficas](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), Brasil, intrarregião UF, qualidade mínima, consultada em 2026-10-27. Caminhos vetoriais derivados dos dados geográficos, com projeção e simplificação indicadas em config/holo-brazil-map.json. Não usar para precisão cadastral.
- Marcos: [Atlas Histórico do Brasil, FGV](https://atlas.fgv.br/).
- Constituição: [Câmara dos Deputados, Constituição de 1988](https://www2.camara.leg.br/atividade-legislativa/legislacao/constituicao1988).

## Testes

- node --test tests/\*.test.mjs
- node node_modules/typescript/bin/tsc --noEmit
- npm run build
- Fixture explícita de loopback já documentada em docs/native-development-connectors.md; com servidor em localhost:3156, executar tests/browser/holo-response-smoke.cjs.

O vídeo de teste é uma cor silenciosa de um segundo gerada localmente com FFmpeg. Não contém mídia de terceiros. APIs de contas, IA e análise de arquivos são simuladas quando necessário; o endpoint local de referência Brasil foi exercitado de fato. Nenhuma conexão real ou serviço pago é criado por estes testes.
