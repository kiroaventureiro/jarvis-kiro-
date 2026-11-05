# Skills e ferramentas do Jarvis

Os 20 skills de `wshobson/agents` e os quatro perfis especialistas já estavam incorporados ao protocolo cognitivo. A ligação operacional usa as ferramentas do Jarvis, preservando suas permissões. Não transfere sessões, credenciais ou ferramentas privadas do Codex para o aplicativo.

## Descoberta

- `/controle`: inventário completo, ferramenta de apoio e requisitos por skill.
- `GET /api/director/local-skills`: inventário autenticado e estado salvo dos conectores.
- `GET /api/director/local-skills?verify=1`: também consulta o catálogo n8n ao vivo. Sem executar workflows, instalar programas ou consumir modelos.
- Conversa: “Quais skills e agentes especialistas estão disponíveis no n8n?”. A resposta distingue autorização salva, leitura atual e executor.
- IDs exatos dos 20 skills e quatro perfis são reconhecidos pelo seletor do protocolo, respeitando o limite de contexto por resposta.

## Ligações

Tratamento de erros, revisão, autenticação, depuração, Node.js, JavaScript e quatro skills de modelagem/mitigação de segurança usam como apoio a leitura de catálogo e estrutura n8n. As demais especialidades usam como apoio os arquivos e a árvore do repositório via GitHub. Os quatro perfis apontam às mesmas ferramentas adequadas à sua especialidade.

Um vínculo define de onde obter evidência; não concede permissão nem comprova execução. GitHub, Supabase e Vercel são conexões diretas. n8n não recebe suas credenciais. A leitura n8n atualizada não comprova conectividade desses provedores.

O relatório real existente continua sendo o único workflow executável por este recurso: pedido explícito “Jarvis, gere um relatório dos workflows no n8n”. A descoberta dos skills não o executa automaticamente. Cada consulta respeita a sessão do proprietário e não revela segredos, nomes de recursos ou conteúdo de arquivos.

## Requisitos ainda não atendidos por estes perfis

Os skills não instalam um runner. Git, SQL/EXPLAIN, Playwright/Cypress, Jest/Vitest, tsc, Nx, Turborepo, Bazel e SAST precisam de executores específicos, recursos autorizados e evidências. O inventário informa essas lacunas por habilidade. Perfis especialistas permanecem perspectivas contextuais, sem processos autônomos.

Home, áudio, Gemini e Abacus não são alterados por esta ligação. O executor de relatório mantém sua restrição à prévia de auditoria. Não há promoção de produção.
