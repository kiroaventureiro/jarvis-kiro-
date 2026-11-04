DO $test$
DECLARE receipt record;
BEGIN
 SELECT * INTO receipt FROM jk_hml.register_command(
 'hml_audit_webhook_identity_v1','hml_audit_webhook_identity_v1','jarvis-kiro-hml','homologation',1,
 'hml_audit_webhook_identity_v1',repeat('a',64),'simulation.success','success','audit/authenticated-webhook',clock_timestamp()+interval '20 minutes');
 IF NOT receipt.persisted THEN RAISE EXCEPTION 'Synthetic webhook test registration failed'; END IF;
END;
$test$;
