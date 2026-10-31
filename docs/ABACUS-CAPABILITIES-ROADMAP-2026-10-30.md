# Abacus AI → Jarvis Kiro: oportunidades e plano de integração
Atualizado: 2026-10-30. Pesquisa baseada na documentação pública; não confirma permissões, créditos ou conectores ativos na conta do proprietário.

## Estado confirmado no Jarvis
O README da branch feature/diretor-tecnico-agent descreve consulta ao catálogo Abacus e verificação de configurações existentes. Consulta ao catálogo NÃO concede acesso aos agentes privados, conectores de terceiros ou execução paga. A voz neural ainda depende de um provedor de áudio e da sua configuração.

## Oportunidades verificadas na documentação da Abacus
1. **Chatbot personalizado e Predictions API**: chat com instruções de comportamento e resposta, ferramentas próprias e conectores. API inclui opções de streaming e de conversas persistentes. Fonte: https://api.abacus.ai/help/developer-platform/useCases/CHAT_LLM
2. **Agentes com conectores e tarefas**: agentes com ferramentas, gatilhos e tarefas programadas. Conectores nativos, MCP e APIs customizadas são apresentados na documentação pública. Fonte: https://api.abacus.ai/help/chatllm-ai-super-assistant/self-improving-tasks-and-agents
3. **Memória**: Abacus Desktop tem memória local por repositório; isso NÃO implica memória automaticamente disponível à aplicação Jarvis hospedada na Vercel. Fonte: https://api.abacus.ai/help/abacusai-desktop/memory
4. **Configuração de memória no ChatLLM**: a API descreve parâmetros para habilitar memória, mas é preciso validar disponibilidade por plano e acesso real antes de integrar. Fonte: https://abacus.ai/help/api/classes/CustomChatInstructions

## Sequência recomendada
**A. Descoberta sem custos**: expandir o painel de diagnóstico administrativo para exibir recursos realmente acessíveis na conta por autenticação autorizada, separando 'catalogado', 'autorizado', 'disponível via API' e 'testado'. Nunca inferir acesso a partir do catálogo.
**B. Adaptador Abacus**: criar interface de provedor para resposta textual com streaming e histórico de conversa; backend apenas, credenciais no cofre do servidor, timeout, abort, quota e fallback; nenhuma chamada automática sem consentimento.
**C. Memória do Jarvis**: manter fonte de verdade própria (ex.: Supabase com permissões), armazenar preferências e resumos auditáveis; usar memória do provedor apenas como recurso auxiliar, mediante confirmação da política de retenção.
**D. Conectores**: ferramenta com escopo mínimo, confirmação para operações mutáveis (enviar e-mail, publicar, alterar código, transferir dados), logs e revogação de autorização.
**E. Voz**: tratar texto/decisão e TTS como camadas separadas; a Abacus não deve ser presumida como provedora da voz brasileira cinematográfica. Exigir VAD, cancelamento de eco e teste real para interrupção natural.

## Critérios de aceite
- Sem mudança na interface principal e sem deployment ou merge automático.
- Sem credencial em código, frontend, logs ou commit.
- Sem acionar cobrança sem orçamento e autorização.
- Testes unitários de abort, fallback e respostas concorrentes antes de testes de microfone.
- Documentar mediana e p95 de latência de primeira resposta, taxa de erros, falsos cortes e custo por conversa após autorização de testes.
- Diferenciar rigorosamente capacidade da plataforma, acesso da conta e funcionalidade comprovada do Jarvis.

## Pendências
Confirmar nas configurações autenticadas do Abacus a disponibilidade exata de chatbot deployment / Predictions API, agentes, memória e conectores; confirmar endpoint, limites, custos e condições da conta antes de qualquer chamada faturável.