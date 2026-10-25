-- Jarvis Kiro: executar apenas no Supabase dedicado após configurar identidade
-- RLS fechada por padrão: nenhum acesso para anon ou authenticated até criar políticas por usuário.
create extension if not exists pgcrypto;

create table if not exists public.jarvis_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  stage text not null default 'unknown' check (stage in ('unknown','idea','planning','development','production','paused','archived')),
  summary text not null default '',
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.jarvis_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  project_id uuid references public.jarvis_projects(id) on delete set null,
  url text,
  content_hash text,
  cursor_value text,
  observed_at timestamptz not null default now(),
  unique(provider,external_id)
);
create table if not exists public.jarvis_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.jarvis_projects(id) on delete cascade,
  source_id uuid references public.jarvis_sources(id) on delete set null,
  fact_key text not null,
  fact_value jsonb not null,
  state text not null default 'proposed' check (state in ('proposed','verified','conflicted','obsolete')),
  confidence numeric(3,2) check (confidence between 0 and 1),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists jarvis_facts_project_key_idx on public.jarvis_facts(project_id,fact_key);
create table if not exists public.jarvis_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  idempotency_key text unique,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.jarvis_approvals (
  id uuid primary key default gen_random_uuid(),
  action_kind text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create table if not exists public.jarvis_audit (
  id bigint generated always as identity primary key,
  event_kind text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.jarvis_projects enable row level security;
alter table public.jarvis_sources enable row level security;
alter table public.jarvis_facts enable row level security;
alter table public.jarvis_jobs enable row level security;
alter table public.jarvis_approvals enable row level security;
alter table public.jarvis_audit enable row level security;
-- Nenhuma política criada: bloqueia acesso direto do navegador. Backend só depois de autenticação server-side.
