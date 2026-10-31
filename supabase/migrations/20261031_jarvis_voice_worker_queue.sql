-- Durable, server-only queue for the Windows VoiceStudio worker.
-- All access is through the server service role; browser roles receive no grants.
create table if not exists public.jarvis_voice_worker_devices (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{12,80}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create table if not exists public.jarvis_voice_worker_pairings (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.jarvis_voice_jobs (
  id text primary key check (id ~ '^voice_[A-Za-z0-9_-]{12,80}$'),
  payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed')),
  device_id text references public.jarvis_voice_worker_devices(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$')
);
create index if not exists jarvis_voice_jobs_queue_idx
  on public.jarvis_voice_jobs (status, created_at);
alter table public.jarvis_voice_worker_devices enable row level security;
alter table public.jarvis_voice_worker_pairings enable row level security;
alter table public.jarvis_voice_jobs enable row level security;
revoke all on public.jarvis_voice_worker_devices from anon, authenticated;
revoke all on public.jarvis_voice_worker_pairings from anon, authenticated;
revoke all on public.jarvis_voice_jobs from anon, authenticated;
grant all on public.jarvis_voice_worker_devices to service_role;
grant all on public.jarvis_voice_worker_pairings to service_role;
grant all on public.jarvis_voice_jobs to service_role;
