# Operação n8n sem computador local — implantação pendente

## Estado comprovado (2026-11-03)

- O Jarvis Kiro em pré-produção usa o alias estável `https://jarvis-kiro-preproducao.vercel.app`.
- O worker PowerShell no Windows realiza polling em `GET /api/director/n8n-bridge`.
- O n8n local responde na porta `5678` e recebe jobs pelo webhook `jarvis-kiro-approved-github-preproduction-v2`.
- A API de execução de cada job validado fica na Vercel, em `POST /api/director/n8n-bridge/execute`.
- A ponte não depende de GitHub PAT dentro do n8n; o cofre do Jarvis controla as credenciais.
- O worker e n8n locais **param quando o PC é desligado**; a criação deste documento não muda isso.

## Migração para hospedagem contínua

É necessário contratar ou conectar um ambiente que execute processos persistentes (n8n Cloud ou instância Docker/VM com reinício automático). A Vercel hospeda o endpoint do Jarvis, mas o aplicativo n8n local **não migra automaticamente** por criar uma URL Vercel.

### Pré-produção

1. Criar n8n em host independente do Windows, com autenticação, persistência, HTTPS para administração e backups.
2. Migrar apenas o workflow validado de pré-produção. Confirmar que ele usa `https://jarvis-kiro-preproducao.vercel.app/api/director/n8n-bridge/execute`.
3. Hospedar o processo de polling num worker sempre ativo, no mesmo host ou rede interna do n8n, usando **o segredo somente de pré-produção** e a chave n8n fornecidos por um cofre de segredos do host.
4. Manter o webhook n8n acessível ao worker pela rede interna; nunca publicar porta `5678` sem proteção.
5. Verificar resposta `protocolVersion=2`, `deploymentEnvironment=preview`, heartbeat menor que 90 segundos e workflow ativo.
6. Após uma tarefa única explicitamente aprovada pelo proprietário, comparar o link do PR e SHA com o GitHub. Só então desligar o worker Windows.

### Produção

Configurar n8n/worker com credencial própria de produção e o domínio `https://jarvis-kiro.vercel.app` **somente após** publicar e validar o protocolo também em produção. Não reutilizar segredo de pré-produção, nem habilitar escrita automaticamente.

## Requisitos de segurança

- Segredos em variáveis protegidas do provedor (nunca em repositório, CLI compartilhada ou logs).
- Aprovação do proprietário e autorização GitHub por repositório são verificadas pelo Jarvis.
- Ticket de execução HMAC por tarefa e prevenção de reexecução quando a resposta é incerta.
- Atualizações do workflow testadas primeiro em pré-produção.
- Backups do banco e da chave de criptografia do n8n.
- Monitoramento de heartbeat e falhas; desligamento automático da promessa de escrita quando não houver worker ativo.
- Manter PowerShell/PC em operação até a infraestrutura de nuvem estar de fato ativa.

## Resultado esperado

Depois da migração comprovada, o Jarvis fará criação aprovada de pastas com nomes completos (inclusive espaços) e consultará no cofre a evidência de commit e PR, sem depender do computador. **Esse resultado não está validado na nuvem até existir uma hospedagem n8n e um worker ativo, com secret vinculado.**
