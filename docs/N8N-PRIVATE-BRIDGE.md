# Ponte privada Jarvis Kiro ↔ n8n Community (Windows)
Esta implementação não usa Cloudflare Tunnel, não altera DNS nem abre a porta 5678 externamente.
## Componentes
- `/api/director/n8n-jobs`: interface autenticada do proprietário, enfileira tarefas autorizadas e mostra resultados.
- `/api/director/n8n-bridge`: worker com Bearer secret exclusivo e consulta de tarefas em HTTPS.
- `scripts/n8n-bridge-worker.ps1`: executor local Windows; neste estágio executa apenas **project_report**, consulta os metadados de workflows do n8n usando API local. Outros três tipos de tarefas são retornados como não implementados, sem execução.
- Estado da fila: cofre criptografado `JARVIS_CONNECTOR_*`, separado por ambiente. Falha fechado sem chave ou cofre.
## Configuração obrigatória
1. No painel Vercel do projeto Jarvis, configurar `JARVIS_N8N_BRIDGE_SECRET` com um segredo aleatório de no mínimo 40 caracteres. Use ambientes separadamente: nunca reutilize segredo entre production e preview. A integração permanece inativa até implantar o commit.
2. Não alterar `JARVIS_CONNECTOR_STORE_URL`, `JARVIS_CONNECTOR_STORE_KEY`, `JARVIS_CONNECTOR_ENCRYPTION_KEY` e `JARVIS_CONNECTOR_NAMESPACE` se já funcionam. São necessários para persistir a fila criptografada.
3. No Windows, guardar segredo e chave da API n8n em variáveis protegidas da sessão (nunca em comandos enviados a chats, repositório ou capturas). Iniciar worker com: `powershell -NoProfile -File .\scripts\n8n-bridge-worker.ps1 -JarvisUrl "https://DOMINIO_JARVIS" -BridgeSecret $env:JARVIS_N8N_BRIDGE_SECRET -N8nApiKey $env:JARVIS_N8N_API_KEY`.
4. Em Configurações → Canal privado n8n — Jarvis, solicitar relatório de projetos. O resultado deve ser `completed` após o worker ler a lista de workflows localmente. Outros botões não indicam execução dos serviços externos.
5. Proteger o computador e a Vercel; revogar segredos comprometidos. O token Cloudflare Tunnel mostrado anteriormente deve ser rotacionado ou o túnel removido se não for utilizado.
## Limitações importantes
- O Windows precisa estar ligado e o worker em execução.
- A chave n8n com escopos totais dá acesso muito amplo. O worker atual só invoca GET de workflows e não faz alterações.
- Este canal ainda não é um integrador universal de todas as contas conectadas no n8n. Cada workflow requer mapeamento, autorização e retorno de resultado.
- Os testes de código não substituem deploy, inicialização do worker, autorização da conta e validação ponta a ponta.
- O conector HTTPS direto `/api/director/n8n` é independente e não será usado para n8n local nesta modalidade; não tente cadastrar localhost nele.
