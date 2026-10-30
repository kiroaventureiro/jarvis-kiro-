# Jarvis Kiro — identidade cósmica

> Direção anterior rejeitada pelo proprietário. A nova especificação está em
> `docs/PROCEDURAL-JARVIS-PREVIEW.md`: cena procedural em tela inteira, sem
> fotografia, texto permanente, botões de câmera ou navegação por rolagem.
> Preferências somente sob demanda. O conteúdo abaixo é registro histórico,
> não uma instrução para restaurar a proposta rejeitada.

## Referência e atmosfera
A composição fornecida pelo proprietário é o próprio Jarvis: buraco negro, disco dourado, fluxo azul e estrelas. O ativo original está em `public/cosmic/star-orbiting-black-hole.jpg`; não há pedestal, rosto, esfera JK antiga ou cenário industrial. Preservar a imagem em alternativas sem GPU.

## Cores e tipografia
Base carvão `#050609`, texto marfim `#f4eee3`, secundário `#a8adb7`, acento de controles ouro `#dbbd92`. Azul pertence ao fenômeno celeste da referência, não a todos os painéis. Interface usa a família sans-serif existente do aplicativo para evitar downloads e regressões. Títulos por peso e espaçamento; controles discretos e legíveis.

## Composição e navegação
Primeira dobra dominada pela cena. Controles de câmera e voz pequenos; nenhum boletim textual permanente. Interior do núcleo acessível por rolagem, teclado e botão. Coluna editorial assimétrica no desktop; uma coluna no celular. Links de ferramentas surgem gradualmente com IntersectionObserver; todos permanecem no DOM e acessíveis ao teclado. Não alterar permissões ao navegar.

## Movimento
Imagem raster com câmera CSS, fluxo dourado, pulsação azul e órbita. É pseudo-profundidade, não geometria astronômica 3D. Mover exclusivamente transform e opacity. Nenhum loop WebGL, inferência ou nova captura de áudio. Suspender em aba oculta, preferência gráfica eco, economia de dados e reduced-motion. Estado visual vem do controlador de voz e eventos reais de síntese; sem alegar análise do sinal acústico.

## Interações e acessibilidade
Alvos de pelo menos 44px; foco visível e rótulos claros. Mouse arrasta; botões e teclado aproximam/restauram. Dois dedos aproximam e deslocam a cena; um dedo continua rolando a página. Não capturar a roda do mouse. Home/Escape restauram a câmera. Não depender de cor para estado de microfone.

## Boletim
Resumo do endpoint autenticado existente, sem histórico de conversa persistente. Narração pelo gerenciador de voz existente; respeitar sessão, mute, volume e autoplay. Aviso compacto recolhe em 16s quando ocioso e após a conclusão da fala quando narrado. Fechar o painel não cancela a voz; silenciar, conversa ativa, aba oculta e desmontagem cancelam a narração própria. Leitura sob demanda em details e atalho de repetição.
