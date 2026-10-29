# Jarvis Kiro

Assistente pessoal Kiro Produções, com interface Next.js para desktop e iPhone.

[Diagnóstico e limites da integração Jarvis ↔ Codex Cloud](docs/CODEX-CLOUD-INTEGRATION.md)

## Estado real (25/10/2026)
- Painel responsivo implementado. A tela não pede senha, mas isso NÃO significa acesso seguro a dados privados.
- Rota de voz Realtime implementada, porém protegida por sessão e dependente de OPENAI_API_KEY; ainda não validada ponta a ponta em produção.
- Memória e atualização contínua: **arquitetura e migração SQL preparadas, ainda não conectadas nem executadas.**
- Integrações GitHub, Vercel, redes sociais e execução autônoma: ainda não implementadas.

## Próximas entregas
1. Autenticação sem digitação recorrente (passkey por dispositivo) e sessão segura.
2. Rodar migração do banco dedicado Supabase e verificar RLS.
3. Sincronizar GitHub de modo incremental e registrar logs.
4. Expor memória com referência às fontes ao agente por voz.
5. Testes no iPhone e desktop; auditoria de custos.

[Arquitetura de evolução](docs/ARCHITECTURE.md) · [Migração de banco](supabase/migrations/20261025_jarvis_foundation.sql)

Nunca coloque segredos no GitHub nem desative a autenticação da API de voz para contornar erros 401.
