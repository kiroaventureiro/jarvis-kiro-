# Issue #5 — abertura do Codex / ChatGPT

Implementado na branch `feature/diretor-tecnico-agent`, sem deploy ou inferência.
Não depende de SDK, MCP, cofre, API paga ou autenticação adicional.

## Demonstração em dois minutos

1. No Jarvis, abra **Escrever mensagem** (no desktop, foco de teclado ou hover na
   área inferior revela os controles).
2. Envie: **Jarvis, peça ao Codex para revisar o jogo Sistema Origem**.
3. Confira o painel **Pedido para o Codex** e o briefing visível. Clique em
   **Abrir Codex com pedido**. O link usa `codex://new?prompt=...&originUrl=...`,
   com ambos os valores codificados por `encodeURIComponent`.
4. No aplicativo instalado, confira o texto no composer e envie quando desejar.
   O link não envia, não escolhe Cloud, não cria checkout e não seleciona a branch.
   `originUrl` apenas tenta associar um workspace já existente; não usa path Linux.
5. Se não abrir, use **Copiar pedido** e **Abrir Codex Web**. Também é possível
   **Abrir ChatGPT** e colar o texto. Nenhuma URL web promete pré-preenchimento.
6. Experimente **pergunte ao Navi como organizar minhas ideias**: o mesmo fluxo
   oferece cópia + ChatGPT, sem inventar um esquema de URL para esse destino.

O resultado fica na plataforma de destino. O Jarvis informa **pedido preparado**
ou **abertura solicitada**, nunca running/completed sem evidência remota. Uma falha
do esquema personalizado não é detectável com segurança no browser; o fallback
fica disponível o tempo todo. Links usam gesto nativo, sem `window.open`, timers,
redirecionamento automático ou pop-up programático.

## Privacidade e escopo

O briefing é montado no cliente a partir somente da mensagem atual, sem histórico,
anexos, leitura de configuração ou logs do texto preparado. Inclui repositório de
referência, branch experimental, objetivo, aceite e limites. Outro projeto citado
exige confirmação do repositório no destino. O objetivo tem limite de 400 caracteres
Unicode, com aviso explícito de abreviação; a URL permanece abaixo de 8 KB nos
casos extremos testados. Possíveis tokens, chaves, cookies e atribuições de senha
são recusados antes da abreviação. O filtro não substitui a revisão humana do texto.
A recusa remove o painel anterior para evitar enviar um pedido antigo por engano.

Se a API de clipboard falhar, o campo permanece selecionável para cópia manual.
O pedido e o estado do handoff ficam apenas no estado da interface; não são registros
de tarefa do executor. O histórico de conversa existente mantém sua política própria.

## Evidência e limites

- Fonte oficial conferida: https://learn.chatgpt.com/docs/app/commands,
  seção Deep links: `prompt` preenche o composer; não envia automaticamente.
- `node tests/codex-app-handoff.test.mjs`: cinco testes de intenção, encoding,
  Unicode, origem permitida, segredos, tamanho e navegação por gesto.
- `node tests/browser/codex-handoff-smoke.cjs`: fluxo real da interface em Chromium
  nas larguras 1440, 390 e 320; pedido de revisão, pedido genérico ChatGPT/Navi,
  cópia e falha de clipboard, fallback, estados honestos, sem overflow e sem
  chamadas `/api/director/`. `window.open` é bloqueado deliberadamente no teste.
- Capturas locais em `/tmp/jarvis-handoff-evidence/handoff-{1440,390,320}.png`.
- TypeScript sem emissão passou. A suíte Codex existente continua como regressão.

O teste de navegador impede a navegação externa após validar o href e exercitar o
handler de clique. Não comprova abertura do aplicativo nativo Windows: esse ambiente
é Linux e não possui o app Windows do proprietário. A verificação manual do composer
no Windows permanece pendente; não declarar esse critério como aprovado.
Não houve envio de pedido, novo serviço pago, commit, push, merge ou deploy.
As alterações locais da issue #4 e `next-env.d.ts` foram preservadas.

## Próximas conexões — backlog independente

### Acessos diretos operacionais na interface

O botão **Aplicativos** e a seção **Abrir agora** da Central de Conexões oferecem
Codex, ChatGPT, Google, Microsoft 365, GitHub da branch experimental, Supabase e
Vercel. Os comandos “abra o navegador”, “abra Microsoft” e “pesquise no Google
sobre ação e café” são tratados localmente e preparam links por gesto do usuário.
Não acionam API paga, não autorizam contas e não equivalem a controle remoto.
O mesmo teste de navegador validou pesquisa Unicode e atalhos em 1440/390/320 px.

Verificação externa em 29/10/2026: GitHub autenticado; projeto Vercel `jarvis-kiro`
localizado; bancos `jarvis-kiro` e `jarvis-kiro-connectors` ativos no Supabase,
com tabela de cofre e RLS habilitada no banco de conectores. Isso comprova acesso
destas ferramentas de administração, não uma sessão autenticada do Jarvis.
Nomes de variáveis de preview confirmam sessão e cofre configurados, sem leitura
de seus valores. Não constam variáveis de VoiceStudio nem de aplicativos OAuth
GitHub/Supabase/Vercel nessa listagem; conexões já salvas no cofre não foram lidas.
O catálogo de Google/Microsoft não é um conector executável.

A URL pública `https://jarvis-kiro.vercel.app` respondeu 200 na raiz, mas 404 em
`/api/director/connectors` e `/api/director/operational-status`. Não presumir que
essa versão já contém as implementações do workspace. A publicação permanece
dependente da autorização solicitada para uma versão de teste, preservando produção.

1. Google Drive: selecionar e ler arquivos somente nos escopos autorizados.
2. Gmail e Calendar: definir leitura e ações permitidas antes de habilitar escrita.
3. Redes sociais e demais apps: inventariar conectores disponíveis e permissões por conta.

Esses itens não são pré-requisitos do handoff e não foram iniciados nesta entrega.
