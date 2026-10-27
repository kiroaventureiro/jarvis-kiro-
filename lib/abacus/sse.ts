export async function* readSSE(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    bytes = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 2000000) throw new Error("STREAM_TOO_LARGE");
      buffer += decoder.decode(part.value, { stream: true });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((x) => x.startsWith("data:"))
          .map((x) => x.slice(5).trimStart())
          .join("\n");
        if (data) yield data;
      }
      if (buffer.length > 32768) throw new Error("STREAM_EVENT_TOO_LARGE");
    }
    buffer += decoder.decode();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const data = buffer
      .split(/\r?\n/)
      .filter((x) => x.startsWith("data:"))
      .map((x) => x.slice(5).trimStart())
      .join("\n");
    if (data) yield data;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
