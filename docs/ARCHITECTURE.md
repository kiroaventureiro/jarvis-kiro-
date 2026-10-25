# Jarvis Kiro — arquitetura de evolução contínua (v0.3)

## Princípio
O Jarvis é uma central pessoal para desktop e iPhone. Deve atualizar **dados** e **conhecimento** automaticamente, mas NUNCA alterar seu próprio código, credenciais, integrações, regras de autorização ou publicação sem testes e aprovação humana.

## Componentes
- **Interface**: Next.js na Vercel, desktop + PWA móvel; voz WebRTC/Realt​ime com sessão efêmera emitida SOMENTE pelo backend após autenticação.
- **Identidade**: login sem digitar senha repetidamente usando passkeys/WebAuthn + sessão segura e renovável. O painel público pode mostrar somente conteúdo não sensível. Nunca emitir token da API de voz em sessão anônima.
- **Memória**: Supabase Postgres com RLS; entidades de projetos, fatos validados, documentos de origem, execuções, propostas e decisões. Vincular fatos a origem, data de verificação e nível de confiança.
- **Integrações**: adaptadores isolados de GitHub, Vercel, Supabase e posteriormente YouTube/Instagram. Privilégio mínimo, OAuth/segredos apenas no backend.
- **Sincronização**: jobs idempotentes, com cursores e revalidação; disparados por webhook seguro ou agendador. Vercel Cron, Supabase Cron ou n8n Community podem orquestrar; não são necessários os três.
- **Agente**: busca informações pertinentes na memória e em fontes autorizadas, distingue proposta de execução confirmada, registra trilha de auditoria. Nunca inventa métricas ou ações.
- **Custo**: limites diários de chamadas/tokens, cache, compactação de contexto, resumo incremental e política de retenção.

## Ciclo de atualização
1. Captura incremental das fontes autorizadas.
2. Deduplicação por identidade e hash; salvar origem e horário.
3. Extrair fatos e propostas; conflitos viram pendências para revisão, não sobrescritas silenciosas.
4. Indexar resumos recuperáveis; marcar dados como atualizados/desatualizados.
5. Agente consulta apenas fatos relevantes com origem; pedir confirmação para publicar, alterar sistema, enviar mensagem ou pagar.
6. Registrar resultado verdadeiro/erro para melhorar recomendações futuras.

## Evolução do próprio software
Issue -> branch isolada -> testes automatizados -> revisão de segurança -> preview Vercel -> aprovação -> produção -> monitoramento -> rollback.
Nada de auto-merge ou auto-deploy autônomo sem política explícita aprovada.

## Marcos verificáveis
- **M0 agora**: estrutura inicial, banco modelado e contrato de atualização; ainda sem sync automático.
- **M1**: passkeys e sessão segura multi-dispositivo; validar login no iPhone/desktop.
- **M2**: conectar Supabase de forma segura, aplicar migração SQL e testar RLS com dois papéis.
- **M3**: sincronização GitHub incremental com histórico de execuções; validar idempotência.
- **M4**: consulta da memória por voz com referências e limites de custo.
- **M5**: conectores de canais e ações autorizadas; tarefas agendadas e métricas.

## Restrições conhecidas
A assinatura ChatGPT não paga automaticamente API da OpenAI. Vercel gratuita pode dormir/limitar execução e um site iOS não mantém microfone de fundo continuamente. Memória contínua exige configuração de credenciais, banco e tarefas recorrentes. Nunca expor chave de serviço Supabase ou OpenAI no navegador.
