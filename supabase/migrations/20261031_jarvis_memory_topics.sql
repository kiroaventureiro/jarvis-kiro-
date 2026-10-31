-- Jarvis Kiro: optional, additive storage for topical memory.
-- Do not alter or migrate jarvis_owner_memory (existing encrypted history).
-- Run only after reviewing project ownership and server authorization.
create table if not exists public.jarvis_memory_topics (
  owner_id text not null,
  topic_id text not null check (topic_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  encrypted_payload text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, topic_id)
);
alter table public.jarvis_memory_topics enable row level security;
-- No policies: anon/authenticated clients cannot query this table.
-- Backend access requires service-role credentials in server-only code.
-- encrypted_payload must use authenticated encryption before insertion.
-- Never place summaries, labels, private text, or secrets into plaintext columns.
