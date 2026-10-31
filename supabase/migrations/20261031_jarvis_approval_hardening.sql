-- Optional hardening for Jarvis action approvals. Do not execute automatically.
-- Review identity model before applying to production.
alter table public.jarvis_approvals
  add column if not exists owner_id text,
  add column if not exists resource_id text,
  add column if not exists expires_at timestamptz,
  add column if not exists consumed_at timestamptz;

create index if not exists jarvis_approvals_pending_scope_idx
  on public.jarvis_approvals(owner_id, action_kind, resource_id, status, expires_at);

-- No public RPC and no RLS policies are added.
-- An authenticated backend with service-role access must atomically claim:
-- UPDATE jarvis_approvals SET status='executed', consumed_at=now()
-- WHERE id=$approval AND owner_id=$owner AND action_kind=$action
-- AND resource_id=$resource AND status='approved'
-- AND consumed_at IS NULL AND expires_at > now()
-- RETURNING id;
-- If zero rows are returned, execution MUST be refused.
-- Approval must be validated by a trusted, user-authenticated backend;
-- caller-supplied flags or objects are not evidence.
-- Log success/failure without secrets in jarvis_audit.
