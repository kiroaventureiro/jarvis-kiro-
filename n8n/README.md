# n8n opcional — Jarvis Kiro
Preparação **não é instalação em execução**. Nada foi iniciado nem ligado às suas contas.

## Instalar localmente (Windows com Docker Desktop)
1. Instalar Docker Desktop e confirmar requisitos/virtualização e memória disponíveis.
2. Copiar `.env.example` para `.env` e substituir chave por segredo aleatório (não enviar ao GitHub).
3. Dentro da pasta `n8n/`, executar `docker compose up -d`.
4. Abrir http://localhost:5678 e configurar conta do proprietário.
5. Manter a interface acessível SOMENTE no computador local. Para conexões externas, configurar HTTPS, autenticação e validação dos webhooks; não abrir a porta 5678 na internet.
6. Configurar as credenciais das plataformas no gerenciador de credenciais n8n, nunca no código ou no navegador do Jarvis.

## Economia e retenção
- Não armazenar conteúdo de conversas, mídia ou dados completos de API.
- Evitar salvar execuções; expurgar dados de execuções antigas após 24 horas. O n8n mantém necessariamente o próprio banco operacional para fluxos e credenciais criptografadas.
- Limitar paralelismo e não agendar rotinas que se repetem sem necessidade.
- Consultas sob demanda são prioridade; sincronização por evento/webhook só com origem confiável.
- Os controles acima afetam histórico de execução, não substituem políticas de backup/retenção de credenciais e banco operacional.
- O PC deve ficar ligado para rodar automações locais. Vercel não é hospedagem adequada para este container persistente.
- Modelo de automação: **OpenAI interpreta → roteador escolhe caminho → n8n executa somente automações justificadas → serviço original permanece como fonte dos dados**.

## Política de roteamento
1. Pode responder com contexto já confiável e atual? Não use ferramentas.
2. É uma consulta única simples? Use integração direta API → apenas campos necessários.
3. É uma tarefa com múltiplos passos, repetição ou erro/retry? Use n8n, respeitando permissões.
4. Envolve editar/publicar/excluir/pagar/enviar? Solicitar autorização e registrar a decisão ANTES da execução.
5. Dados são temporários? Não persista. Configuração, cursor da última consulta e decisões verificadas podem ficar em armazenamento mínimo com prazo de retenção.
6. Falha ou limite da API? Pare, relate claramente, não entre em loop.
7. Mudanças de código vão para branch, passam por testes e aprovação; nunca fazer auto-deploy silencioso.

## Status
Estrutura criada no GitHub. Instalação, credenciais, webhooks e fluxos produtivos ainda pendentes.
