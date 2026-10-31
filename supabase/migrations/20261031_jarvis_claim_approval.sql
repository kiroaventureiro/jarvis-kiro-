-- Atomic, single-use claim for Jarvis privileged actions.
-- Must be applied only after 20261031_jarvis_approval_hardening.sql.
-- The server MUST authenticate owner and derive all arguments from trusted state.
create or replace function public.jarvis_claim_approval(
  p_id uuid, p_owner_id text, p_action text, p_resource_id text
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare claimed_id uuid;
begin
  if p_id is null or nullif(trim(p_owner_id), '') is null
     or nullif(trim(p_action), '') is null
     or nullif(trim(p_resource_id), '') is null then
    return false;
  end if;
  update public.jarvis_approvals
     set status = 'executed', consumed_at = clock_timestamp()
   where id = p_id
     and owner_id = p_owner_id
     and action_kind = p_action
     and resource_id = p_resource_id
     and status = 'approved'
     and consumed_at is null
     and expires_at > clock_timestamp()
  returning id into claimed_id;
  if claimed_id is null then return false; end if;
  insert into public.jarvis_audit(event_kind, actor, details)
    values ('approval_claimed', p_owner_id,
      jsonb_build_object('approval_id', p_id, 'action', p_action, 'resource', p_resource_id));
  return true;
end;
$$;
-- Explicitly restrict execution even if the database has broad default function grants.
revoke all on function public.jarvis_claim_approval(uuid,text,text,text) from public;
revoke all on function public.jarvis_claim_approval(uuid,text,text,text) from anon;
revoke all on function public.jarvis_claim_approval(uuid,text,text,text) from authenticated;
grant execute on function public.jarvis_claim_approval(uuid,text,text,text) to service_role;

-- Important: claiming a permission is not executing the operation.
-- The application must separately verify identity, session, provider scope,
-- request fingerprint and audit result. Do not expose this RPC to clients.
