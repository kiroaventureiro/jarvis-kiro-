# Jarvis Kiro — Plano de acesso conectado e gestão pessoal/profissional

## Objetivo
Operar como diretor técnico/operacional para Kiro Produções e assistente pessoal, usando **dados nas fontes**, com duas esferas isoladas. Acesso amplo é uma meta por integrações autorizadas, não acesso irrestrito a credenciais, arquivos ou contas.

## Dois ambientes separados
**Empresa (KIRO):** projetos, GitHub, Vercel, Supabase, n8n, KIRO TV, calendário profissional, email empresarial, redes e indicadores.
**Pessoal:** calendário, compromissos, email pessoal e eventualmente finanças pessoais. Nenhum cruzamento automático entre os domínios. Compartilhamento exige ação explícita do titular. Credenciais, índices e logs de cada domínio separados.

## Conectores e limites de acesso
| Fonte | Acesso inicial | Ações futuras | Observação |
|---|---|---|---|
| GitHub | leitura de repositórios autorizados | branch, commits, PRs | merge/deploy com aprovação |
| Vercel | consultar status e logs | preview, deploy autorizado | produção com aprovação |
| Supabase | consultar dados essenciais por projeto | operações com políticas RLS | não replicar bancos integrais |
| n8n | controle de fluxos validados | execuções/eventos | autenticar webhooks; limitar logs |
| Email/agenda | leitura de caixas/calendários selecionados | rascunhos, eventos autorizados | enviar convites/emails requer aprovação |
| Redes sociais | métricas por APIs oficiais | rascunhos/publicações | respeitar permissões das plataformas |
| Finanças | leitura de saldos/transações via integração consentida, quando existir | simulações, orçamento | transferências/investimentos nunca sem aprovação específica |
| Windows | app companheiro opt-in: ler pastas permitidas e executar ações delimitadas | manipular arquivos selecionados | proibir execução remota arbitrária e acesso a senhas |
| iPhone | app/PWA + APIs permitidas pelo iOS | notificações e ações suportadas | iOS não permite controle irrestrito nem microfone contínuo no navegador |

## Fases de entrega
1. **Identidade:** passkeys/WebAuthn e sessão por dispositivo, revogação, 2 domínios de acesso (pessoal/empresa). Não liberar APIs privadas anônimas.
2. **Observabilidade:** painel de integrações com estado configurado/testado/autorizado; diagnóstico sem expor chaves.
3. **GitHub:** leitura real, desenvolvimento somente em branches isoladas, testes e PR para aprovação.
4. **Agenda e email:** conectar provedores por OAuth escopo mínimo; começar em leitura e criação de rascunhos.
5. **Windows:** agente local opcional, emparelhado com dispositivo, allowlist de pastas/comandos, confirmação visual, trilha de auditoria e botão de desconexão.
6. **iPhone:** PWA para voz, dashboard, aprovações e notificações; recursos de sistema somente via permissões e integração suportadas.
7. **Social e finanças:** conectores sob consentimento, separar dados pessoais de empresariais, simular cenários e apresentar incerteza.
8. **Automação:** n8n apenas para fluxos multietapas/recorrentes que justifiquem custo; evitar duplicidade com API direta.

## Motor de decisão e planejamento
Cada objetivo registra somente: esfera, meta, horizonte, restrições, baseline, métricas, fontes e datas de verificação. Produzir cenários conservador/base/otimista, custos e riscos, com pressupostos auditáveis. Nunca tratar projeção como garantia ou executar investimento automaticamente.

## Memória mínima e eficiência
- Responder por API em tempo real quando possível; guardar apenas preferência útil, estado de tarefa, consentimentos, IDs, resumo incremental e referências.
- Não espelhar emails, bibliotecas de fotos, arquivos ou extratos completos em Supabase.
- Cache com validade adequada, expurgo periódico e limites por provedor; segredos somente em cofres de configuração.
- Sincronizar por alterações/webhooks e não por varredura constante; monitorar custo, latência, taxas de erro e permissões.

## Segurança
Aprovação obrigatória por ação para movimentações financeiras, exclusões, comunicação externa, mudanças em produção e operações de massa. Separação entre tokens de leitura e escrita, escopos limitados, revogação, logs sem dados sensíveis, proteção contra instruções maliciosas em fontes externas. Acesso total a todo PC/celular **não** é o modelo implementável nem seguro.

## Situação
Documento de planejamento. Não estabelece conexão real com PC, iPhone, bancos, email, agenda, redes sociais, nem habilita nenhuma credencial ou operação. A próxima implementação concreta é passkeys e controle de sessão antes de habilitar acesso aos conectores.
