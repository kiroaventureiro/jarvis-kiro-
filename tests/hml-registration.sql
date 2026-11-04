BEGIN;
DO $test$
DECLARE
  receipt record;
  test_id text := 'audit_' || replace(gen_random_uuid()::text, '-', '');
  total integer;
BEGIN
  SELECT * INTO receipt FROM jk_hml.register_command(
    test_id, test_id, 'jarvis-kiro-hml', 'homologation', 1,
    test_id, repeat('a',64), 'simulation.success', 'success',
    'audit/transaction', clock_timestamp() + interval '5 minutes');
  IF NOT receipt.persisted OR receipt.http_status <> 202 OR receipt.job_state <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Registration failed';
  END IF;
  SELECT * INTO receipt FROM jk_hml.register_command(
    test_id, test_id, 'jarvis-kiro-hml', 'homologation', 1,
    test_id, repeat('a',64), 'simulation.success', 'success',
    'audit/transaction', clock_timestamp() + interval '5 minutes');
  IF receipt.registration_status <> 'replayed' OR receipt.http_status <> 200 THEN
    RAISE EXCEPTION 'Idempotent replay failed';
  END IF;
  SELECT * INTO receipt FROM jk_hml.register_command(
    test_id, test_id, 'jarvis-kiro-hml', 'homologation', 1,
    test_id, repeat('b',64), 'simulation.success', 'success',
    'audit/transaction', clock_timestamp() + interval '5 minutes');
  IF receipt.registration_status <> 'conflict' OR receipt.persisted THEN
    RAISE EXCEPTION 'Conflict was not rejected';
  END IF;
  SELECT count(*) INTO total FROM jk_hml.reserve_jobs(10,120,'jarvis-kiro-hml') WHERE "jobId"=test_id;
  IF total <> 0 THEN RAISE EXCEPTION 'Approval was bypassed'; END IF;
  RAISE NOTICE 'PASS: registration, replay, conflict and approval gate';
END;
$test$;
ROLLBACK;
