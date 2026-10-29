export const MAX_ATTACHMENTS = 8;
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 512 * 1024;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_INSTRUCTION_LENGTH = 8000;
export type AttachmentKind = "image" | "document" | "text";
export const FILE_TYPES: Record<
  string,
  { mime: string; kind: AttachmentKind }
> = {
  pdf: { mime: "application/pdf", kind: "document" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "document",
  },
  doc: { mime: "application/msword", kind: "document" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "document",
  },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "document" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "document",
  },
  xls: { mime: "application/vnd.ms-excel", kind: "document" },
  odt: { mime: "application/vnd.oasis.opendocument.text", kind: "document" },
  rtf: { mime: "application/rtf", kind: "document" },
  csv: { mime: "text/csv", kind: "document" },
  tsv: { mime: "text/tab-separated-values", kind: "document" },
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
};
for (const ext of [
  "txt",
  "md",
  "markdown",
  "json",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "sql",
  "log",
  "yaml",
  "yml",
  "toml",
  "srt",
  "vtt",
  "tex",
  "c",
  "cpp",
  "h",
  "java",
  "rs",
  "go",
  "sh",
  "ps1",
])
  FILE_TYPES[ext] = { mime: "text/plain", kind: "text" };
export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}
export function attachmentType(name: string) {
  return FILE_TYPES[fileExtension(name)] || null;
}
export function safeFileName(name: string) {
  return name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180) || "arquivo";
}
export function fileProblem(file: {
  name: string;
  size: number;
}): string | null {
  if (!attachmentType(file.name))
    return "Formato ainda não suportado para análise.";
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_ATTACHMENT_BYTES)
    return "O limite total é 3 MB por análise.";
  return null;
}
export function validateSignature(name: string, bytes: Uint8Array) {
  const ext = fileExtension(name);
  const starts = (hex: number[]) => hex.every((n, i) => bytes[i] === n);
  const ascii = (start: number, end: number) =>
    new TextDecoder().decode(bytes.slice(start, end));
  if (ext === "pdf" && ascii(0, 5) !== "%PDF-")
    throw new Error("O conteúdo não corresponde a um PDF.");
  if (
    ["docx", "pptx", "xlsx", "odt"].includes(ext) &&
    !starts([0x50, 0x4b, 3, 4])
  )
    throw new Error("Documento Office/ODT inválido.");
  if (
    ["doc", "ppt", "xls"].includes(ext) &&
    !starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  )
    throw new Error("Documento Office inválido.");
  if (ext === "rtf" && !ascii(0, 5).startsWith("{\\rtf"))
    throw new Error("Documento RTF inválido.");
  if (ext === "png" && !starts([137, 80, 78, 71, 13, 10, 26, 10]))
    throw new Error("Imagem PNG inválida.");
  if (["jpg", "jpeg"].includes(ext) && !starts([255, 216, 255]))
    throw new Error("Imagem JPEG inválida.");
  if (ext === "webp" && (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP"))
    throw new Error("Imagem WEBP inválida.");
  if (attachmentType(name)?.kind === "text" || ["csv", "tsv"].includes(ext)) {
    if (bytes.includes(0))
      throw new Error("O arquivo não contém texto compatível.");
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
}
