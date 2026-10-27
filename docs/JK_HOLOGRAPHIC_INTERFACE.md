# Interface holográfica JK — implementação e validação

Branch: feature/diretor-tecnico-agent. Referência principal: imagem JK fornecida pelo proprietário. Base auditada: c18b3fd7f2c4388ad4ab8871a7dd8073c6586606. Data: 27/10/2026.

## Resultado

A home mantém seus controles e fluxos e passa a apresentar um monograma JK vetorial próprio, com face grafite, volume, reflexos e borda ciano, envolvido por uma malha esférica tridimensional. Quatro órbitas inclinadas têm segmentos luminosos, velocidades distintas e partículas que percorrem as trajetórias. Profundidade altera a intensidade de segmentos à frente e atrás da esfera. O monograma fica estável acima da malha para preservar a leitura.

O fundo escuro usa rede geométrica, polígonos discretos, brilhos distantes e linhas em perspectiva. Uma emissão luminosa inferior e anéis de base sustentam a composição. A imagem não é usada como fundo nem como substituta da interface; todos esses elementos são desenhados pelo aplicativo.

## Arquitetura

WebGL nativo foi escolhido para evitar uma dependência Three.js/R3F apenas para este núcleo. Geometria, shaders e buffers ficam em lib/hologram e são carregados dinamicamente. SVG desenha o monograma e o fallback; CSS cuida de iluminação e fundo. Não há modelos, texturas ou fontes externas para carregar.

A política de fases acompanha os estados existentes: repouso, aguardando ativação, ouvindo, processando, respondendo e erro. Arquivos em análise e orientação por voz também entram nesses estados. O fluxo completo é ação do usuário → estado de voz/anexos/assistente → fase do núcleo → brilho e movimento; a resposta continua passando pelo HUD e pela política de áudio já existentes.

O AnalyserNode observa somente MediaStreams de entrada ou saída já autorizados na sessão neural. Calcula intensidade RMS suavizada em memória, sem gravação, persistência, envio ou ligação adicional ao alto-falante. O núcleo não chama getUserMedia. Na Web Speech API, que não disponibiliza o sinal neste fluxo, ou sem suporte/contexto de áudio ativo, usa animação representativa. Essa distinção é indicada internamente e explicada nas configurações. Um fluxo encerrado deixa de ser apresentado como análise ativa.

## Desempenho e acessibilidade

- Até 150 partículas da esfera; perfil econômico limita a 80. As partículas orbitais são limitadas a 28.
- Perfil automático: alvo máximo de 40 FPS e DPR até 1,5. Perfil econômico: 24 FPS e DPR até 1. Hardware limitado e telas pequenas usam o perfil econômico automaticamente.
- Canvas limitado a aproximadamente 1,4 milhão de pixels; redução adicional da resolução após lentidão sustentada. Se a lentidão severa persistir na resolução mínima, troca automaticamente para o fallback vetorial.
- Buffers e geometria são criados na inicialização e reutilizados nos frames.
- Pausa do requestAnimationFrame com página oculta; movimento reduzido produz uma composição estática que ainda acompanha mudanças de estado.
- Perda de contexto WebGL troca para fallback vetorial; restauração reconstrói os recursos. Desmontagem remove observers, listeners, frames, buffers, shaders, programas e analisadores.
- Modo econômico selecionável em Configurações → Aparência e movimento. Preferência não sensível armazenada localmente quando disponível.
- Canvas decorativo fica fora da navegação assistiva. Controles e indicadores existentes mantêm rótulos, foco visível e notificações acessíveis. O monograma permanece visível no celular, sem rolagem horizontal.

Os alvos de FPS são limites de trabalho, não garantia em todo hardware. Os testes de WebGL usam renderização por software do Chrome; não constituem benchmark da GPU física do proprietário.

## Preservação e segurança

Somente a camada visual, sua política gráfica e os pontos de observação dos fluxos já existentes foram alterados. Não foram modificadas rotas de API, autenticação, política de custos, credenciais, assinaturas ou banco. A integração Abacus, o registro operacional, a memória local/Supabase, a palavra Jarvis, os oito projetos, as 188 plataformas, o arrastar/colar arquivos e os painéis de resultados permanecem preservados. As respostas conversacionais seguem prioritariamente por áudio no computador e com transcrição no mobile.

## Validação

Os 178 testes Node passaram, incluindo sete novos testes do núcleo. A checagem TypeScript e o build Next.js passaram. A home passou de 122 kB para 126 kB de JavaScript no primeiro carregamento; o renderizador WebGL é carregado em um módulo separado. Nenhuma dependência foi adicionada. A suíte inclui testes comportamentais de fases, geometria com profundidade, limites de partículas/pixels, redução adaptativa, observação e descarte de áudio. A validação em navegador cobre desktop 1440×1000, celular 390×844 e tela pequena 320×740; monograma central, ausência de overflow, composição estática com movimento reduzido, estados de voz, teclado, pausa por visibilidade, fallback, recuperação do contexto e descarte de recursos.

Um teste específico usa um oscilador sintetizado para alimentar MediaStreams reais de teste: verifica intensidade de entrada e saída, uma única captura simulada acionada pelo controle existente e nenhuma captura adicional pelo efeito. Serviços externos e voz são simulados nesses testes; não há chamadas pagas nem uso real do microfone do sistema.

Resultados finais de testes, TypeScript, build, CI e Preview são registrados no relatório de entrega local junto às capturas.

## Fidelidade e limites

A identidade da referência foi preservada: JK preto/grafite com bordas ciano, esfera circular luminosa, órbitas elípticas, partículas, campo poligonal escuro e emissão inferior. O monograma é desenho vetorial com relevo visual, não uma fonte comum. A malha e as órbitas possuem coordenadas 3D e projeção; a face do logotipo usa uma representação vetorial de volume para ficar sempre legível.

A imagem original contém detalhes de luz próprios de uma imagem renderizada. O aplicativo reproduz essa linguagem em tempo real com geometria limitada, sem simulação física completa de plasma, reflexos ou volumetria. O fallback SVG aproxima o volume com curvas e transparências; não oferece a mesma profundidade do WebGL. Sem sinal de áudio acessível, a pulsação é representativa. Não foi testado em um iPhone físico nesta sessão.

Referências técnicas: [WebGL e gestão de recursos](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) e [AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode).
