BEGIN;
CREATE OR REPLACE FUNCTION jk_hml.recover_jobs(p_origin text,p_authority text)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,jk_hml AS $$
DECLARE n integer:=0; v integer;
BEGIN
 IF p_origin IS DISTINCT FROM 'jarvis-kiro-hml' OR p_authority IS DISTINCT FROM 'jarvis-kiro-hml-approval' THEN RAISE EXCEPTION 'Invalid HML identity'; END IF;
 -- An interrupted or expired in-flight operation is uncertain; never replay it automatically.
 WITH expired AS (
 SELECT c.job_id FROM jk_hml.commands c JOIN jk_hml.attempts a USING(job_id)
 WHERE c.authenticated_origin=p_origin AND c.job_state='running' AND a.state='running'
 AND a.lease_expires_at<=clock_timestamp() ORDER BY c.id LIMIT 10 FOR UPDATE OF c SKIP LOCKED
 ), updated AS (
 UPDATE jk_hml.commands c SET job_state='reconciliation_required' FROM expired e WHERE c.job_id=e.job_id RETURNING c.job_id
 ) UPDATE jk_hml.attempts a SET state='reconciliation_required',finished_at=clock_timestamp()
 FROM updated u WHERE a.job_id=u.job_id AND a.state='running';
 GET DIAGNOSTICS n=ROW_COUNT;
 WITH eligible AS (
 SELECT c.job_id FROM jk_hml.commands c JOIN jk_hml.retry_schedule s USING(job_id)
 WHERE c.authenticated_origin=p_origin AND c.environment='homologation' AND c.job_state='retry_wait'
 AND s.next_attempt_at<=clock_timestamp() AND c.context_expires_at>clock_timestamp()
 AND (SELECT count(*) FROM jk_hml.attempts t WHERE t.job_id=c.job_id)<3
 AND EXISTS(SELECT 1 FROM jk_hml.approvals a WHERE a.job_id=c.job_id AND a.decision='approve'
 AND a.authority=p_authority AND a.origin=p_origin AND a.expires_at>clock_timestamp()
 AND a.digest=c.digest AND a.plan_id=c.plan_id AND a.capability=c.capability
 AND NOT EXISTS(SELECT 1 FROM jk_hml.approvals newer WHERE newer.job_id=a.job_id AND newer.created_at>a.created_at))
 ORDER BY c.id LIMIT 10 FOR UPDATE OF c SKIP LOCKED
 ) UPDATE jk_hml.commands c SET job_state='pending' FROM eligible e WHERE c.job_id=e.job_id;
 GET DIAGNOSTICS v=ROW_COUNT;
 RETURN n+v;
END; $$;
REVOKE ALL ON FUNCTION jk_hml.recover_jobs(text,text) FROM PUBLIC;
DO $install$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('jk_hml.reserve_jobs(integer,integer,text)'::regprocedure) INTO definition;
 IF position('PERFORM jk_hml.recover_jobs' IN definition)=0 THEN
  IF position('    RETURN QUERY' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected reserve_jobs definition'; END IF;
  definition:=replace(definition,'    RETURN QUERY',E'    PERFORM jk_hml.recover_jobs(p_origin, ''jarvis-kiro-hml-approval'');\n    RETURN QUERY');
  EXECUTE definition;
 END IF;
END;
$install$;
COMMIT;
