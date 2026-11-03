# Jarvis Kiro — inventário de agentes, skills e conectores (03/11/2026)

Este incremento cria um inventário autenticado e verificável em `GET /api/director/agent-capabilities`.

## Estados declarados sem inferências

- Quatro skills locais já presentes em `runLocalSkill`: `projects.list`, `projects.details`, `creative.continuity`, `creative.scenes`. Continuam sujeitas a autenticação.
- Cinco perfis de engenharia existentes são **orientações** (não subagentes ou scanners executores).
- 32 repositórios do usuário são **candidatos**. O catálogo não faz clone, instalação, importação de código ou execução deles.
- Credenciais de GitHub, Vercel e Supabase administrativo são lidas apenas como metadados do cofre. A API não retorna tokens.
- A presença de grants locais não cria scopes do provedor nem bypass de proteção.
- O transporte n8n/Windows ainda não tem assinatura, prevenção de replay e canal de execução implementados. Não o habilitar sem estes controles.
- A memória central do Jarvis permanece fonte de verdade. Claude Mem só pode ser considerado adaptador de ingestão/consulta após política de privacidade, deduplicação e migração revisadas.

## Diagnóstico para o próximo ciclo

1. Executar `GET /api/director/agent-capabilities` em sessão autenticada e comparar a saída com `GET /api/director/connectors?diagnostics=1`.
2. Para cada recurso, testar a operação real na central de conexões, confirmar escopos de origem, ambiente e allowlist. Não confundir verificação histórica com chamada atual.
3. Implementar e testar autenticação por assinatura, expiração, idempotência e replay antes de alterar `AGENT_TRANSPORT.enabled`.
4. Criar adaptadores individuais e testes de contrato para os candidatos priorizados, sem executar código externo na Vercel.
5. Registrar provas de execução e logs, exigir aprovação para gravações, PRs, deployments e ações de computador.

## Garantias deste incremento

Nenhum ajuste de UI, Gemini Live, áudio infinito, conteúdo de memória, secrets, branch principal ou produção. O inventário não aciona provedores externos e não concede novos privilégios.

**Limitação:** esta entrega torna a situação inspecionável e consistente, mas não declara os 32 projetos instalados, nem cria os executores remotos ainda ausentes.
