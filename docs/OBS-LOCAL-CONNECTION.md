# OBS / Kiro TV — leitura local no Jarvis

A Central de Conexões oferece **OBS / Kiro TV · consulta no mesmo aparelho**.
É um cliente do protocolo oficial OBS WebSocket v5, executado no navegador.
Não é agente de execução, controle de computador ou processo na Vercel.

## Como usar

1. No computador que tem o OBS instalado, abra a versão experimental do Jarvis e
   entre em **Conexões → OBS / Kiro TV**.
2. No OBS, use **Ferramentas → Configurações do servidor WebSocket**. Habilite
   o servidor com autenticação e confira a porta (padrão 4455).
3. No campo local do Jarvis, informe a senha WebSocket gerada pelo OBS, nunca
   uma senha de conta. Clique **Verificar OBS local**.
4. Se o navegador solicitar acesso a aplicativos/serviços neste dispositivo,
   permita esse acesso para o site Jarvis. Se já estiver bloqueado, ajuste a
   permissão específica do site pelo ícone ao lado do endereço. Não desative
   as proteções do navegador nem a autenticação do OBS.
5. A resposta mostra horário, versão OBS/WebSocket, cena atual, cenas disponíveis
   e se transmissão/gravação estão ativas. A conexão é encerrada após a leitura.

No celular, 127.0.0.1 aponta para o próprio celular, não para o PC. Esta versão
não acessa OBS de outro aparelho, não aceita IP remoto nem configura túneis.
Se o navegador não oferecer suporte à conexão segura de loopback, a UI informa
falha. Não há fallback que exponha o OBS ou retire proteções.

## Escopo e senha

O cliente usa somente `GetVersion`, `GetSceneList`, `GetStreamStatus` e
`GetRecordStatus`, após identificação autenticada. Não troca cenas, inicia lives,
grava, altera áudio ou executa comandos arbitrários. Eventos não são assinados.

A senha fica transitoriamente na memória do formulário e do cliente. O campo é
limpo ao iniciar; não há localStorage, cookie, log ou POST ao servidor Jarvis.
A autenticação usa a resposta SHA-256/base64 ao desafio do OBS, conforme protocolo;
a senha em texto não é transmitida pelo WebSocket. O destino é fixo em
`ws://127.0.0.1:<porta>`, validada entre 1024 e 65535. Não há varredura de portas.
Cancelamento, falha e timeout encerram o socket sem reconexão automática.

## Evidência

- Testes executaram a implementação: algoritmo oficial de desafio, quatro
  solicitações de leitura, recusa de autenticação, servidor sem autenticação,
  resposta inválida, timeout, cancelamento e porta inválida.
- Teste de navegador usou um servidor local compatível com OBS v5 e tráfego
  WebSocket real, incluindo origem HTTPS e autenticação verificada no servidor.
- Sem permissão local, o Chromium bloqueou com
  `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`. Após conceder a permissão
  apenas ao domínio fictício do teste, a conexão HTTPS → loopback passou.
  A automação usa a permissão `local-network-access` reconhecida pela versão
  instalada do Playwright; a UI consulta a permissão granular `loopback-network`.
  Nenhuma flag desativou verificações do navegador.
- A interface passou nas larguras 1440, 390 e 320, com senha limpa e nenhum POST
  ao servidor. Capturas em `/tmp/jarvis-obs-evidence` contêm dados simulados.
- Não há uma instalação real de OBS neste ambiente nem acesso ao computador do
  proprietário. A conexão ao OBS dele depende das ações acima e não foi declarada
  concluída. O teste de compatibilidade não cobre todos os navegadores/dispositivos.

Fontes oficiais:
https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access
