# Jarvis Kiro — Plano de arquitetura antes das autorizações

Decisão do proprietário em 2026-10-25: **construir primeiro todas as interfaces e conectores, autorizar contas somente no final e então testar ponta a ponta em lote**. Não solicitar testes manuais no iPhone ou Windows nesta fase.

## Estados obrigatórios, separados
1. **Planejado**: serviço no catálogo, sem código operacional.
2. **Adaptador preparado**: rotas, contratos de dados, validação e falhas seguras presentes.
3. **Credencial presente**: variáveis configuradas no ambiente seguro; NÃO equivale a conexão.
4. **Conectado e autorizado**: OAuth/token funcional e escopo conferido.
5. **Validado**: testes automatizados e testes reais documentados no dispositivo.
6. **Liberado**: aprovação explícita para ambiente de produção. Nunca inferir aprovação.

## Ordem de implementação, sem bloquear pelas credenciais
| Fase | Sistemas | Preparar antes de acesso | Autorização posterior |
| --- | --- | --- | --- |
| A — Fundação | GitHub, Vercel, Supabase dedicado | Leitura do inventário, estados e logs, interfaces separadas de credenciais, auditoria, passkeys fail-closed | Token de leitura GitHub, token Vercel com menor privilégio, credencial server-only do Supabase |
| B — Assistente | Voz, personalidade, memória, aprovações | Contrato de ferramentas, contexto por projeto, memória com fonte e confiança, controles de gasto | API OpenAI, autenticação e teste iPhone/Windows |
| C — Produtividade | Google Drive, Gmail, Calendar, Microsoft OneDrive, Outlook | Adaptadores de leitura, escopos OAuth mínimos, token storage criptografado, sincronização incremental | OAuth separado por provedor e produto |
| D — Produção | n8n, OBS e KIRO TV Windows Agent | Comandos em allowlist, agente local, ações simuladas, trilha de auditoria e confirmações | Acesso local ao PC e credenciais de automação |
| E — Distribuição | YouTube, Instagram, TikTok e métricas | Dashboards, normalização e coleta de métricas, publicação desabilitada | OAuth de plataformas e permissões específicas |
| F — Liberação | Tudo acima | Checklist central e testes de falhas, revisão de permissões | Teste conjunto e autorização explícita para produção |

## Políticas obrigatórias
- Nenhuma alteração em produção, gastos, publicações, exclusões ou comandos no Windows sem aprovação específica da ação.
- Tokens apenas no servidor, jamais no frontend, prints, GitHub, conversa ou arquivo de configuração.
- Integração não verificada deve dizer 'não conectada'. Não transformar configuração presente em sucesso de autenticação.
- Cada conector tem tratamento para: credencial ausente, permissão negada, timeout, cota e indisponibilidade.
- Supabase do Sistema Origem fica intacto; histórico não é banco do Jarvis.
- A aprovação de conectar um serviço NÃO autoriza ações de escrita nele.
- Executar testes automatizados sem credenciais durante desenvolvimento; testes reais consolidados após todos os consentimentos.

## Critério de encerramento
Uma versão 'pronta para ativação' exige código, contratos, autorização mínima, segurança, migrações e CI. Uma versão 'pronta para uso' exige também credenciais, validação em dispositivos e aprovação. **Não declarar finalização antes dessas condições**.

## Diagnóstico atual
Endpoint protegido GET `/api/director/integration-readiness` informa somente presença de nomes de configuração; NÃO testa rede nem segredos. A lista de variáveis é um plano técnico sujeito a validação quando cada adaptador for implementado.
