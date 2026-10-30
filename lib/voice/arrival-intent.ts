/** Explicit requests only: do not turn arbitrary news questions into a personal bulletin. */
export function arrivalBriefingIntent(input: string) {
  const text = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(repit[ae]|ouvir|ouca|ler|leia|mostr[ae])\b.*\bboletim\b/.test(
    text,
  );
}
