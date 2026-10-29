# Ponte Navi ↔ Jarvis ↔ Codex — início da implementação (29/10/2026)

## Objetivo
Dar ao usuário uma única interface do JK para solicitar conversas mediadas pela OpenAI, consultar contexto de projetos e delegar tarefas de engenharia ao Codex, sempre com consentimento e verificação.

## Estado factual
- `lib/openai/navi-adapter.ts` adiciona um inventário tipado de capacidade **sem rede e desativado por padrão**.
- `JARVIS_NAVI_ENABLED` é OFF por padrão. `OPENAI_API_KEY` é somente variável de servidor; a existência da chave **não** comprova funcionamento.
- Ainda **não há executor OpenAI**, rota de chat, cobrança habilitada, sincronização de histórico nem ponte Codex.
- O ChatGPT atual **não é** a mesma sessão de um modelo servido pela API. Memória só pode ser compartilhada por serviço autorizado, não por acesso implícito ao histórico privado.
- O Codex desktop do Windows não é automaticamente acessível ao site na Vercel.

## Fases verificáveis
1. Inspecionar estado local do Codex antes de editar seus arquivos não publicados; reconciliar a Issue #2 e a PR #1 sem reset.
2. Integrar o inventário de capacidades à rota autenticada de status do JK; jamais anunciar executores não implementados.
3. Criar adapter OpenAI Responses API no servidor com timeouts, allowlist de modelos, custos por orçamento e opção explícita. Testes totalmente simulados antes de chamada real.
4. Criar conversas Navi com histórico limitado, recuperação escopada de projetos no cofre Supabase e transparência sobre origem da memória.
5. Preparar delegação ao Codex com aprovação, sandbox, Git branch de trabalho, auditoria e limite de recursos. SDK/app-server ou serviço de execução dedicado; nunca expor o computador do proprietário sem autenticação e consentimento.
6. Planejar conector de retorno do Jarvis ao ChatGPT com autenticação, escopos read-only iniciais e nenhuma movimentação automática de dados privados.
7. Testar o mesmo caminho texto/voz, fallback seguro, interrupção e UX iPhone/Windows. Validar Preview pelo SHA; não confundir READY com teste operacional.

## Aceite
Nenhuma gravação em produção; nenhuma chamada paga até autorização explícita; chaves somente no servidor; zero tokens em respostas/logs; testes unitários, integração, CI e smoke autenticado; inventário claro entre operacional, simulado, planejado e bloqueado.

## Decisão do proprietário: aproveitar planos pagos e gratuitos
O JK **não deve dar preferência automática a ferramentas gratuitas**. Selecionar a melhor capacidade disponível por tarefa e autorização, levando em conta qualidade, acesso, disponibilidade e cotas reais. Assinatura ChatGPT/Codex/Work não concede automaticamente créditos OpenAI API: identificar cobrança independente antes de ativação, sem pedir senha nem token na conversa. Após autorização de um escopo rotineiro, evitar confirmações repetitivas; preservar bloqueios contra loops, gastos inesperados, operações destrutivas e publicação sem aprovação.

## Checkpoint desta etapa
A rota autenticada `GET /api/director` passou a expor `capabilities.navi`, derivada de `naviBridgeStatus(process.env)`. Os estados 'disabled', 'needs_configuration' e 'ready_for_validation' não declaram conversação operacional. O código não retorna chaves nem consulta serviços externos. A API de execução, testes de ponta a ponta e ponte Codex continuam pendentes.
