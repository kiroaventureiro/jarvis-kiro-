BEGIN;
DO $test$
DECLARE
 j text; a text; r record; receipt record; t jsonb; done jsonb; scenario text;
 expires timestamptz:=clock_timestamp()+interval '5 minutes'; v_count integer;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['success','transient','permanent','uncertain'] LOOP
 j:='audit_'||replace(gen_random_uuid()::text,'-',''); a:=j||'_approval';
 PERFORM * FROM jk_hml.register_command(j,j,'jarvis-kiro-hml','homologation',1,j,repeat('a',64),'simulation.'||scenario,scenario,'audit/test',expires);
 SELECT count(*) INTO v_count FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=j;
 IF v_count<>0 THEN RAISE EXCEPTION 'Unapproved job was leased'; END IF;
 SELECT * INTO receipt FROM jk_hml.record_approval(a,j,j,repeat('b',64),'simulation.'||scenario,'homologation','https://jarvis-kiro.vercel.app','jarvis-kiro-hml','approve',expires);
 IF receipt.persisted THEN RAISE EXCEPTION 'Mismatched digest approved'; END IF;
 SELECT * INTO receipt FROM jk_hml.record_approval(a,j,j,repeat('a',64),'simulation.'||scenario,'homologation','https://jarvis-kiro.vercel.app','jarvis-kiro-hml','approve',expires);
 IF NOT receipt.persisted OR receipt.job_state<>'pending' OR receipt.http_status<>201 THEN RAISE EXCEPTION 'Approval failed: %',row_to_json(receipt); END IF;
 SELECT * INTO receipt FROM jk_hml.record_approval(a,j,j,repeat('a',64),'simulation.'||scenario,'homologation','https://jarvis-kiro.vercel.app','jarvis-kiro-hml','approve',expires);
 IF receipt.decision_status<>'replayed' THEN RAISE EXCEPTION 'Approval replay failed'; END IF;
 SELECT * INTO r FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=j;
 IF r."jobId" IS NULL THEN RAISE EXCEPTION 'Reservation missing'; END IF;
 t:=jk_hml.begin_attempt(j,r."reservationToken",'jarvis-kiro-hml','https://jarvis-kiro.vercel.app',120,3);
 IF t->>'statusCode'<>'ATTEMPT_ACQUIRED' THEN RAISE EXCEPTION 'Attempt failed: %',t; END IF;
 done:=jk_hml.begin_attempt(j,r."reservationToken",'jarvis-kiro-hml','https://jarvis-kiro.vercel.app',120,3);
 IF done->>'acquired'='true' THEN RAISE EXCEPTION 'Duplicate attempt acquired'; END IF;
 IF scenario='success' THEN
 done:=jk_hml.complete_simulated_success(j,t->>'attemptId',gen_random_uuid(),1,j,repeat('a',64),'simulation.success','simulated:success:v1:'||j||':'||(t->>'attemptId'),'cd462d31d89a7be43f8cb8fb25836d157c9ac418c6cd9b11d3523dc669219de1');
 IF done->>'persisted'='true' THEN RAISE EXCEPTION 'Invalid lease accepted'; END IF;
 done:=jk_hml.complete_simulated_success(j,t->>'attemptId',(t->>'leaseToken')::uuid,1,j,repeat('a',64),'simulation.success','simulated:success:v1:'||j||':'||(t->>'attemptId'),'cd462d31d89a7be43f8cb8fb25836d157c9ac418c6cd9b11d3523dc669219de1');
 IF done->>'recordedState'<>'succeeded' THEN RAISE EXCEPTION 'Completion failed: %',done; END IF;
 done:=jk_hml.complete_simulated_success(j,t->>'attemptId',(t->>'leaseToken')::uuid,1,j,repeat('a',64),'simulation.success','simulated:success:v1:'||j||':'||(t->>'attemptId'),'cd462d31d89a7be43f8cb8fb25836d157c9ac418c6cd9b11d3523dc669219de1');
 IF done->>'statusCode'<>'REPLAY' THEN RAISE EXCEPTION 'Completion replay failed'; END IF;
 SELECT count(*) INTO v_count FROM jk_hml.outbox WHERE job_id=j;
 IF v_count<>1 THEN RAISE EXCEPTION 'Outbox not atomic'; END IF;
 ELSE
 SELECT * INTO receipt FROM jk_hml.record_failure(j,t->>'attemptId',(t->>'leaseToken')::uuid,scenario,'SIM_'||upper(scenario),1,scenario='transient');
 IF NOT receipt.persisted OR receipt.planned_state<>(CASE scenario WHEN 'transient' THEN 'retry_wait' WHEN 'permanent' THEN 'failed' ELSE 'reconciliation_required' END) THEN RAISE EXCEPTION 'Failure persistence failed: %',row_to_json(receipt); END IF;
 END IF;
 END LOOP;
 RAISE NOTICE 'PASS: approval, replay, reservation, fencing, success/outbox and three failure paths';
END;
$test$;
ROLLBACK;
