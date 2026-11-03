# Jarvis Kiro — ingresso de homologação n8n

Esta integração adiciona um endpoint server-side para encaminhar comandos estruturados do Jarvis Kiro ao webhook HML do n8n sem expor a credencial no navegador.

## Endpoint

- Método: `POST /api/orchestration/hml`
- Requer sessão Jarvis válida (`jarvis_session`).
- Exige mesma origem HTTP do Jarvis.
- Encaminha o JSON recebido para o webhook HML com o cabeçalho `X-Jarvis-Key`.
- Limite de corpo: 32 KiB.
- Timeout upstream: 8 segundos.
- Não segue redirects.
- Não registra payloads nem segredos em logs.

## Configuração server-only

Defina no ambiente de servidor do Jarvis:

- `JARVIS_HML_INGRESS_URL=https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/commands`
- `JARVIS_HML_INGRESS_KEY=<mesmo segredo da credencial Header Auth do webhook Entrada de comandos>`

A chave deve ter pelo menos 32 caracteres e nunca pode usar prefixo `NEXT_PUBLIC_`.

O destino é deliberadamente restrito ao host `n8n.guardioesdaorigem.com.br` e ao caminho `/webhook/jk-hml/v1/commands`, evitando que variáveis mal configuradas transformem o endpoint em um proxy SSRF.

## Limites de segurança

- O endpoint fica desabilitado e retorna 503 enquanto URL e chave não estiverem configuradas.
- O workflow n8n deve derivar `authenticatedOrigin` de configuração confiável do servidor, não do JSON recebido.
- A autenticação Header Auth do n8n precisa usar o mesmo segredo.
- Ambiente permanece `homologation`.
- Ações externas permanecem desabilitadas; executor deve continuar `mock_only` e entrega de resultados `blocked`.
- Este endpoint é apenas o transporte autenticado. Ele não autoriza execução, publicação, envio de mensagens nem acesso à memória de produção.

## Integração pendente

Antes de habilitar as variáveis, alinhar o contrato JSON do nó de canonicalização do workflow **JK | HML | Entrada de comandos** com o objeto estruturado que o Jarvis produz. O workflow **JK | HML | Recuperação** é separado e não deve ser usado como destino.

Não publicar o workflow de Entrada nem ativar gravação até confirmar o contrato e a credencial Header Auth correspondente.
