-- Dedicated Jarvis Supabase project only. Apply after reviewing backup and roles.
-- Passkey credentials are public keys, never device biometrics.
create table if not exists public.jarvis_passkeys (
 id uuid primary key default gen_random_uuid(),
 credential_id text not null unique,
 public_key text not null,
 counter bigint not null default 0,
 transports jsonb not null default '[]'::jsonb,
 device_label text not null default 'Dispositivo',
 created_at timestamptz not null default now(),
 last_used_at timestamptz,
 revoked_at timestamptz
);
create table if not exists public.jarvis_webauthn_challenges (
 id uuid primary key default gen_random_uuid(),
 challenge_hash text not null unique,
 purpose text not null check (purpose in ('register','authenticate')),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists jarvis_webauthn_challenge_expiry_idx on public.jarvis_webauthn_challenges(expires_at);
alter table public.jarvis_passkeys enable row level security;
alter table public.jarvis_webauthn_challenges enable row level security;
-- Intentionally no RLS policies: credentials and challenges are only reachable by
-- authenticated privileged server code. Never expose the service role token in client.
-- Never use a public endpoint for initial enrollment; require existing authenticated
-- owner session, then link the passkey to that account. Sign-in challenges must be
-- one-time, short-lived, origin/RP-ID checked, and verified cryptographically.
