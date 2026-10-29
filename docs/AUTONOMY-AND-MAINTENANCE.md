# Autonomia e manutenção do Jarvis

Investigação em 29/10/2026, branch `feature/diretor-tecnico-agent`.

## O que existe de verdade

| Capacidade | Evidência no projeto | Limite |
| --- | --- | --- |
| Recuperar reconhecimento de voz | `lib/voice/voice-controller.ts`, método `recover` | Recuperação limitada da sessão do navegador, não correção de código |
| Recuperar renderização | `lib/hologram/policy.ts`, `AdaptiveResolution`; `HolographicCore.tsx` | Reduz qualidade/faz fallback; a suíte gráfica completa da auditoria anterior continua com falha de medição por software |
| Renovar autorização | `lib/connectors/workspace.ts` | Usa refresh token já concedido, respeita desconexão; consentimento revogado exige nova autorização |
| Diagnosticar projetos | `DevelopmentPlanner.investigate`, rota `/api/director/connectors/repair` | Apenas recursos vinculados e autorizados |
| Propor correção | `DevelopmentPlanner.repair` | Exige autorização de modelo e orçamento; no máximo três arquivos, contexto limitado e isolamento de CI. Produz plano, não executa autocorreção ilimitada |
| Plano de branch/PR/preview | `lib/connectors/planner.ts` e serviço de aprovação | Execução sujeita ao plano aprovado, permissões e CI; não faz merge automático. Não foi executado um reparo por modelo nesta investigação |
| Pesquisa pública atual | `lib/research/knowledge.ts`, `web-server.ts` | Wikipedia sob demanda e pesquisa web condicionada a provedor/orçamento. Não são atualização diária nem fonte normativa de legislação |
| Fluxos n8n diários | `lib/n8n-workflow-registry.ts` | `daily_briefing` está `enabled:false`, `connected:false`; nenhum agendamento ativo |
| CI | `.github/workflows/jarvis-checks.yml` | Executa por push/PR, não diariamente. Agora usa `npm ci` para reproduzir o lockfile |

Na árvore revisada não existe `vercel.json` com cron, nem workflow GitHub com
`schedule`. Não foi encontrada entre as skills disponíveis uma função que,
por si só, opere como executor diário dentro do Jarvis. A busca de plugins
retornou opções de observabilidade, como Datadog, não um mecanismo pronto de
autocorreção do Jarvis. Nenhum plugin foi instalado ou serviço pago ativado.
Skills e conexões desta sessão não se transferem automaticamente ao aplicativo.

## Rotina local entregue e executável

```sh
npm run maintenance:check
```

Executa comandos fixos, sem shell: consulta npm de dependências de produção,
`npm test` e TypeScript sem emissão/incremental. Gera JSON datado e privado em
`<pasta temporária do sistema>/jarvis-maintenance/` e imprime o caminho.
Código de saída 0 significa que os três checks passaram; 1 indica falha.
Falha de rede não vira “zero vulnerabilidades”. Os checks independentes
continuam para registrar mais de uma falha. A consulta npm envia o inventário
de dependências ao registro público, conforme autorizado pelo proprietário.

Não chama modelos, não instala pacotes, não modifica fontes, não faz commits,
push, merge ou deploy. Não inclui a suíte gráfica nem comprova serviços reais.
O relatório declara `schedulerActive:false`, `automaticCodeChanges:false` e
`knowledgeUpdates:false`. O resultado é daquela execução, não monitoramento
permanente. A pasta temporária não substitui armazenamento durável/backup.
O npm pode atualizar seus próprios logs/cache locais.

Para usar diariamente sem um novo serviço pago, a opção direta é o Agendador de
Tarefas do Windows em um computador existente e ligado, com checkout desta
branch e Node/npm instalados. A ação deve executar o comando acima na pasta do
projeto, com conta de baixo privilégio, horário definido e política de não
iniciar uma segunda instância. **Não foi criada uma tarefa no computador do
proprietário**: esta sessão não tem acesso a esse agendador nem confirma sua
disponibilidade após encerrar o ambiente. Também não foi criado cron remoto.

## Vulnerabilidades: resultado real

Com a autorização do proprietário, `npm audit --omit=dev --json` encontrou:

- `next`: severidade moderada herdada de `postcss`.
- `postcss` 8.4.31: severidade alta, incluindo avisos de leitura de arquivos por
  source maps e escape CSS. Dois pacotes afetados, não apenas dois avisos.

O registro indicava correção por migração principal do Next. Em vez de aplicar
`npm audit fix --force`, foi testado um override restrito de `next → postcss`
para **8.5.32**, preservando Next **15.5.28**. O lockfile foi atualizado.
A segunda consulta retornou **zero vulnerabilidades conhecidas nas dependências
de produção**. Isso não certifica ausência de falhas no projeto ou nos pacotes
de desenvolvimento. A execução real de `npm run maintenance:check` terminou com `healthy:true`:
consulta npm, suíte de testes e TypeScript retornaram código 0. O build
`npm run build` também passou após a substituição. A verificação de navegador
confirmou as dez páginas em 1440/390/320 pixels sem exceções nem rolagem
horizontal; 15 chamadas privadas sem sessão retornaram 401. Evidências em
`/tmp/jarvis-postcss-audit/`. Relatório desta execução:
`/tmp/jarvis-maintenance/report-1793299217183-45053.json`. Os testes da rotina
cobrem comandos fixos, falhas de rede e falhas de testes sem ativar agendamento.

O override deve ser revisto quando o framework incorporar
uma versão corrigida e compatível por conta própria.

## Como expandir a autonomia

O ciclo recomendado é detectar → coletar evidência → classificar → corrigir
operações reversíveis autorizadas → testar → registrar resultado. Para código:
propor patch em branch experimental → testes isolados → preview → aprovação
para promoção. Falha de teste interrompe promoção; novas tentativas precisam de
limites e não podem repetir gastos indefinidamente. Rollback de produção exige
política e autorização próprias; a recuperação local de uma operação não as concede.

Manutenção de software deve comparar versões/advisories e propor atualização;
nunca instalar automaticamente um programa ou skill só porque uma página o
recomenda. Conteúdo da internet é dado não confiável, não instrução de execução.

Para informações e leis brasileiras, um ciclo diário separado deve:

1. Definir assuntos e jurisdições, com fontes oficiais permitidas (DOU/Imprensa
   Nacional, Planalto e órgãos competentes; normas estaduais/municipais precisam
   das respectivas fontes). Não confundir projeto de lei com lei vigente.
2. Consultar apenas endpoints verificados, com timeout, limites e condicionais
   HTTP quando suportados; guardar URL, hash, data de coleta e alterações.
3. Conservar data da publicação, vigência, retificações e revogações quando
   comprovadas. Conteúdo inacessível ou ambíguo deve continuar pendente.
4. Manter versões e proveniência em armazenamento durável; não substituir uma
   regra validada por resumo automático sem rastreabilidade.
5. Mostrar o que mudou e as fontes. Indexar documentos melhora a consulta; não
   modifica os pesos do modelo nem garante interpretação jurídica correta.

**Esse coletor jurídico não foi implementado nem agendado.** Faltam seleção do
escopo/fontes, validação dos endpoints, armazenamento com retenção e executor
permanente com custo/quota confirmados. Não foi chamado um gerador pago para
resumir normas. Atualizar procedimentos internos deve preservar aprovação e
histórico, sem substituir silenciosamente regras do proprietário.

## Bloqueios para operação diária real

- Um executor permanente autorizado: computador existente disponível, ou quota
  comprovada de um backend já contratado. Não presumir que cron significa custo zero.
- Persistência de relatórios/incidentes e versões de fontes com política de retenção.
- Recursos/permissões reais dos conectores e CI isolado para o fluxo de reparo.
- Orçamento explícito antes de usar modelos para diagnóstico, patch ou resumos.
- Escopo e fontes oficiais para legislação; regras de aprovação para procedimentos.

Não há autodesenvolvimento irrestrito ativo. O que pode funcionar sem nova
aprovação por incidente é recuperação limitada e pré-autorizada; alterações
duráveis devem seguir os limites do plano, testes e ambiente permitido.
