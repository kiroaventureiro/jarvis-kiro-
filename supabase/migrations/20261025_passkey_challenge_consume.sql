-- A transaction-safe one-time challenge redemption procedure.
-- Execute only in the dedicated Jarvis database after migration review.
-- Use a service-only database connection: do not grant execute to anon/authenticated.
create or replace function public.jarvis_consume_webauthn_challenge(
  p_challenge_hash text, p_purpose text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare n integer;
begin
  update public.jarvis_webauthn_challenges
     set used_at = now()
   where challenge_hash = p_challenge_hash
     and purpose = p_purpose
     and used_at is null
     and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.jarvis_consume_webauthn_challenge(text,text) from public, anon, authenticated;
-- Must be called only via privileged server role. Failed verification still
-- consumes the challenge (safe against replay); do not reissue same challenge.
