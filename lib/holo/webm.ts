// Minimal finite VP8 WebM container. Timebase: 1 millisecond; one video track, no audio.
export type VideoPacket = {
  bytes: Uint8Array;
  timestamp: number;
  key: boolean;
};
const text = new TextEncoder();
function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
function uint(n: number) {
  let size = 1;
  while (n >= 2 ** (size * 8)) size++;
  const out = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i--) {
    out[i] = n % 256;
    n = Math.floor(n / 256);
  }
  return out;
}
function vint(n: number) {
  let size = 1;
  while (n >= 2 ** (7 * size) - 1) size++;
  if (size > 6) throw Error("Vídeo muito extenso.");
  const out = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i--) {
    out[i] = n % 256;
    n = Math.floor(n / 256);
  }
  out[0] |= 1 << (8 - size);
  return out;
}
function element(id: number, body: Uint8Array) {
  return join([uint(id), vint(body.length), body]);
}
const num = (id: number, value: number) => element(id, uint(value));
const string = (id: number, value: string) => element(id, text.encode(value));
function float(id: number, value: number) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return element(id, bytes);
}
export function muxVp8(
  packets: VideoPacket[],
  width: number,
  height: number,
  durationMs: number,
  fps: number,
) {
  if (
    !packets.length ||
    durationMs > 30000 ||
    durationMs <= 0 ||
    width < 1 ||
    height < 1 ||
    fps < 1
  )
    throw Error("Vídeo inválido.");
  const header = element(
    0x1a45dfa3,
    join([
      num(0x4286, 1),
      num(0x42f7, 1),
      num(0x42f2, 4),
      num(0x42f3, 8),
      string(0x4282, "webm"),
      num(0x4287, 2),
      num(0x4285, 2),
    ]),
  );
  const info = element(
    0x1549a966,
    join([
      num(0x2ad7b1, 1000000),
      float(0x4489, durationMs),
      string(0x4d80, "JK local renderer"),
      string(0x5741, "JK local renderer"),
    ]),
  );
  const tracks = element(
    0x1654ae6b,
    element(
      0xae,
      join([
        num(0xd7, 1),
        num(0x73c5, 1),
        num(0x83, 1),
        num(0x9c, 0),
        string(0x86, "V_VP8"),
        num(0x23e383, Math.round(1e9 / fps)),
        element(0xe0, join([num(0xb0, width), num(0xba, height)])),
      ]),
    ),
  );
  let previous = -1;
  const blocks = packets.map((p) => {
    const ms = Math.round(p.timestamp / 1000);
    if (ms < previous || ms < 0 || ms > 32767)
      throw Error("Linha do tempo de vídeo inválida.");
    previous = ms;
    const block = new Uint8Array(4 + p.bytes.length);
    block[0] = 0x81;
    new DataView(block.buffer).setInt16(1, ms, false);
    block[3] = p.key ? 0x80 : 0;
    block.set(p.bytes, 4);
    return element(0xa3, block);
  });
  const cluster = element(0x1f43b675, join([num(0xe7, 0), ...blocks]));
  return join([header, element(0x18538067, join([info, tracks, cluster]))]);
}
