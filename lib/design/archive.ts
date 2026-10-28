/** ZIP stored entries, fixed relative names supplied by our generator. No executable archiver. */
export function designZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder(),
    parts: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0,
    centralSize = 0;
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const x of b) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const header = (size: number) => {
    const b = new Uint8Array(size);
    return { b, v: new DataView(b.buffer) };
  };
  for (const [name, text] of Object.entries(files)) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(name) ||
      name.startsWith("/") ||
      name.split("/").includes("..")
    )
      throw Error("Caminho inválido");
    const n = enc.encode(name),
      data = enc.encode(text),
      sum = crc(data),
      h = header(30);
    h.v.setUint32(0, 0x04034b50, true);
    h.v.setUint16(4, 20, true);
    h.v.setUint16(6, 0x800, true);
    h.v.setUint32(14, sum, true);
    h.v.setUint32(18, data.length, true);
    h.v.setUint32(22, data.length, true);
    h.v.setUint16(26, n.length, true);
    parts.push(h.b, n, data);
    const c = header(46);
    c.v.setUint32(0, 0x02014b50, true);
    c.v.setUint16(4, 20, true);
    c.v.setUint16(6, 20, true);
    c.v.setUint16(8, 0x800, true);
    c.v.setUint32(16, sum, true);
    c.v.setUint32(20, data.length, true);
    c.v.setUint32(24, data.length, true);
    c.v.setUint16(28, n.length, true);
    c.v.setUint32(42, offset, true);
    central.push(c.b, n);
    centralSize += 46 + n.length;
    offset += 30 + n.length + data.length;
  }
  const end = header(22),
    count = Object.keys(files).length;
  end.v.setUint32(0, 0x06054b50, true);
  end.v.setUint16(8, count, true);
  end.v.setUint16(10, count, true);
  end.v.setUint32(12, centralSize, true);
  end.v.setUint32(16, offset, true);
  const chunks = [...parts, ...central, end.b],
    out = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
