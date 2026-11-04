-- Explicit synthetic HML test. No external executor can run this capability.
DO $test$
DECLARE j text:='hml_audit_'||replace(gen_random_uuid()::text,'-',''); e timestamptz:=clock_timestamp()+interval '10 minutes'; r record;
BEGIN
 SELECT * INTO r FROM jk_hml.register_command(j,j,'jarvis-kiro-hml','homologation',1,j,repeat('a',64),'simulation.success','success','audit/n8n-smoke',e);
 IF NOT r.persisted THEN RAISE EXCEPTION 'Synthetic test registration failed'; END IF;
 SELECT * INTO r FROM jk_hml.record_approval(j||'_approval',j,j,repeat('a',64),'simulation.success','homologation','https://jarvis-kiro.vercel.app','jarvis-kiro-hml','approve',e);
 IF NOT r.persisted THEN RAISE EXCEPTION 'Synthetic test approval failed'; END IF;
 RAISE NOTICE 'Prepared synthetic HML smoke test: %',j;
END;
$test$;
