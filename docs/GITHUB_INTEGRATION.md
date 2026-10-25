# GitHub → Jarvis (leitura apenas)

## Já implementado
- `GET /api/github` no backend Next.js, com autenticação obrigatória e token `GITHUB_READ_TOKEN` no servidor.
- Inventário limitado aos metadados necessários: nome, privacidade, URL, atualização, descrição, branch.
- Workflow `n8n/workflows/github-inventory.json` com início manual, consulta e compactação. Desativado por padrão.

## Para ativar
1. Configurar credencial fine-grained GitHub com somente leitura de metadados nos repositórios necessários; selecionar escopo para repositórios privados. Nunca compartilhar token no chat ou Git.
2. Configurar `GITHUB_READ_TOKEN` nas variáveis privadas da Vercel. A rota /api/github exige sessão autenticada; o painel sem tela de senha **não consegue usá-la ainda** até login sem digitação estar pronto.
3. No n8n, importar o workflow JSON e configurar uma credencial Header Auth com Header `Authorization`, valor `Bearer <token>`, guardado exclusivamente no n8n.
4. Testar manualmente; verificar que o retorno só contenha os campos necessários; depois decidir se uma rotina é realmente útil.
5. Não expor o endpoint n8n à internet sem TLS e autenticação. N8n local precisa estar ligado; um site Vercel não consegue alcançar diretamente localhost de outro computador.

## Observação
O backend e o n8n são alternativas de consulta; **não devem disparar ambos para a mesma solicitação**.
Falta criar o roteamento do agente para usar /api/github e o WebRTC. Não há sincronização ativa, agendamento ou execução em produção.
