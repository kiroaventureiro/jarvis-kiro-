-- Store short generated WAV previews server-side so the authenticated browser can play them.
create table if not exists public.jarvis_voice_worker_audio (
  job_id text primary key references public.jarvis_voice_jobs(id) on delete cascade,
  audio_base64 text not null,
  created_at timestamptz not null default now(),
  check (length(audio_base64) <= 4000000)
);
alter table public.jarvis_voice_worker_audio enable row level security;
revoke all on public.jarvis_voice_worker_audio from anon, authenticated;
grant all on public.jarvis_voice_worker_audio to service_role;
