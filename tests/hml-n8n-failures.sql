DO $test$
DECLARE j text; scenario text; e timestamptz:=clock_timestamp()+interval '10 minutes'; r record;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['transient','permanent','uncertain'] LOOP
 j:='hml_audit_'||scenario||'_'||replace(gen_random_uuid()::text,'-','');
 SELECT * INTO r FROM jk_hml.register_command(j,j,'jarvis-kiro-hml','homologation',1,j,repeat('a',64),'simulation.'||scenario,scenario,'audit/n8n-failures',e);
 IF NOT r.persisted THEN RAISE EXCEPTION 'Synthetic test registration failed'; END IF;
 SELECT * INTO r FROM jk_hml.record_approval(j||'_approval',j,j,repeat('a',64),'simulation.'||scenario,'homologation','jarvis-kiro-hml-approval','jarvis-kiro-hml','approve',e);
 IF NOT r.persisted THEN RAISE EXCEPTION 'Synthetic test approval failed'; END IF;
 RAISE NOTICE 'Prepared synthetic HML test: %',j;
 END LOOP;
END;
$test$;
