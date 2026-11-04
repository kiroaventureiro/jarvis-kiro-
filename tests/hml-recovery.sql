BEGIN;
DO $test$
DECLARE j text:='audit_recovery_'||replace(gen_random_uuid()::text,'-',''); e timestamptz:=clock_timestamp()+interval '10 minutes'; r record; t jsonb; receipt record; i integer;
BEGIN
 PERFORM * FROM jk_hml.register_command(j,j,'jarvis-kiro-hml','homologation',1,j,repeat('a',64),'simulation.transient','transient','audit/recovery',e);
 PERFORM * FROM jk_hml.record_approval(j||'_approval',j,j,repeat('a',64),'simulation.transient','homologation','jarvis-kiro-hml-approval','jarvis-kiro-hml','approve',e);
 FOR i IN 1..3 LOOP
 SELECT * INTO r FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=j;
 IF r."jobId" IS NULL THEN RAISE EXCEPTION 'Retry reservation missing on attempt %',i; END IF;
 t:=jk_hml.begin_attempt(j,r."reservationToken",'jarvis-kiro-hml','jarvis-kiro-hml-approval',120,3);
 IF (t->>'attemptCount')::integer<>i THEN RAISE EXCEPTION 'Attempt counter mismatch'; END IF;
 SELECT * INTO receipt FROM jk_hml.record_failure(j,t->>'attemptId',(t->>'leaseToken')::uuid,'transient','SIM_TRANSIENT',i,true);
 IF NOT receipt.persisted THEN RAISE EXCEPTION 'Failure not persisted'; END IF;
 IF i<3 THEN
 IF EXISTS(SELECT 1 FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=j) THEN RAISE EXCEPTION 'Retry delay bypassed'; END IF;
 UPDATE jk_hml.retry_schedule SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE job_id=j;
 ELSE
 IF receipt.planned_state<>'quarantined' THEN RAISE EXCEPTION 'Retry limit bypassed'; END IF;
 END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=j) THEN RAISE EXCEPTION 'Quarantined job re-executed'; END IF;
 RAISE NOTICE 'PASS: retry delay, recovery, three-attempt limit and quarantine';
END;
$test$;
ROLLBACK;
