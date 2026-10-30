# Issue 16 — identidade cósmica e boletim transitório

## Base auditada

Implementação iniciada sobre `main` em `1deee58ccf750a9023c15315d84ac6d18f3a342a`, incluindo os PRs #14 e #15 já incorporados. A produção consultada antes da alteração era `dpl_CeEPsfb9GxVMmw6JT4CDz4nbj2ih`, READY, no projeto Vercel `jarvis-kiro`, domínio `jarvis-kiro.vercel.app`.

Alterações anteriores ainda locais foram preservadas em outra cópia de trabalho. Esta entrega não substitui implementações recentes de Navi, autenticação, conectores, cofre, permissões ou limites de custo.

## Implementação

- Home usa `CosmicScene` em lugar da esfera/pedestal. A imagem original do proprietário foi incorporada sem alteração: `public/cosmic/star-orbiting-black-hole.jpg`, 109368 bytes, SHA-256 `e3a37da394870d8072782e15f8042943729cd199ad69b152427b0a564a42b7b8`.
- Câmera CSS com zoom limitado, arrasto, deslocamento por teclado e restauração por botão, Home ou Escape. Dois dedos aproximam e deslocam; um dedo preserva a rolagem. Roda do mouse não é capturada.
- Fluxo dourado e órbita azul contínuos; intensidade acompanha o estado existente de voz e eventos reais de síntese. A animação é representativa, sem alegar leitura de amplitude de áudio.
- Reduced-motion, economia gráfica/dados, aba oculta e cena fora da área visível suspendem movimento. Não exige GPU/WebGL nem baixa um motor 3D. O efeito espacial é parallax sobre raster; não há reconstrução volumétrica de uma foto.
- “Entrar no núcleo” aproxima a câmera e conduz à navegação interna progressiva. As nove áreas existentes continuam acessíveis, incluindo Conexões e Configurações; nenhuma conta é conectada por clicar em um atalho.
- Boletim reutiliza o endpoint autenticado, fontes e gerenciador de voz existentes. Sem transcrição persistente na conversa. Apenas aviso compacto e leitura sob demanda. Recolhe após 16s quando ocioso; durante narração aguarda conclusão, depois recolhe em 1,8s.
- Recolher o painel não para a voz. Mute, volume zero, sessão de conversa ativa, aba oculta e desmontagem são respeitados. Não inicia uma sessão neural paga para contornar autoplay.
- Botão discreto permite repetir. “Jarvis, repita o boletim” funciona no caminho local da conversa; a ferramenta neural pode consultar o endpoint de pesquisa autenticado para obter o boletim real. A configuração e os custos da sessão neural existente permanecem os mesmos.
- Dock continua compacto; revela com foco/hover e permanece visível durante narração do boletim, composição de texto ou trabalho com arquivos.

## Validação reproduzível

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
node tests/integration/cosmic-ui.cjs
```

No Windows, o teste usa Chrome instalado. No CI Linux, `npx playwright install --with-deps chromium` prepara o navegador. O workflow verifica a branch da issue, a PR para main e a main após publicação.

`cosmic-smoke.cjs` utiliza servidor Next real e respostas de conta/voz simuladas no navegador, sem inferência externa. Cobre ativo original, autenticação real anônima do endpoint (401/no-store), autoplay permitido/bloqueado, volume zero, falha de fonte, narração longa, recolhimento/replay, mute, cancelamento ao navegar, ausência de armazenamento do boletim, arrasto/teclado, entrada no núcleo, navegação progressiva, suspensão em aba oculta, layout móvel e pinça simulada.

Testes unitários adicionais verificam integridade do ativo, intenção explícita de repetição e distinção entre dados econômicos confirmados, ausentes e verificação antiga. Os testes existentes de autenticação, cofre, conectores, orquestração e voz permanecem na suíte.

## Limites da evidência

Capturas renderizadas e emulação móvel não equivalem a teste físico de microfone/Safari em um iPhone. A voz real disponível depende do sistema, preferências, sessão e política de autoplay. Sem autorização de áudio, o usuário encontra Ouvir/Ler. A cotação/agenda/e-mail ausentes não são fabricados. Não foram iniciados modelos pagos, testes reais de gravação em serviços externos ou mudanças de autorização.

Os identificadores finais de commit, execução CI e deployment READY devem ser conferidos na entrega junto à issue/PR; o texto deste documento não substitui essa verificação.
