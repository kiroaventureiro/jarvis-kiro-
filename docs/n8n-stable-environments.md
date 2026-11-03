# Jarvis Kiro — ponte n8n por ambiente

A ponte n8n é um serviço de execução **por ambiente**, não por branch, commit ou Preview temporário.

## Endereços estáveis

Associe no projeto Vercel dois endereços HTTPS persistentes:

- **Pré-produção:** domínio/alias fixo que aponta para a implantação vigente do canal de pré-produção (no Vercel, `VERCEL_ENV=preview`).
- **Produção:** domínio/alias fixo que aponta para a implantação de produção (`VERCEL_ENV=production`).

Os domínios podem ser próprios ou domínios estáveis da Vercel que o proprietário já tenha verificado. **Não adivinhar URL**. Uma promoção de versão altera o deployment por trás do domínio, sem alteração no endereço do worker. Mudanças experimentais em branches não devem ser promovidas automaticamente.

## Windows: uma configuração por ambiente

O arquivo `scripts/n8n-bridge-worker.ps1` aceita `-Environment preproduction` ou `-Environment production`, com workflows n8n independentes e validação de `deploymentEnvironment`.

O arquivo `scripts/start-n8n-stable.ps1` inicia os dois workers com as URLs estáveis das variáveis de ambiente:

- `JARVIS_PREPRODUCTION_URL`
- `JARVIS_PRODUCTION_URL`
- `JARVIS_N8N_BRIDGE_SECRET_PREPRODUCTION` (ou a antiga `JARVIS_N8N_BRIDGE_SECRET` para pré-produção)
- `JARVIS_N8N_BRIDGE_SECRET_PRODUCTION` (separada da pré-produção)
- `JARVIS_N8N_API_KEY`

As variáveis de segredo devem ser configuradas com segurança localmente; **não incluí-las em commits, URLs, logs ou prompts**. Executar duas instâncias do worker e parar o antigo worker v1. Não é necessário mudar os endereços após novos commits, apenas atualizar o worker quando houver alteração no próprio protocolo.

## Garantias

- O worker valida que a implantação remota corresponde ao ambiente selecionado.
- O cofre criptografado separa os identificadores `preview:namespace` e `production:namespace`.
- Os workflows n8n são `Jarvis Kiro - GitHub aprovado (preproduction)` e `Jarvis Kiro - GitHub aprovado (production)`.
- Cada execução GitHub depende de um plano aprovado, ticket de execução e verificação de repositório autorizado. Sem merge ou deploy automático no repositório.
- O heartbeat de 90 segundos confirma um worker ativo para o ambiente, mas **não comprova** permissão efetiva de escrita no GitHub.
- O PR somente é anunciado como criado quando o executor recebe confirmação verificável.
- Se o domínio estável não existir, ou se o ambiente da Vercel não corresponder, a inicialização é bloqueada.

## Implantação e validação

1. Configurar e verificar os dois domínios estáveis no painel Vercel.
2. Configurar os segredos de ponte separados nos ambientes correspondentes, com cofre GitHub válido em cada um.
3. Configurar as variáveis equivalentes no Windows, interromper o worker antigo e iniciar `start-n8n-stable.ps1`.
4. Confirmar handshake `protocolVersion=2` e `deploymentEnvironment` esperado em cada janela.
5. Testar uma alteração isolada na pré-produção e verificar commit + PR. Somente depois habilitar o fluxo de produção.

A existência desta documentação e o sucesso do build **não substituem a validação dos domínios, a atualização local do worker ou o teste real de escrita**.
