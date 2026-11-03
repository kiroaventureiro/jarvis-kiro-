# Jarvis Kiro — inbox autenticado dos agentes

## O que foi implementado
`POST /api/director/agent-transport` aceita **apenas eventos** de `n8n` ou `windows_agent`. O conteúdo é validado, assinado e deduplicado atomicamente no cofre cifrado Supabase já existente. Não há execução remota, delegação Codex, leitura de arquivos do Windows, comandos de shell, atualização de estado de tarefas nem promoção automática para produção.

## Configuração no servidor
O cofre do Jarvis precisa estar configurado e funcionando (`JARVIS_CONNECTOR_STORE_URL`, `JARVIS_CONNECTOR_STORE_KEY`, `JARVIS_CONNECTOR_ENCRYPTION_KEY`). Configure **por serviço** no ambiente em que o agente se conectará:
- `JARVIS_AGENT_N8N_SECRET`: segredo aleatório forte de pelo menos 32 caracteres
- `JARVIS_AGENT_WINDOWS_SECRET`: outro segredo aleatório forte, distinto, de pelo menos 32 caracteres

Nunca colocar esses segredos em `NEXT_PUBLIC_*`, GitHub, prompts, URL, código JavaScript do navegador ou relatórios. O serviço emissor deve obter seu próprio segredo por canal administrativo seguro. Não reutilize credenciais da memória do Jarvis.

## Contrato de mensagem
JSON UTF-8 de até 4096 bytes:
```json
{"version":1,"source":"n8n","messageId":"uuid-ou-id-unico","taskId":"id-correlacao","createdAt":"2026-11-03T06:00:00.000Z","type":"health","status":"ok","summary":"executor em funcionamento"}
```
Headers:
- `x-jarvis-agent-source: n8n` ou `windows_agent`
- `x-jarvis-agent-timestamp: <Unix epoch em milissegundos, 13 dígitos>`
- `x-jarvis-agent-signature: <hex lowercase HMAC-SHA256(secret, timestamp + "." + corpo bruto UTF-8)>`

O corpo JSON deve ser **idêntico byte a byte** ao corpo assinado. A janela de validade é de cinco minutos, a ID deve ser exclusiva por origem e a mesma mensagem recebe HTTP 409 em reenvios. A resposta 202 apenas confirma recebimento persistido, nunca que uma tarefa terminou. Mensagem não autenticada retorna 401.

`GET /api/director/agent-transport` exige sessão do proprietário e mostra se o cofre e cada origem estão configurados, sem segredos. `GET /api/director/agent-capabilities` mostra inventário e disponibilidade do inbox.

## Etapas ainda necessárias para executar tarefas de ponta a ponta
1. Configurar segredos reais, cofre e origem estável HTTPS no ambiente de Preview.
2. Conectar workflows n8n e agente Windows ao protocolo; cada worker assina e envia eventos; confirmar 202, 401 e 409 reais.
3. Criar esquema de filas/despacho com vínculo a uma tarefa aprovada, concessão de escopo e executor autenticado, idempotência e resultados auditáveis; implementar separadamente e testar antes de disponibilizar controles de execução.
4. Validar segurança de workers, callbacks, autenticação, gastos e ações destrutivas. Nunca interpretar `task_result` como aprovação suficiente para marcar uma tarefa Codex como concluída.

Não publicar este endpoint como executor remoto e não ativar privilégios novos automaticamente.
