# Jarvis Skill — 20 competências do Codex integradas ao núcleo

**Origem:** wshobson/agents, revisão fixada `0874a27b17a22e2b7c2e2bcd725768e0803cad06` (MIT). **Plugins instalados no Codex:** Developer Essentials 1.0.4 (11), JavaScript/TypeScript 1.2.3 (4), Security Scanning 1.3.2 (5). O inventário é o mesmo de `docs/WSHOBSON-AGENTS.md`.

## Implementação no Jarvis

- `lib/cognitive/codex-skill-catalog.ts` registra os 20 IDs, grupos, critérios e orientações adaptadas.
- `lib/cognitive/protocol.ts` consulta o seletor para inserir **até duas** orientações pertinentes à tarefa; não impõe engenharia em conversas cotidianas.
- `GET /api/director/local-skills`, protegido pela autenticação do proprietário, expõe 4 skills nativas executáveis e 20 skills especializadas de **orientação**; retorno identifica explicitamente os tipos.
- `POST /api/director/local-skills` preserva somente as quatro operações nativas já autorizadas.
- `tests/codex-skills-catalog.test.mjs` verifica contagem, grupos, seleção, isolamento e inventário.
- O protocolo compartilhado passa para Abacus, classificação contextual e voz nos caminhos que o invocam. Não altera UI, microfone, timbre, conectores nem credenciais.

## Inventário

### Developer Essentials — 11
1. git-advanced-workflows
2. sql-optimization-patterns
3. error-handling-patterns
4. code-review-excellence
5. e2e-testing-patterns
6. auth-implementation-patterns
7. debugging-strategies
8. monorepo-management
9. nx-workspace-patterns
10. turborepo-caching
11. bazel-build-optimization

### JavaScript/TypeScript — 4
12. typescript-advanced-types
13. nodejs-backend-patterns
14. javascript-testing-patterns
15. modern-javascript-patterns

### Security Scanning — 5
16. sast-configuration
17. stride-analysis-patterns
18. attack-tree-construction
19. security-requirement-extraction
20. threat-mitigation-mapping

## Limites, governança e execução

As 20 skills são **competências cognitivas**: instruções selecionadas, não os executáveis nativos do Codex ou subprocessos de `wshobson/agents`. Nenhuma ferramenta de scanner é ativada automaticamente. Só executa consultas ou mutações por conectores existentes e autorizações aplicáveis; não cria consumo de modelo extra só para selecionar skills. Não afirma que aplicou scanner, commit, teste, análise de dependências ou modificação sem saída verificável.

Não copiamos os 20 manuais e materiais auxiliares do marketplace; preservamos referência pinada e orientações autorais concisas. A instalação dos 20 plug-ins no Windows e o uso no Jarvis são ambientes separados.

**Validação:** build/CI Vercel e testes são verificados após atualização; nenhuma capacidade ou permissão nova é inferida por instalar o catálogo.
