# Demonstrações progressivas do JK

Data: 27/10/2026. Branch exclusiva: feature/diretor-tecnico-agent. Base auditada: cc9d3c290aef79864b706ecbd9b6e471ceb4665b.

## Comportamento implementado

Cada resposta visual recebe um plano de apresentação. O quadro principal pode ocupar esquerda, direita, topo, base ou centro. O centro recolhe o núcleo JK e suspende seu renderizador; o término ou fechamento restaura o núcleo. Um indicador econômico pode manter um mapa menor como apoio. A home começa sem quadros fixos. “Explorar quadros” é a alternativa explícita de leitura livre; uma nova resposta volta à demonstração.

Textos de demonstração aparecem progressivamente; gráficos são desenhados e os dados são revelados por etapa. Pausar congela a apresentação e a digitação. Há controles de etapa anterior/seguinte, ritmo, reinício e exploração. Movimento reduzido mantém o conteúdo legível. A aba oculta deixa de avançar a apresentação. A troca de resultado remove listeners e temporizadores anteriores.

Respostas genéricas com vários pontos são apresentadas como exemplos sucessivos, com posições diferentes. Quando houver dados estruturados e verificáveis, são usados os módulos correspondentes: gráficos, mapas, comparação, linha do tempo, mídias recebidas e estados operacionais. Não são inventadas imagens, medições ou pesquisas para preencher a interface.

A fala continua prioritária no computador. A transcrição integral não ocupa o quadro principal: há acesso opcional “Ler resposta em texto”, abertura de texto quando a fala está indisponível e preservação da leitura no mobile. Resultados e relatório integral também ficam na coleção transitória da sessão.

## Voz e sincronização

O sintetizador do navegador emite eventos de início, limites de palavras quando oferecidos, término, cancelamento e erro. O diretor usa a posição desses eventos para ajustar gradualmente a apresentação. Sem eventos de palavras (incluindo saídas neurais que não os exponham), a sequência usa temporização guiada. Não se promete alinhamento semântico palavra a palavra ou análise do áudio do sintetizador.

A sessão neural existente mantém autenticação e bloqueios de custo. Recebe uma ferramenta adicional somente de leitura, jarvis_visual_research, para consultar a rota interna autenticada de pesquisa e projetar o resultado retornado. A ferramenta de estado operacional foi preservada. As duas compartilham o limite de uma consulta por interação, validam argumentos e deduplicam call_id. A nova ferramenta não inicia sessão neural nem autoriza gastos.

## Geografia

Mapa-múndi vetorial local Natural Earth 1:110m, com 177 áreas, seleção por teclado/clique, busca de países, zoom e deslocamento. Países identificados no pedido podem ser destacados. Há também o mapa brasileiro do IBGE já existente.

“Buscar país” seleciona a malha local; cidades e endereços são encaminhados pelo link oficial Google Maps URLs. Não há geocodificação incorporada, iframe não oficial, chave Google nem habilitação de faturamento. Ao abrir o link, o usuário navega ao Google Maps.

Limites cartográficos: simplificação, pequenos territórios e fronteiras disputadas; não é material cadastral, de navegação ou uma definição política de fronteiras.

Fontes:
- https://www.naturalearthdata.com/about/terms-of-use/
- https://github.com/nvkelso/natural-earth-vector
- https://developers.google.com/maps/documentation/urls/get-started
- https://servicodados.ibge.gov.br/api/docs/malhas?versao=3

## Economia brasileira com evidências

Pedidos sobre economia brasileira, IPCA, Selic e dólar consultam quatro endpoints públicos fixos:
- BCB SGS 433: IPCA mensal, 12 observações.
- BCB SGS 432: meta Selic, coleta recente com exclusão de datas futuras.
- BCB SGS 1: dólar comercial de venda, coleta recente.
- IBGE SIDRA/agregados 1737, variável 63, Brasil: conferência do IPCA mensal.

As consultas GET são paralelas, sem credenciais, com timeout de 9 segundos por fonte, bloqueio de redirecionamentos e limite de 180 kB por resposta. Observações futuras, datas impossíveis e valores inválidos são excluídos. Deflação é preservada como valor negativo, com escala e linha de zero.

Cada série tem sua unidade e período. Fontes, horário de consulta, falhas e divergências ficam acessíveis na home e no PDF. Conferir o mesmo IPCA em BCB/IBGE é a comparação da mesma estatística disseminada em dois locais, não duas medições independentes. Indicador indisponível não vira zero nem gráfico fictício. Dados defasados recebem aviso.

Cache e deduplicação são temporários por instância: cinco minutos em sucesso completo, um minuto em sucesso parcial e quinze segundos em falha total. Uma requisição compartilhada já iniciada pode continuar até seu timeout mesmo se um cliente cancelar. O cache não é memória de conversa nem garantia de disponibilidade distribuída.

Esta implementação cobre esses indicadores. Não cobre pesquisa geral de notícias, todos os países, PIB, desemprego ou diagnóstico econômico abrangente. O roteamento já existente para o provedor autorizado permanece disponível para outros assuntos.

## Exportações locais

- PDF: capa visual quando aplicável, resposta integral, módulos, todas as observações recebidas, fontes, datas e limitações. Páginas rasterizadas em JPEG dentro do PDF; o texto não é pesquisável/selecionável. URLs extensas são quebradas para evitar corte.
- PNG: demonstração principal desenhada em canvas, em 1440×900.
- WebM: sequência visual silenciosa de 8 a 24 segundos, 12 FPS, 1024×640. Usa WebCodecs/VP8 com timestamps explícitos e contêiner WebM de duração finita. Cancela e libera VideoFrames/codificador. Não captura microfone, tela ou áudio do sistema. Navegador sem codificador compatível informa a limitação e oferece PNG/PDF.
- JSON: cena normalizada para integração futura.

Mídias externas são referências nos arquivos exportados. Não são baixadas silenciosamente para contornar restrições de origem. Os arquivos não contratam serviços nem fazem chamadas de geração de mídia. O vídeo é uma animação dos quadros disponíveis; não é geração audiovisual por IA.

Referências do formato/codificador:
- https://www.w3.org/TR/webcodecs/
- https://www.webmproject.org/docs/container/
- https://github.com/ietf-wg-cellar/matroska-specification/blob/master/ebml_matroska.xml

## Segurança e manutenção

As rotas exigem sessão autenticada. A rota de pesquisa rejeita origem cruzada, corpos acima de 8 kB e consultas acima de 1.500 caracteres. URLs de consulta são fixas; o usuário e o modelo não escolhem endpoints. A normalização continua rejeitando módulos arbitrários, URLs privadas, esquemas executáveis e URLs com credenciais.

Não foram alterados catálogo de projetos, 188 plataformas, credenciais, banco, permissões dos conectores, política de custos ou produção. Nenhuma dependência de runtime foi adicionada.

Arquivos centrais:
- lib/holo/presentation.ts: plano, etapas, escala de gráficos e URLs do Maps.
- app/components/holo/useDemonstration.ts e CinematicPresentation.tsx: ciclo e composição transitória.
- app/components/holo/HoloWorldMap.tsx e config/holo-world-*.json: cartografia local.
- lib/research/economy.ts e server.ts: fontes oficiais, validação e cache.
- app/api/director/research/route.ts: consulta protegida para a sessão neural.
- lib/holo/export-renderer.ts e webm.ts: desenho/exportação local.
- lib/voice/speech-output.ts e lib/holo/speech-progress.ts: eventos de fala.
- app/components/holo/HoloExportMenu.tsx: seleção, progresso e cancelamento.

## Como verificar

1. node --test tests/*.test.mjs
2. npx tsc --noEmit
3. npm run build
4. Em terminal separado, usar exclusivamente o servidor de fixture em loopback:
   JARVIS_CONNECTORS_TEST_FIXTURE=1 node -r ./tests/fixtures/connectors-runtime.cjs node_modules/next/dist/bin/next start -H localhost -p 3156
5. node tests/browser/cinematic-smoke.cjs
6. node tests/browser/holo-response-smoke.cjs

Os scripts de navegador não se destinam a produção. Usam sessão e voz simuladas, não contas reais. Por padrão, o transporte da pesquisa também é simulado. Somente com JARVIS_RESEARCH_PUBLIC_NETWORK=1 o servidor de fixture permite GET aos quatro endpoints públicos fixos; demais serviços continuam simulados/bloqueados.

A suíte verifica digitação, pausa, avanço automático/manual, suporte lateral, mapa, Maps, falhas, autorização, fontes, galeria e bytes exportados. O vídeo também é carregado, decodificado e reproduzido próximo do fim. A validação independente usa pdfinfo/pdftoppm e ffprobe. O Chrome isolado deste ambiente pode cancelar a gravação do download no disco; os testes verificam a geração e a captura dos bytes, além da iniciação do download, sem afirmar que a política de downloads do computador foi alterada.

Resultados finais e limitações da sessão são registrados no relatório de validação.
