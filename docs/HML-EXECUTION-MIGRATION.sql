BEGIN;
CREATE TABLE IF NOT EXISTS jk_hml.approvals (
 approval_id text PRIMARY KEY, job_id text NOT NULL REFERENCES jk_hml.commands(job_id),
 plan_id text NOT NULL, digest text NOT NULL, capability text NOT NULL,
 environment text NOT NULL CHECK(environment='homologation'), authority text NOT NULL,
 origin text NOT NULL, decision text NOT NULL CHECK(decision IN ('approve','reject')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS jk_hml.attempts (
 attempt_id text PRIMARY KEY, job_id text NOT NULL REFERENCES jk_hml.commands(job_id),
 approval_id text NOT NULL REFERENCES jk_hml.approvals(approval_id),
 lease_token uuid NOT NULL UNIQUE, lease_expires_at timestamptz NOT NULL,
 attempt_count integer NOT NULL CHECK(attempt_count BETWEEN 1 AND 3),
 state text NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz, UNIQUE(job_id,attempt_count)
);
CREATE TABLE IF NOT EXISTS jk_hml.events (
 event_id text PRIMARY KEY, job_id text NOT NULL REFERENCES jk_hml.commands(job_id),
 attempt_id text, state text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS jk_hml.outbox (
 event_id text PRIMARY KEY REFERENCES jk_hml.events(event_id),
 job_id text NOT NULL REFERENCES jk_hml.commands(job_id), attempt_id text NOT NULL,
 result_ref text NOT NULL, result_digest text NOT NULL,
 simulated boolean NOT NULL DEFAULT true CHECK(simulated),
 delivery_state text NOT NULL DEFAULT 'blocked' CHECK(delivery_state IN ('blocked','delivered')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS jk_hml.retry_schedule (
 job_id text PRIMARY KEY REFERENCES jk_hml.commands(job_id), next_attempt_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION jk_hml.record_approval(
 p_id text,p_job text,p_plan text,p_digest text,p_cap text,p_env text,
 p_authority text,p_origin text,p_decision text,p_expiry timestamptz
) RETURNS TABLE(persisted boolean,approval_id text,job_id text,plan_id text,digest text,
 capability text,environment text,decision text,expires_at timestamptz,
 decision_current boolean,in_flight_not_cancelled boolean,job_state text,http_status integer,decision_status text)
LANGUAGE plpgsql SET search_path=pg_catalog,jk_hml AS $$
DECLARE c jk_hml.commands%ROWTYPE; a jk_hml.approvals%ROWTYPE; replay boolean:=false;
BEGIN
 IF p_id IS NULL OR p_id !~ '^[A-Za-z0-9_-]{1,128}$'
 OR p_env IS DISTINCT FROM 'homologation' OR p_origin IS DISTINCT FROM 'jarvis-kiro-hml'
 OR p_authority IS DISTINCT FROM 'jarvis-kiro-hml-approval'
 OR p_decision IS NULL OR p_decision NOT IN ('approve','reject')
 OR p_expiry IS NULL OR p_expiry<=clock_timestamp() THEN
 RETURN QUERY SELECT false,p_id,p_job,p_plan,p_digest,p_cap,p_env,p_decision,p_expiry,false,false,NULL::text,400,'invalid'::text; RETURN;
 END IF;
 SELECT * INTO c FROM jk_hml.commands x WHERE x.job_id=p_job FOR UPDATE;
 IF NOT FOUND OR c.plan_id IS DISTINCT FROM p_plan OR c.digest IS DISTINCT FROM p_digest
 OR c.capability IS DISTINCT FROM p_cap OR c.authenticated_origin IS DISTINCT FROM p_origin
 OR c.environment IS DISTINCT FROM p_env THEN
 RETURN QUERY SELECT false,p_id,p_job,p_plan,p_digest,p_cap,p_env,p_decision,p_expiry,false,false,NULL::text,409,'conflict'::text; RETURN;
 END IF;
 SELECT * INTO a FROM jk_hml.approvals x WHERE x.approval_id=p_id;
 IF FOUND THEN
 IF (a.job_id,a.plan_id,a.digest,a.capability,a.environment,a.authority,a.origin,a.decision,a.expires_at)
 IS DISTINCT FROM (p_job,p_plan,p_digest,p_cap,p_env,p_authority,p_origin,p_decision,p_expiry) THEN
 RETURN QUERY SELECT false,p_id,p_job,p_plan,p_digest,p_cap,p_env,p_decision,p_expiry,false,false,c.job_state,409,'conflict'::text; RETURN;
 END IF; replay:=true;
 ELSE
 IF c.job_state NOT IN ('awaiting_approval','pending','approval_blocked') THEN
 RETURN QUERY SELECT false,p_id,p_job,p_plan,p_digest,p_cap,p_env,p_decision,p_expiry,false,false,c.job_state,409,'conflict'::text; RETURN;
 END IF;
 INSERT INTO jk_hml.approvals VALUES(p_id,p_job,p_plan,p_digest,p_cap,p_env,p_authority,p_origin,p_decision,p_expiry,clock_timestamp());
 UPDATE jk_hml.commands x SET job_state=CASE WHEN p_decision='approve' THEN 'pending' ELSE 'cancelled' END WHERE x.job_id=p_job RETURNING * INTO c;
 END IF;
 RETURN QUERY SELECT true,p_id,p_job,p_plan,p_digest,p_cap,p_env,p_decision,p_expiry,
 NOT EXISTS(SELECT 1 FROM jk_hml.approvals x WHERE x.job_id=p_job AND x.created_at>a.created_at),
 c.job_state='running',c.job_state,CASE WHEN replay THEN 200 ELSE 201 END,CASE WHEN replay THEN 'replayed' ELSE 'recorded' END;
END; $$;

CREATE OR REPLACE FUNCTION jk_hml.begin_attempt(p_job text,p_reservation uuid,p_origin text,p_authority text,p_lease integer,p_max integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,jk_hml AS $$
DECLARE c jk_hml.commands%ROWTYPE; r jk_hml.reservations%ROWTYPE; a jk_hml.approvals%ROWTYPE;
 v_count integer; v_id text; v_token uuid; v_expiry timestamptz;
BEGIN
 IF p_origin IS DISTINCT FROM 'jarvis-kiro-hml' OR p_authority IS DISTINCT FROM 'jarvis-kiro-hml-approval' THEN RETURN jsonb_build_object('acquired',false,'statusCode','FENCING_REJECTED'); END IF;
 SELECT * INTO c FROM jk_hml.commands WHERE job_id=p_job FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('acquired',false,'statusCode','JOB_NOT_FOUND'); END IF;
 SELECT * INTO r FROM jk_hml.reservations WHERE job_id=p_job FOR UPDATE;
 IF NOT FOUND OR r.reservation_token IS DISTINCT FROM p_reservation OR r.released_at IS NOT NULL
 OR r.lease_expires_at<=clock_timestamp() OR r.reserved_by IS DISTINCT FROM p_origin
 OR c.job_state<>'pending' OR c.authenticated_origin<>p_origin THEN
 RETURN jsonb_build_object('acquired',false,'statusCode','INVALID_RESERVATION'); END IF;
 SELECT * INTO a FROM jk_hml.approvals WHERE job_id=p_job ORDER BY created_at DESC,approval_id DESC LIMIT 1;
 IF NOT FOUND OR a.decision<>'approve' OR a.expires_at<=clock_timestamp() OR a.authority<>p_authority
 OR a.digest<>c.digest OR a.plan_id<>c.plan_id OR a.capability<>c.capability OR a.origin<>p_origin THEN
 RETURN jsonb_build_object('acquired',false,'statusCode','APPROVAL_INVALID'); END IF;
 IF c.context_expires_at IS NULL OR c.context_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('acquired',false,'statusCode','CONTEXT_EXPIRED'); END IF;
 IF c.capability NOT IN ('simulation.success','simulation.transient','simulation.permanent','simulation.uncertain','simulation.interruption')
 OR c.capability IS DISTINCT FROM 'simulation.'||c.simulation_scenario THEN RETURN jsonb_build_object('acquired',false,'statusCode','INVALID_CAPABILITY'); END IF;
 SELECT count(*)+1 INTO v_count FROM jk_hml.attempts WHERE job_id=p_job;
 IF v_count>LEAST(COALESCE(p_max,3),3) THEN RETURN jsonb_build_object('acquired',false,'statusCode','RETRY_EXHAUSTED'); END IF;
 v_id:='attempt_'||replace(gen_random_uuid()::text,'-',''); v_token:=gen_random_uuid();
 v_expiry:=LEAST(a.expires_at,c.context_expires_at,clock_timestamp()+make_interval(secs=>LEAST(GREATEST(COALESCE(p_lease,120),1),120)));
 INSERT INTO jk_hml.attempts VALUES(v_id,p_job,a.approval_id,v_token,v_expiry,v_count,'running',clock_timestamp(),NULL);
 UPDATE jk_hml.commands SET job_state='running' WHERE job_id=p_job;
 UPDATE jk_hml.reservations SET released_at=clock_timestamp() WHERE job_id=p_job;
 INSERT INTO jk_hml.events(event_id,job_id,attempt_id,state) VALUES(v_id||':started',p_job,v_id,'running');
 RETURN jsonb_build_object('acquired',true,'persisted',true,'statusCode','ATTEMPT_ACQUIRED','recordedState','running',
 'eventId',v_id||':started','approvalVerified',true,'environment','homologation','authenticatedOrigin',p_origin,
 'authenticatedAuthority',p_authority,'jobId',p_job,'planId',c.plan_id,'digest',c.digest,'capability',c.capability,
 'simulationScenario',c.simulation_scenario,'attemptId',v_id,'approvalId',a.approval_id,'approvalExpiresAt',a.expires_at,
 'leaseToken',v_token,'leaseExpiresAt',v_expiry,'attemptCount',v_count,'contextRef',c.context_ref,'contextExpiresAt',c.context_expires_at);
END; $$;

CREATE OR REPLACE FUNCTION jk_hml.complete_simulated_success(p_job text,p_attempt text,p_token uuid,p_count integer,p_plan text,p_digest text,p_cap text,p_ref text,p_result_digest text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,jk_hml AS $$
DECLARE c jk_hml.commands%ROWTYPE; t jk_hml.attempts%ROWTYPE; v_replay boolean;
BEGIN
 SELECT * INTO c FROM jk_hml.commands WHERE job_id=p_job FOR UPDATE;
 SELECT * INTO t FROM jk_hml.attempts WHERE attempt_id=p_attempt AND job_id=p_job FOR UPDATE;
 IF t.attempt_id IS NULL OR t.lease_token IS DISTINCT FROM p_token OR t.attempt_count IS DISTINCT FROM p_count
 OR c.plan_id IS DISTINCT FROM p_plan OR c.digest IS DISTINCT FROM p_digest OR c.capability IS DISTINCT FROM p_cap
 OR p_cap IS DISTINCT FROM 'simulation.success' OR p_ref IS DISTINCT FROM 'simulated:success:v1:'||p_job||':'||p_attempt
 OR p_result_digest IS DISTINCT FROM 'cd462d31d89a7be43f8cb8fb25836d157c9ac418c6cd9b11d3523dc669219de1' THEN
 RETURN jsonb_build_object('persisted',false,'statusCode','FENCING_REJECTED'); END IF;
 v_replay:=t.state='succeeded';
 IF NOT v_replay AND (t.state<>'running' OR t.lease_expires_at<=clock_timestamp() OR c.job_state<>'running') THEN RETURN jsonb_build_object('persisted',false,'statusCode','FENCING_REJECTED'); END IF;
 IF NOT v_replay THEN
 UPDATE jk_hml.attempts SET state='succeeded',finished_at=clock_timestamp() WHERE attempt_id=p_attempt;
 UPDATE jk_hml.commands SET job_state='succeeded' WHERE job_id=p_job;
 INSERT INTO jk_hml.events(event_id,job_id,attempt_id,state) VALUES(p_attempt||':success',p_job,p_attempt,'succeeded');
 INSERT INTO jk_hml.outbox(event_id,job_id,attempt_id,result_ref,result_digest) VALUES(p_attempt||':success',p_job,p_attempt,p_ref,p_result_digest);
 END IF;
 RETURN jsonb_build_object('persisted',true,'statusCode',CASE WHEN v_replay THEN 'REPLAY' ELSE 'RECORDED' END,
 'jobId',p_job,'attemptId',p_attempt,'recordedState','succeeded','eventId',p_attempt||':success','resultRef',p_ref,
 'resultDigest',p_result_digest,'simulated',true,'externalActionPerformed',false);
END; $$;

CREATE OR REPLACE FUNCTION jk_hml.record_failure(p_job text,p_attempt text,p_token uuid,p_class text,p_code text,p_count integer,p_retry boolean)
RETURNS TABLE(job_id text,attempt_id text,planned_state text,persisted boolean,status_code text,event_id text)
LANGUAGE plpgsql SET search_path=pg_catalog,jk_hml AS $$
DECLARE t jk_hml.attempts%ROWTYPE; v_state text;
BEGIN
 PERFORM 1 FROM jk_hml.commands c WHERE c.job_id=p_job FOR UPDATE;
 SELECT * INTO t FROM jk_hml.attempts a WHERE a.attempt_id=p_attempt AND a.job_id=p_job FOR UPDATE;
 IF t.attempt_id IS NULL OR t.lease_token IS DISTINCT FROM p_token OR t.attempt_count IS DISTINCT FROM p_count
 OR p_class IS NULL OR p_class NOT IN ('transient','permanent','uncertain','exhausted') THEN
 RETURN QUERY SELECT p_job,p_attempt,NULL::text,false,'FENCING_REJECTED'::text,NULL::text; RETURN; END IF;
 v_state:=CASE WHEN p_class='transient' AND p_retry IS TRUE AND p_count<3 THEN 'retry_wait'
 WHEN p_class='permanent' THEN 'failed' WHEN p_class='uncertain' THEN 'reconciliation_required' ELSE 'quarantined' END;
 IF t.state=v_state THEN RETURN QUERY SELECT p_job,p_attempt,v_state,true,'REPLAY'::text,p_attempt||':failure'; RETURN; END IF;
 IF t.state<>'running' OR t.lease_expires_at<=clock_timestamp() THEN
 RETURN QUERY SELECT p_job,p_attempt,NULL::text,false,'FENCING_REJECTED'::text,NULL::text; RETURN; END IF;
 UPDATE jk_hml.attempts a SET state=v_state,finished_at=clock_timestamp() WHERE a.attempt_id=p_attempt;
 UPDATE jk_hml.commands c SET job_state=v_state WHERE c.job_id=p_job;
 INSERT INTO jk_hml.events(event_id,job_id,attempt_id,state) VALUES(p_attempt||':failure',p_job,p_attempt,v_state);
 IF v_state='retry_wait' THEN INSERT INTO jk_hml.retry_schedule VALUES(p_job,clock_timestamp()+make_interval(secs=>CASE WHEN p_count=1 THEN 30 ELSE 120 END)) ON CONFLICT ON CONSTRAINT retry_schedule_pkey DO UPDATE SET next_attempt_at=EXCLUDED.next_attempt_at; END IF;
 RETURN QUERY SELECT p_job,p_attempt,v_state,true,'RECORDED'::text,p_attempt||':failure';
END; $$;
REVOKE ALL ON FUNCTION jk_hml.record_approval(text,text,text,text,text,text,text,text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION jk_hml.begin_attempt(text,uuid,text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION jk_hml.complete_simulated_success(text,text,uuid,integer,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION jk_hml.record_failure(text,text,uuid,text,text,integer,boolean) FROM PUBLIC;
COMMIT;
