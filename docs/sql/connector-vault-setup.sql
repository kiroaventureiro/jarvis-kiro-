-- SETUP PROPOSTO: revisar e aprovar antes de executar. Nenhuma aplicação automática.
-- Usar configuração de armazenamento dedicada. Nunca reutilizar automaticamente a credencial da memória.
create table public.jarvis_connector_state (
 id text primary key,
 revision bigint not null default 0 check (revision >= 0),
 ciphertext text not null,
 updated_at timestamptz not null default now()
);
alter table public.jarvis_connector_state enable row level security;
revoke all on public.jarvis_connector_state from public, anon, authenticated;
grant select, insert, update on public.jarvis_connector_state to service_role;
-- Sem policies públicas: somente backend autorizado. Dados, tokens e planos são AES-256-GCM.
