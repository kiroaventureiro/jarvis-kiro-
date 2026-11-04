-- Existing n8n node: Registrar comando atomicamente - PENDENTE
-- Keep the existing queryReplacement array of eleven parameters.
SELECT * FROM jk_hml.register_command(
  $1::text, $2::text, $3::text, $4::text, $5::integer,
  $6::text, $7::text, $8::text, $9::text, $10::text,
  $11::timestamptz
);
