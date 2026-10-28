import { muxVp8, type VideoPacket } from "./webm";
import type { HoloScene, HoloModule } from "./types";
import {
  presentationPlan,
  chartRange,
  chartPosition,
  narrationText,
} from "./presentation";
type Region = { id: string; d: string; name: string };
let regions: Region[] | null = null;
async function world() {
  if (!regions)
    regions = (await import("../../config/holo-world-map.json")).regions;
  return regions;
}
const W = 1440,
  H = 900;
function canvas(w = W, h = H) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (let word of para.split(/\s+/)) {
      while (ctx.measureText(word).width > width) {
        let take = 1;
        while (
          take < word.length &&
          ctx.measureText(word.slice(0, take + 1)).width <= width
        )
          take++;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, take));
        word = word.slice(take);
      }
      if (!word) continue;
      if (
        ctx.measureText((line ? line + " " : "") + word).width > width &&
        line
      ) {
        out.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    out.push(line);
  }
  return out;
}
function write(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  size = 24,
  color = "#bdeafa",
  max = 6,
) {
  ctx.font = size + "px Arial";
  ctx.fillStyle = color;
  const parts = lines(ctx, text, width);
  for (const [i, line] of parts.slice(0, max).entries())
    ctx.fillText(line, x, y + i * size * 1.45);
  if (parts.length > max)
    ctx.fillText("… Consulte o relatório completo.", x, y + max * size * 1.45);
  return y + Math.min(parts.length, max) * size * 1.45;
}
function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#020916";
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    0,
    w * 0.5,
    h * 0.45,
    w * 0.7,
  );
  g.addColorStop(0, "#073449");
  g.addColorStop(1, "#010510");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#0e3547";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#33d9ff";
  ctx.strokeRect(28, 28, w - 56, h - 56);
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 24,
  color = "#bdeafa",
) {
  ctx.font = size + "px Arial";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
export async function renderFrame(
  ctx: CanvasRenderingContext2D,
  scene: HoloScene,
  module: HoloModule,
  progress = 1,
) {
  background(ctx, W, H);
  label(ctx, "JARVIS KIRO  /  DEMONSTRAÇÃO", 65, 75, 20, "#3df3ff");
  write(ctx, scene.title, 65, 125, 1300, 32, "#ecfbff", 2);
  label(ctx, module.title, 65, 215, 25, "#5be5ff");
  const x = 90,
    y = 270,
    w = 1260,
    h = 450,
    p = Math.max(0, Math.min(1, progress));
  if (module.kind === "map") {
    const brazil =
      module.region === "BR"
        ? await import("../../config/holo-brazil-map.json")
        : null;
    const areas = brazil ? brazil.regions : await world(),
      mapWidth = brazil ? 330 : 1000,
      mapHeight = brazil ? 335 : 500,
      scale = Math.min(w / mapWidth, h / mapHeight);
    ctx.save();
    ctx.translate(x + (w - mapWidth * scale) / 2, y);
    ctx.scale(scale, scale);
    for (const region of areas) {
      const path = new Path2D(region.d);
      ctx.fillStyle = region.id === module.focusCountry ? "#31e7ff" : "#10384f";
      ctx.strokeStyle = "#369dbb";
      ctx.lineWidth = 0.5;
      ctx.fill(path, "evenodd");
      ctx.stroke(path);
    }
    ctx.restore();
    write(ctx, module.caption, 90, 775, 1240, 20, "#a2cdde", 2);
    label(
      ctx,
      module.region === "BR"
        ? "Base cartográfica IBGE · visão simplificada"
        : "Base cartográfica Natural Earth · visão simplificada",
      90,
      840,
      18,
    );
  } else if (module.kind === "metrics") {
    const range = chartRange(module.values.map((v) => v.value)),
      px = (i: number) => x + (i * w) / Math.max(1, module.values.length - 1),
      py = (v: number) => y + h - chartPosition(v, range.low, range.high) * h;
    ctx.strokeStyle = "#286078";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = y + (i * h) / 4;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
      label(
        ctx,
        (range.high - (i * (range.high - range.low)) / 4).toLocaleString(
          "pt-BR",
          { maximumFractionDigits: 2 },
        ),
        x + 6,
        yy - 8,
        16,
        "#76b7d0",
      );
    }
    ctx.strokeStyle = "#3ff7fc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    const n = Math.max(1, Math.ceil(module.values.length * p));
    module.values
      .slice(0, n)
      .forEach((v, i) =>
        i ? ctx.lineTo(px(i), py(v.value)) : ctx.moveTo(px(i), py(v.value)),
      );
    ctx.stroke();
    for (const [v, i] of module.values
      .slice(0, n)
      .map((v, i) => [v, i] as const)) {
      ctx.fillStyle = "#abffff";
      ctx.beginPath();
      ctx.arc(px(i), py(v.value), 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 0 || i === module.values.length - 1)
        label(ctx, v.label, Math.min(px(i), W - 220), y + h + 38, 18);
    }
    const v = module.values[Math.max(0, n - 1)];
    if (v)
      label(
        ctx,
        v.value.toLocaleString("pt-BR") +
          " " +
          module.unit +
          " · " +
          (v.period || v.label),
        x,
        800,
        28,
        "#d7ffff",
      );
    label(
      ctx,
      "Série publicada · consulte datas e fontes no relatório",
      x,
      840,
      18,
    );
  } else {
    const text =
      module.kind === "report"
        ? [
            module.summary,
            ...module.items.map((i) => i.label + ": " + i.detail),
          ].join("\n")
        : module.kind === "timeline"
          ? module.events
              .map((e) => e.when + " — " + e.label + ": " + e.detail)
              .join("\n")
          : module.kind === "compare"
            ? module.columns
                .map((c) => c.label + "\n" + c.points.join("; "))
                .join("\n")
            : module.kind === "connections"
              ? module.items
                  .map((i) => i.label + ": " + i.state + " — " + i.detail)
                  .join("\n")
              : module.kind === "text"
                ? module.text
                : module.items
                    .map(
                      (i) =>
                        i.label +
                        " — " +
                        (i.caption || i.type) +
                        " " +
                        (i.url || "Arquivo da sessão"),
                    )
                    .join("\n");
    write(
      ctx,
      text.slice(0, Math.ceil(text.length * p)),
      x,
      y + 20,
      w,
      28,
      "#d2eff9",
      11,
    );
    label(ctx, "Conteúdo completo disponível no relatório PDF", x, 840, 18);
  }
}
function blobOf(c: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error("Não foi possível gerar a imagem.")),
      type,
      quality,
    ),
  );
}
export async function imageExport(scene: HoloScene, signal: AbortSignal) {
  const c = canvas(),
    ctx = c.getContext("2d")!;
  const m =
    scene.modules.find(
      (m) => m.kind === "metrics" || m.kind === "map" || m.kind === "media",
    ) || scene.modules[0];
  if (!m) throw Error("Resultado vazio.");
  await renderFrame(ctx, scene, m);
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  return blobOf(c);
}
export function reportText(scene: HoloScene) {
  const content = [
    scene.title,
    "Gerado em " + new Date(scene.createdAt).toLocaleString("pt-BR"),
    "Origem: " + scene.source.label,
    "RESPOSTA / CONTEXTO",
    narrationText(scene),
  ];
  for (const m of scene.modules) {
    content.push("\n" + m.title.toUpperCase());
    switch (m.kind) {
      case "report":
        content.push(
          m.summary,
          ...m.items.map((i) => i.label + "\n" + i.detail),
        );
        if (m.body && m.body !== scene.narration) content.push(m.body);
        if (m.href) content.push(m.href);
        break;
      case "metrics":
        content.push(
          "Unidade: " + m.unit,
          ...m.values.map(
            (v) =>
              (v.period || v.label) +
              ": " +
              v.value.toLocaleString("pt-BR") +
              " " +
              m.unit,
          ),
        );
        break;
      case "map":
        content.push(
          m.caption,
          "Cartografia: Natural Earth, escala 1:110m. Limites simplificados, sem serviço de navegação.",
        );
        break;
      case "timeline":
        content.push(
          ...m.events.map(
            (e) =>
              e.when +
              " — " +
              e.label +
              "\n" +
              e.detail +
              (e.href ? "\n" + e.href : ""),
          ),
        );
        break;
      case "compare":
        for (const c of m.columns) content.push(c.label, ...c.points);
        break;
      case "connections":
        content.push(
          ...m.items.map(
            (i) =>
              i.label +
              " — " +
              i.state +
              "\n" +
              i.detail +
              (i.checkedAt ? "\nVerificação: " + i.checkedAt : ""),
          ),
        );
        break;
      case "media":
        content.push(
          ...m.items.map(
            (i) =>
              i.label +
              " (" +
              i.type +
              ")\n" +
              (i.caption || "") +
              (i.url
                ? "\n" + i.url
                : "\nArquivo temporário da sessão; não incorporado ao PDF."),
          ),
        );
        break;
      case "text":
        content.push(m.text, ...m.tags);
    }
  }
  content.push(
    "\nFONTES E LIMITAÇÕES",
    ...(scene.sources || []).map(
      (s) =>
        s.label +
        " — " +
        s.status +
        "\n" +
        s.href +
        "\nConsultado: " +
        s.checkedAt +
        (s.note ? "\n" + s.note : ""),
    ),
    scene.source.href || "Origem detalhada nos módulos acima.",
    "Este documento reproduz o resultado desta sessão. Dados podem mudar; indisponibilidade não representa valor zero. O vídeo é uma demonstração visual sem áudio, gerada localmente.",
  );
  return content.join("\n\n");
}
const enc = new TextEncoder();
function join(parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0),
    out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
export function jpegPagesPdf(
  pages: Array<{ bytes: Uint8Array; width: number; height: number }>,
) {
  const objects: Uint8Array[] = [];
  const add = (value: string | Uint8Array) =>
    objects.push(typeof value === "string" ? enc.encode(value) : value);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(
    "<< /Type /Pages /Count " +
      pages.length +
      " /Kids [" +
      pages.map((_, i) => 3 + i * 3 + " 0 R").join(" ") +
      "] >>",
  );
  pages.forEach((p, i) => {
    const page = 3 + i * 3,
      img = page + 1,
      stream = page + 2,
      pw = p.width > p.height ? 842 : 595,
      ph = p.width > p.height ? 526.25 : 842;
    add(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        pw +
        " " +
        ph +
        "] /Resources << /XObject << /Im " +
        img +
        " 0 R >> >> /Contents " +
        stream +
        " 0 R >>",
    );
    add(
      join([
        enc.encode(
          "<< /Type /XObject /Subtype /Image /Width " +
            p.width +
            " /Height " +
            p.height +
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            p.bytes.length +
            " >>\nstream\n",
        ),
        p.bytes,
        enc.encode("\nendstream"),
      ]),
    );
    const s = "q " + pw + " 0 0 " + ph + " 0 0 cm /Im Do Q";
    add(
      "<< /Length " +
        enc.encode(s).length +
        " >>\nstream\n" +
        s +
        "\nendstream",
    );
  });
  const parts = [enc.encode("%PDF-1.4\n%JK\n")],
    offsets = [0];
  let pos = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(pos);
    const b = join([
      enc.encode(i + 1 + " 0 obj\n"),
      obj,
      enc.encode("\nendobj\n"),
    ]);
    parts.push(b);
    pos += b.length;
  });
  const xref = pos;
  parts.push(
    enc.encode(
      "xref\n0 " +
        (objects.length + 1) +
        "\n0000000000 65535 f \n" +
        offsets
          .slice(1)
          .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
          .join("") +
        "trailer\n<< /Size " +
        (objects.length + 1) +
        " /Root 1 0 R >>\nstartxref\n" +
        xref +
        "\n%%EOF",
    ),
  );
  return join(parts);
}
export async function pdfExport(scene: HoloScene, signal: AbortSignal) {
  const pages: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  const add = async (c: HTMLCanvasElement) => {
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    const b = await blobOf(c, "image/jpeg", 0.86);
    pages.push({
      bytes: new Uint8Array(await b.arrayBuffer()),
      width: c.width,
      height: c.height,
    });
  };
  const visual = scene.modules.find(
    (m) => m.kind === "metrics" || m.kind === "map",
  );
  if (visual) {
    const c = canvas();
    await renderFrame(c.getContext("2d")!, scene, visual);
    await add(c);
  }
  let c = canvas(1240, 1754),
    ctx = c.getContext("2d")!,
    y = 145,
    page = 1;
  const reset = () => {
    background(ctx, 1240, 1754);
    label(ctx, "JARVIS KIRO / RELATÓRIO COMPLETO", 65, 80, 22, "#61ebff");
    label(ctx, String(page), 1140, 1690, 18);
    y = 145;
  };
  reset();
  ctx.font = "23px Arial";
  const paragraphs = reportText(scene).split("\n");
  for (const para of paragraphs) {
    ctx.font = "23px Arial";
    for (const line of lines(ctx, para, 1100)) {
      if (y > 1630) {
        await add(c);
        page++;
        c = canvas(1240, 1754);
        ctx = c.getContext("2d")!;
        reset();
      }
      label(ctx, line, 65, y, 23, "#d7edf5");
      y += 34;
    }
    y += 12;
  }
  await add(c);
  return new Blob([jpegPagesPdf(pages) as BlobPart], {
    type: "application/pdf",
  });
}
export async function videoExport(
  scene: HoloScene,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
) {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined")
    throw Error(
      "Este navegador não oferece o codificador de vídeo necessário. Use Chrome/Edge atualizado ou exporte PNG/PDF.",
    );
  const videoWidth = 1024,
    videoHeight = 640;
  const fps = 12,
    config: VideoEncoderConfig = {
      codec: "vp8",
      width: videoWidth,
      height: videoHeight,
      framerate: fps,
      bitrate: 1800000,
      latencyMode: "realtime",
      hardwareAcceleration: "prefer-software",
    };
  if (!(await VideoEncoder.isConfigSupported(config)).supported)
    throw Error("Codificador VP8 indisponível. Exporte PNG ou PDF.");
  const plan = presentationPlan(scene);
  if (!plan.length) throw Error("Resultado vazio.");
  const durationMs = Math.min(24, Math.max(8, plan.length * 3)) * 1000,
    total = Math.round((durationMs / 1000) * fps),
    c = canvas(),
    ctx = c.getContext("2d")!,
    packets: VideoPacket[] = [];
  const encodeCanvas = canvas(videoWidth, videoHeight),
    encodeContext = encodeCanvas.getContext("2d", {
      willReadFrequently: true,
    })!,
    mapFrames = new Map<string, HTMLCanvasElement>();
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      packets.push({
        bytes,
        timestamp: chunk.timestamp,
        key: chunk.type === "key",
      });
    },
    error: (error) => {
      failure = error;
    },
  });
  const timeout = setTimeout(() => {
    failure = new Error(
      "A exportação de vídeo excedeu o tempo disponível. Exporte PNG/PDF ou tente novamente.",
    );
    if (encoder.state !== "closed") encoder.close();
  }, 120000);
  const abort = () => {
    if (encoder.state !== "closed") encoder.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    encoder.configure(config);
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
      if (failure) throw failure;
      const fraction = i / (total - 1),
        position = fraction * plan.length,
        index = Math.min(plan.length - 1, Math.floor(position)),
        step = plan[index],
        module = step.content;
      const cached = mapFrames.get(module.id);
      if (module.kind === "map" && cached) ctx.drawImage(cached, 0, 0);
      else {
        await renderFrame(
          ctx,
          scene,
          module,
          fraction >= 1 ? 1 : position - index,
        );
        if (module.kind === "map") {
          const copy = canvas();
          copy.getContext("2d")!.drawImage(c, 0, 0);
          mapFrames.set(module.id, copy);
        }
      }
      label(ctx, "VÍDEO DEMONSTRATIVO · SEM ÁUDIO", 65, 875, 16, "#7db8cf");
      encodeContext.drawImage(c, 0, 0, videoWidth, videoHeight);
      const pixels = encodeContext.getImageData(0, 0, videoWidth, videoHeight);
      const frame = new VideoFrame(pixels.data.buffer as ArrayBuffer, {
        format: "RGBA",
        codedWidth: videoWidth,
        codedHeight: videoHeight,
        timestamp: Math.round((i * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      });
      try {
        encoder.encode(frame, { keyFrame: i % (fps * 3) === 0 });
      } finally {
        frame.close();
      }
      if (encoder.encodeQueueSize >= 8) await encoder.flush();
      onProgress((i + 1) / total);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await encoder.flush();
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    if (failure) throw failure;
    if (packets.length !== total)
      throw Error(
        "O navegador não codificou todos os quadros. Tente novamente.",
      );
    return new Blob(
      [muxVp8(packets, videoWidth, videoHeight, durationMs, fps) as BlobPart],
      {
        type: "video/webm",
      },
    );
  } catch (error) {
    if (failure) throw failure;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    if (encoder.state !== "closed") encoder.close();
  }
}
