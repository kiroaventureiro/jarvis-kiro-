# Jarvis Kiro — arquitetura OpenAI + n8n antes dos acessos

## Princípio
OpenAI interpreta pedidos e produz propostas; o servidor Jarvis valida autenticação, escopos e aprovações; o n8n só executará workflows registrados e autorizados. ChatGPT conectado a Google **não transfere** automaticamente OAuth ou tokens ao aplicativo Jarvis.

## Fluxo
1. iPhone/Windows → sessão autenticada Jarvis.
2. API Jarvis → contexto de personalidade, memória com origem, classificação da intenção.
3. Orquestrador → contrato de ferramentas com parâmetros validados e allowlist.
4. Consulta → adaptadores de leitura (GitHub, Vercel, Supabase, Google, Microsoft, redes).
5. Ação → proposta registrada, revisão de permissões e aprovação explícita por execução.
6. Após aprovação → backend chama um webhook n8n autenticado, com ID de operação, idempotência e timeout.
7. n8n aciona conector externo ou agente Windows de permissões mínimas; envia resultado assinado/verificável.
8. Jarvis registra auditoria, resultado real, fonte e erro, sem afirmar sucesso por simples envio.

## Módulos
- `lib/jarvis-orchestrator.ts`: planejamento seguro com whitelist; **não executa webhooks**.
- `app/api/director/orchestrator/route.ts`: interface de planejamento protegida; nenhuma chamada de terceiros.
- `app/api/voice/route.ts`: sessão de voz OpenAI existente, ainda sem ferramentas de n8n ativas.
- `lib/workspace-read-adapters.ts`: consultas read-only em preparação; OAuth pendente.

## Workflows futuros
- project_report: consultar repositórios, deploys, falhas de build e pendências.
- content_pipeline: preparar roteiros, assets e cronograma; qualquer publicação ou gasto exige aprovação.
- broadcast_health: verificar OBS, lista de reprodução, streaming e alertas sem alterar transmissão.

## Restrições obrigatórias de implementação posterior
- Não usar credenciais dentro de prompts, frontend, repositório ou logs.
- OAuth separado por serviço, cofre seguro com criptografia e rotação.
- OpenAI API tem cobrança e chave próprias, não derivadas da assinatura ChatGPT.
- Verificar assinatura dos callbacks n8n e impedir SSRF; não aceitar URL arbitrária.
- Controle de custos, cotas, rate limits, prazos, fila, retries limitados e idempotência.
- Armazenamento de auditoria e aprovações de uso único antes de habilitar POST de execução.
- Ferramentas no Realtime precisam de mecanismo de execução efetivo no servidor ou cliente autorizado; texto de instrução sozinho não concede acesso.
- Escritas em produção, Pix/pagamentos, exclusões e publicações continuam desligadas até consentimento por ação.

## Estado
Arquitetura parcial implementada; credenciais, OAuth, callbacks, n8n operacional, storage de auditoria e testes reais **pendentes**. Nenhuma conexão foi ativada e nenhum teste de usuário é solicitado agora.
