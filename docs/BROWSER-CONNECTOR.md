# Navegador supervisionado — Preview

`/integracoes/navegador` oferece a ligação local com a extensão em `extensions/jarvis-browser`. A página exige sessão do proprietário. Download autenticado de seis arquivos em `/api/director/browser-extension`, sem credenciais, dependências ou dados locais no pacote.

A extensão atende exclusivamente o domínio estável da branch `fix/hml-integration-audit`, caminho `/integracoes/navegador`, frame principal e modo normal. Não aceita produção, iframes, outros sites ou janelas anônimas. Não usa cookies, debugger, nativeMessaging, portas locais, shell nem permissões permanentes sobre todos os sites.

Operações: listar até 50 abas normais HTTP/HTTPS (título e URL sem query/fragmento), abrir HTTPS, ativar uma aba, solicitar navegação HTTPS, ler até 8 mil caracteres da aba ativa, preencher um único campo identificado por rótulo exato. Leitura/preenchimento dependem de `activeTab`: o proprietário ativa a aba de destino e abre o ícone da extensão antes de autorizar. Campos sensíveis são recusados; nenhum formulário é submetido automaticamente. Sites podem reagir ao evento de preenchimento.

Cada pedido precisa de aprovação explícita no popup da extensão. Negar não executa nada. A fila local admite um pedido pendente por vez, expira em cinco minutos, vincula o resultado à aba que iniciou o pedido e bloqueia reexecução de pedidos já processados. Um worker interrompido no estado executing não repete a operação automaticamente. Abertura/navegação confirma envio ao navegador, sem alegar carregamento ou conclusão de um objetivo no site.

Resultados ficam no estado temporário desta tela; não são enviados ao servidor/IA/n8n. A leitura é conteúdo externo não confiável. Não há interpretação por voz nem controle automático pela conversa nesta primeira versão; as ações são solicitadas no painel. O ID público da extensão é informado manualmente, sem segredo de pareamento ou persistência de credenciais.

Instalação requer revisão e consentimento do proprietário: extrair ZIP, abrir a página de extensões do Chrome/Edge, carregar a pasta sem compactação e fixar o ícone. Não foi publicada em loja. A ferramenta não deve carregar/autorizar esta nova extensão sem confirmação específica. Só declarar funcionamento real após instalação e teste no navegador do proprietário.

Referências oficiais: [mensagens externas](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [origens autorizadas](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable), [activeTab](https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-activetab).
