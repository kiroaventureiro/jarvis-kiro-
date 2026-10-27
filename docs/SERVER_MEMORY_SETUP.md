# Jarvis — memória sincronizada opcional e criptografada
Implementação somente preparada: **desativada até configuração explícita**. Não ativar no Preview ou produção sem consentimento do proprietário.

## Armazenamento
Usa Supabase REST, tabela com uma linha por proprietário Jarvis. Criar manualmente no projeto Supabase escolhido:

```sql
create table if not exists public.jarvis_owner_memory (
 owner_id text primary key,
 encrypted_history text not null,
 updated_at timestamptz not null default now()
);
alter table public.jarvis_owner_memory enable row level security;
revoke all on public.jarvis_owner_memory from anon, authenticated;
```

Somente backend service role pode acessar a tabela. **A chave de serviço nunca deve ir para o navegador.**

## Configurações do servidor
- `SUPABASE_URL`: URL HTTPS do projeto `*.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço reservada somente ao servidor.
- `JARVIS_MEMORY_ENCRYPTION_KEY`: 32 bytes aleatórios codificados em base64. Guardar com backup seguro; perda da chave torna os dados ilegíveis.

A ausência de qualquer variável mantém a API em modo não configurado; não cria serviço nem inicia cobranças. Rotacionar a chave requer migração criptográfica prévia.

## Operações
- `GET /api/director/memory` consulta status e até 20 últimas mensagens.
- `PUT /api/director/memory` grava somente até 20 mensagens, no máximo 800 caracteres cada.
- `DELETE /api/director/memory` esvazia o histórico criptografado.

Todas as rotas exigem sessão de proprietário. **Não há sincronização automática do HUD ainda.** A implementação está pronta para integração opt-in posterior, após confirmação do backend e política de retenção. Sem backup automático, sem consulta de saldo Abacus, sem execução de modelo pago.
