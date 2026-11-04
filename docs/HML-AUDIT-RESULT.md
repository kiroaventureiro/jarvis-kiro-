# Resultado da auditoria e correção local

Base: `129e5e448b604afa3655c617540d5c6b28bbc86f`, obtida do GitHub e identificada pela Vercel como a pré-produção consultada. Branch local: `fix/hml-integration-audit`.

## Alterações locais

- Integração da rota HML sobre a base recente, sem substituir a interface pela branch HML antiga.
- Correção do import de autenticação para `@/lib/auth`.
- Rejeição de caracteres de quebra de linha na chave de transporte.
- Respostas vazias, não JSON, nulas ou arrays do upstream passam a retornar falha, não aceitação.
- Consulta parametrizada correta para o nó de registro disponível em `HML-REGISTRATION-QUERY.sql`.

## Validação

- Quatro testes comportamentais da ponte passaram: autenticação/origem, destino e tamanho, transporte da credencial, respostas inválidas.
- `npm run build` terminou com sucesso, incluindo verificação TypeScript e a rota `/api/orchestration/hml`.
- Banco `jarvis_hml` consultado diretamente: somente funções `register_command`, `reserve_jobs`; tabelas `commands`, `reservations`; zero comandos no início da auditoria.
- Teste transacional passou para registro, replay idempotente, conflito e bloqueio de reserva sem aprovação. ROLLBACK executado.
- Testes gerais foram iniciados e apresentaram falhas em testes de voz existentes. Não declarar a suíte integral aprovada. Nenhum arquivo de voz foi alterado nesta correção.

## Workflow n8n real

Exportados nove workflows para cópia interna `/tmp/jarvis-audit-workflows.json` no contêiner n8n. Não exportadas credenciais.

`JK | HML | Entrada de comandos` está ativo, mas seu nó `Registrar comando atomicamente - PENDENTE` contém uma consulta de diagnóstico em vez de chamar `register_command`. O array de onze parâmetros já está configurado. Preparada cópia com alteração exclusivamente dessa consulta em `/tmp/jarvis-hml-ingress-corrected.json`.

A tentativa de importação com preservação de ativação foi rejeitada: `--activeState=fromJson` só é suportado em queue ou multi-main mode. Não usar a importação padrão, pois desativaria o workflow. Alteração não confirmada como aplicada; não houve reinício do n8n.

O despachante também contém consulta de diagnóstico na reserva. As funções `record_approval`, `begin_attempt`, `complete_simulated_success` e `record_failure` referenciadas pelos workflows não existem no banco auditado. O workflow de entrega declara `persisted: false`. Portanto, o ciclo completo ainda não existe e não deve ser anunciado como funcional.

## Pendências concretas

Aplicar a consulta no workflow pela sessão autenticada do editor ou pela API n8n previamente configurada; concluir e validar aprovação, tentativa, resultado e entrega no contrato existente; integrar o disparo do Jarvis; testar o ciclo completo; só então publicar uma versão validada.

Nenhuma atualização Vercel, promoção de produção ou alteração durável no banco foi realizada nesta etapa. O navegador local continua indisponível à ferramenta por configuração do Work.
