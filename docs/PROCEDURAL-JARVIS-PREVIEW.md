# Correção visual solicitada pelo proprietário

Esta prévia substitui a direção anterior da issue #16, rejeitada pelo proprietário. Não considerar o relatório de publicação anterior uma aprovação deste novo desenho.

## Nova direção

- A tela em repouso mostra somente o Jarvis procedural e o campo estelar.
- Sem fotografia carregada, logotipo escrito, mensagens de repouso, botões Restaurar/Entrar no núcleo ou lista de ferramentas por rolagem.
- Canvas 2D desenha geometria, ruído, partículas, horizonte escuro, disco dourado, luz curvada e estrela azul. Texturas auxiliares são geradas por código, não derivadas da fotografia.
- A estrela se desloca em órbita com passagem de frente/fundo; o plasma gira; o ponto de vista acompanha discretamente o mouse.
- Preferências recolhidas: borda inferior por mouse, toque ou teclado. Fechar recolhe os controles e o campo de escrita. A navegação existente continua oculta no canto superior.
- O boletim conserva o caminho de voz existente, sem painel, legenda ou atalho visível na cena. Repetição natural permanece disponível.
- Movimento reduzido/economia gráfica congelam o desenho procedural. Se Canvas estiver indisponível, o fallback também é geometria SVG, sem a fotografia.

## Etapa de entrega

Prévia para revisão do desenho e das proporções antes de substituir novamente a produção, conforme o pedido de desenvolver primeiro o código da cena. Conectores, cofre, autenticação e limites de custo não foram modificados.

## Validação

Testes de navegador conferem desktop, celular 390px, tela 320px, reduced-motion e fallback sem Canvas: ausência de requisições de imagem, ausência de controles/textos permanentes, animação, enquadramento sem rolagem e abertura/recolhimento das preferências. Testes de órbita e geração determinística verificam a geometria sem serviços externos.
