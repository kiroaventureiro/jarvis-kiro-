# JK Holographic Experience 2.0

Refinamento incremental da experiência aprovada. Branch exclusiva: feature/diretor-tecnico-agent. Nenhuma mudança de autenticação, credenciais, custos, APIs de provedores ou permissões de conectores.

## Comportamento

A demonstração automática não mostra barra temporal, contador de quadros, números sequenciais ou tempo restante. Pausar, continuar, rever e interromper permanecem acessíveis por teclado. Opções reúne ritmo, modo sem animação e Explorar quadros. Abrir opções, fontes, transcrição ou uma ação do painel pausa a apresentação visual; a pessoa decide quando retomá-la.

A transcrição fica sob demanda. A fala e os resultados visuais continuam separados. O núcleo aprovado é preservado; cede o centro aos dados e é recolhido durante a demonstração em telas compactas para evitar sobreposição.

## Camadas

- lib/holo/content-planner.ts: plano tipado por área disponível, mensagem, dados essenciais, fonte, destaques, origem, tempo mínimo, revelação e critérios de conclusão. Usa síntese já fornecida e divisão determinística em palavras completas; não chama outro modelo para resumir nem inventa fatos.
- lib/holo/reveal.ts: segmentação Unicode, escrita por palavras/trechos adaptativos e destaques semânticos limitados. Intl.Segmenter tem alternativa sem dependência externa.
- lib/holo/director.ts: máquina de estados testável. Tempo é uma condição mínima, nunca autorização suficiente para trocar o conteúdo.
- useDemonstration.ts: relógio visual único, eventos de fala, pausa, recuperação e preferência local não sensível.
- useHoloAutoFlow.ts: observação de dimensões/mutações, medição agrupada, acompanhamento do texto recém-escrito e rolagem automática dentro do painel.
- HoloPlaybackContext, HoloTypewriter e HoloAutomaticContent: renderização e escrita sem intervalo React por caractere; texto integral estável para tecnologias assistivas.
- CinematicPresentation: composição, controles e acesso sob demanda. Mantém o modo Explorar separado do fluxo automático.

## Regra de conclusão

Cada transição exige: identidade do conteúdo atual; escrita concluída; conteúdo essencial observado; tempo mínimo; permanência de leitura após a última parte; e condição de narração relevante, quando disponível. Evidência atrasada de um quadro anterior é rejeitada.

O planejamento primeiro usa mensagens concisas e divide textos grandes. Relatórios e linhas do tempo deixam de cortar o conteúdo nos quatro primeiros itens. Se ainda houver excesso de altura, o fluxo segue automaticamente o conteúdo. Nenhum avanço é permitido com parte essencial ainda oculta. Em área ilegível, falha de carregamento ou limite de segurança, a apresentação pausa com orientação para ampliar/retomar/explorar, preservando o conteúdo; não o descarta e não fica em repetição infinita. Tokens sem espaços e dimensões extremas continuam sujeitos a essa recuperação.

ResizeObserver ajusta o plano quando a área muda; a origem lógica é preservada sempre que possível. Abas ocultas não avançam o relógio visual. Observadores, timers e listeners são removidos no encerramento.

## Voz e limites de sincronização

Eventos de boundary recentes condicionam a transição pela fração da narração e destacam temporariamente indicadores reconhecidos no trecho falado. A correspondência entre texto narrado e síntese visual usa proporções estimadas; não é alinhamento exato palavra a palavra. Sem eventos por quatro segundos, ou após término/erro da voz, o ritmo estimado evita travamento. Cancelamento pausa. Pausa da demonstração controla o visual; os controles de voz existentes continuam responsáveis pelo áudio.

## Tipografia, cores e movimento

Inter variável é servida localmente em public/fonts/InterVariable.woff2 (352240 bytes), com licença OFL em Inter-LICENSE.txt. Fonte oficial: https://rsms.me/inter/ . Não existe chamada a CDN de fontes em tempo de execução, dependência JS adicional ou redução automática indefinida da fonte. Corpo confortável, hierarquia, números tabulares, contraste e ausência de brilho direto no texto.

Ciano mantém a identidade. Branco suave, azul, turquesa, âmbar, coral, violeta e cinza-azulado distinguem contextos. Rótulos e valores acompanham cores. Os destaques são regras conservadoras de apresentação, não reconhecimento universal de entidades. prefers-reduced-motion e Sem animação oferecem texto integral imediato e deslocamento por páginas com intervalo de leitura.

## Gráficos e mapas

IPCA, Selic e câmbio possuem identificação e cores distintas; valores, unidades, períodos, sinais e fontes são preservados. Tela compacta separa gráfico histórico de última observação para manter o desenho legível. Comparações categóricas mostram todos os valores em grupos adequados à área, com escala compartilhada entre os grupos. Nenhuma amostra ou valor ausente é criado. Explorar mantém a tabela completa.

Mapas usam a malha geográfica já existente e focos contextuais progressivos. A projeção automática omite controles de busca e etiquetas excessivas; Explorar devolve seleção e link externo do Google Maps. Não é uma integração paga com Google Maps, nem navegação viária/consulta em tempo real.

## Exportações

PDF e JSON usam a cena original: texto integral do relatório, dados, datas e fontes. A projeção resumida é identificada como Síntese visual. PNG representa a demonstração principal. WebM continua sendo uma recapitulação visual curta e silenciosa (8–24 s), não um documentário integral nem uma cópia fiel de toda a sessão de voz. O renderizador de vídeo usa os conteúdos planejados sem substituir a cena original. Download final depende da política do navegador; os testes também validam os bytes gerados independentemente do salvamento pelo Chrome automatizado.

## Verificação

Comandos de base: node --test tests/\*.test.mjs ; node node_modules/typescript/bin/tsc --noEmit ; npm run build.

Testes novos: tests/holo-experience-v2.test.mjs e tests/browser/holo-v2-smoke.cjs. Regressões: cinematic-research, cinematic-smoke (exportação), holo-response, holo-modules, attachments, voice e HUD. Execução de navegador usa servidor local com fixtures, sessão de teste isolada e voz simulada, sem ativar microfone real, modelos pagos ou contas externas. Os cenários de tempo acelerado usam o fallback SVG do núcleo para determinismo; a identidade original WebGL não foi reescrita.

Evidências antes/depois, logs e resultados detalhados acompanham o relatório local de entrega. Testes de navegador desktop não substituem validação física em iPhone/Safari e Windows com as vozes instaladas. O Preview exige a autenticação normal do proprietário para consultas protegidas.
