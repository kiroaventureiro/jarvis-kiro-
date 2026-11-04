BEGIN;
DO $align$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('jk_hml.reserve_jobs(integer,integer,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'https://jarvis-kiro.vercel.app','jarvis-kiro-hml-approval');
 EXECUTE definition;
END;
$align$;
COMMIT;
