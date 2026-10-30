/** Procedural scene: every star, plasma trail and surface is drawn from geometry/noise.
 * The reference photograph is never loaded, sampled or used as a canvas texture.
 */
export type CosmicFrame = {
  time: number;
  energy: number;
  x: number;
  y: number;
  motion: boolean;
};
export function seededRandom(seed = 719) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const ORBIT_SPEED = 0.15;
export function orbitPosition(time: number, motion = true) {
  // Vertical orbit: the blue star descends in front of the horizon and
  // returns behind it. Both axes are centered on the black hole.
  const angle = Math.PI + (motion ? time * ORBIT_SPEED : 0);
  return {
    x: Math.sin(angle) * 1.6,
    y: Math.cos(angle) * 2.2,
    front: Math.sin(angle) < 0,
  };
}
export function trailSamples(time: number, count = 42) {
  // Previous orbital positions, never a Bezier curve anchored to the core.
  // The tail spans less than a quarter turn, so it cannot catch itself.
  return Array.from({ length: count }, (_, i) => {
    const age = i / Math.max(1, count - 1);
    return {
      ...orbitPosition(time - age * 8.5),
      width: Math.pow(1 - age, 1.25),
      alpha: Math.pow(1 - age, 1.6),
    };
  });
}
export function createCosmicRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  const random = seededRandom();
  const disk = document.createElement("canvas");
  disk.width = disk.height = 1100;
  const dc = disk.getContext("2d");
  if (!dc) return null;
  // This offscreen surface is generated entirely by code and cached once.
  const palette = ["255,224,157", "255,190,80", "239,124,30", "172,60,15"];
  const base = dc.createRadialGradient(550, 550, 0, 550, 550, 550);
  base.addColorStop(0, "rgba(0,0,0,0)");
  base.addColorStop(0.315, "rgba(0,0,0,0)");
  base.addColorStop(0.33, "rgba(255,225,157,.9)");
  base.addColorStop(0.44, "rgba(255,185,70,.72)");
  base.addColorStop(0.68, "rgba(230,102,18,.42)");
  base.addColorStop(0.96, "rgba(100,27,5,.07)");
  base.addColorStop(1, "rgba(0,0,0,0)");
  dc.fillStyle = base;
  dc.fillRect(0, 0, 1100, 1100);
  for (let i = 0; i < 24000; i++) {
    const radius = 175 + Math.pow(random(), 0.8) * 355;
    const angle = random() * Math.PI * 2;
    const ridge =
      0.5 + 0.5 * Math.sin(radius * 0.34 + Math.sin(angle * 5) * 1.2);
    const spiral = 0.5 + 0.5 * Math.sin(angle * 9 - radius * 0.031);
    const heat = (radius - 175) / 355;
    dc.fillStyle = `rgba(${palette[Math.min(3, Math.floor(heat * 4))]},${0.035 + ridge * spiral * 0.16})`;
    dc.beginPath();
    dc.ellipse(
      550 + Math.cos(angle) * radius,
      550 + Math.sin(angle) * radius,
      0.6 + random() * 1.7,
      0.3 + random(),
      angle,
      0,
      Math.PI * 2,
    );
    dc.fill();
  }
  for (let r = 178; r < 530; r += 1.7) {
    dc.strokeStyle = `rgba(255,204,111,${0.035 + 0.06 * (0.5 + 0.5 * Math.sin(r * 1.73))})`;
    dc.lineWidth = 0.6 + random() * 1.5;
    dc.beginPath();
    dc.arc(550, 550, r, 0, Math.PI * 2);
    dc.stroke();
  }
  for (let arm = 0; arm < 17; arm++) {
    dc.strokeStyle = "rgba(255,215,130,.045)";
    dc.lineWidth = 4 + random() * 9;
    dc.beginPath();
    for (let n = 0; n < 75; n++) {
      const r = 180 + n * 4.5,
        a = (arm / 17) * Math.PI * 2 + n * 0.035;
      const x = 550 + Math.cos(a) * r,
        y = 550 + Math.sin(a) * r;
      if (n) dc.lineTo(x, y);
      else dc.moveTo(x, y);
    }
    dc.stroke();
  }
  const stars = Array.from({ length: 1050 }, () => ({
    x: random(),
    y: random(),
    size: 0.2 + Math.pow(random(), 4) * 1.5,
    alpha: 0.13 + random() * 0.75,
    hue: random(),
  }));
  const surface = Array.from({ length: 650 }, () => ({
    angle: random() * Math.PI * 2,
    radius: Math.sqrt(random()),
    alpha: random(),
  }));
  const sky = document.createElement("canvas");
  const grain = document.createElement("canvas");
  grain.width = grain.height = 256;
  const gc = grain.getContext("2d");
  if (gc)
    for (const point of surface) {
      gc.fillStyle = `rgba(190,247,255,${point.alpha * 0.3})`;
      gc.beginPath();
      gc.arc(
        128 + Math.cos(point.angle) * point.radius * 128,
        128 + Math.sin(point.angle) * point.radius * 128,
        0.6 + point.alpha * 2,
        0,
        Math.PI * 2,
      );
      gc.fill();
    }
  let disposed = false;
  function glow(
    x: number,
    y: number,
    radius: number,
    color: string,
    alpha: number,
  ) {
    const gradient = ctx!.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color},${alpha})`);
    gradient.addColorStop(0.32, `rgba(${color},${alpha * 0.28})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx!.fillStyle = gradient;
    ctx!.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function star(
    x: number,
    y: number,
    radius: number,
    time: number,
    energy: number,
  ) {
    ctx!.save();
    glow(x, y, radius * 3.6, "42,157,255", 0.32 + energy * 0.08);
    glow(x, y, radius * 1.5, "84,213,255", 0.7);
    const fill = ctx!.createRadialGradient(
      x - radius * 0.32,
      y - radius * 0.28,
      radius * 0.08,
      x,
      y,
      radius,
    );
    fill.addColorStop(0, "#d3f8ff");
    fill.addColorStop(0.4, "#68dcff");
    fill.addColorStop(0.8, "#1184da");
    fill.addColorStop(1, "#0c427a");
    ctx!.fillStyle = fill;
    ctx!.beginPath();
    ctx!.arc(x, y, radius, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.save();
    ctx!.beginPath();
    ctx!.arc(x, y, radius - 0.5, 0, Math.PI * 2);
    ctx!.clip();
    ctx!.translate(x, y);
    ctx!.rotate(time * 0.045);
    ctx!.drawImage(grain, -radius, -radius, radius * 2, radius * 2);
    ctx!.restore();
    ctx!.strokeStyle = "#8be6ffb0";
    ctx!.lineWidth = 0.8;
    ctx!.beginPath();
    ctx!.arc(x, y, radius, 0, Math.PI * 2);
    ctx!.stroke();
    ctx!.restore();
  }
  function draw(frame: CosmicFrame) {
    if (disposed) return;
    const c = ctx!,
      w = canvas.width,
      h = canvas.height;
    const time = frame.motion ? frame.time : 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#010207";
    c.fillRect(0, 0, w, h);
    const unit = Math.min(w / 5.5, h / 5.8);
    const cx = w * 0.5 + frame.x * unit * 0.12,
      cy = h * 0.5 + frame.y * unit * 0.12;
    if (sky.width !== w || sky.height !== h) {
      sky.width = w;
      sky.height = h;
      const sc = sky.getContext("2d");
      if (sc) {
        sc.fillStyle = "#010207";
        sc.fillRect(0, 0, w, h);
        for (const s of stars) {
          sc.fillStyle = `rgba(${s.hue > 0.86 ? "246,198,151" : "184,211,243"},${s.alpha})`;
          sc.beginPath();
          sc.arc(
            s.x * w,
            s.y * h,
            s.size * Math.max(0.7, w / 1500),
            0,
            Math.PI * 2,
          );
          sc.fill();
        }
      }
    }
    c.drawImage(sky, frame.x * 3, frame.y * 3);
    glow(w * 0.25, h * 0.42, w * 0.42, "10,37,85", 0.12);
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.23);
    const o = orbitPosition(time, frame.motion),
      sx = o.x * unit,
      sy = o.y * unit - unit * 0.15;
    const sr = unit * (0.44 + (o.front ? 0.025 : -0.025));
    const tail = trailSamples(time);
    function flow(front: boolean) {
      c.save();
      c.globalCompositeOperation = "screen";
      c.lineCap = "round";
      c.lineJoin = "round";
      for (let i = 0; i < tail.length - 1; i++) {
        const from = tail[i], to = tail[i + 1];
        if (from.front !== front) continue;
        const width = sr * 1.75 * from.width;
        const fade = from.alpha;
        c.beginPath();
        c.moveTo(from.x * unit, from.y * unit - unit * 0.15);
        c.lineTo(to.x * unit, to.y * unit - unit * 0.15);
        c.strokeStyle = `rgba(31,137,255,${(0.17 * fade).toFixed(3)})`;
        c.lineWidth = Math.max(0.1, width * 2.2);
        c.stroke();
        c.strokeStyle = `rgba(128,222,255,${(0.72 * fade).toFixed(3)})`;
        c.lineWidth = Math.max(0.1, width * 0.65);
        c.stroke();
      }
      c.restore();
    }
    flow(false);
    if (!o.front) star(sx, sy, sr, time, frame.energy);
    // Back accretion disk and its warm bloom.
    c.save();
    c.scale(1, 0.29);
    c.globalCompositeOperation = "screen";
    glow(0, 0, unit * 3.5, "225,94,17", 0.22);
    c.rotate(time * 0.055);
    c.drawImage(disk, -unit * 3.5, -unit * 3.5, unit * 7, unit * 7);
    c.restore();
    // Lensed light bending up around the event horizon.
    c.save();
    c.scale(1, 0.97);
    c.globalCompositeOperation = "screen";
    for (let i = 0; i < 55; i++) {
      const radius = unit * (1.03 + i * 0.0065);
      c.strokeStyle = `rgba(255,${Math.round(199 - i * 1.7)},${Math.round(90 - i)},${(0.15 + 0.05 * Math.sin(i * 1.2 + time * 0.22)) * (1 - i / 65)})`;
      c.lineWidth = unit * 0.02;
      c.beginPath();
      c.arc(0, 0, radius, Math.PI * 1.01, Math.PI * 1.99);
      c.stroke();
    }
    c.restore();
    // The horizon is actual occlusion in the drawing, never a photographed circle.
    const horizon = c.createRadialGradient(
      0,
      0,
      unit * 0.78,
      0,
      0,
      unit * 1.08,
    );
    horizon.addColorStop(0, "#000102");
    horizon.addColorStop(0.77, "#000102");
    horizon.addColorStop(0.88, "#070404");
    horizon.addColorStop(0.94, "#c8792a");
    horizon.addColorStop(0.965, "#ffe7ae");
    horizon.addColorStop(1, "rgba(158,78,19,0)");
    c.fillStyle = horizon;
    c.beginPath();
    c.arc(0, 0, unit * 1.08, 0, Math.PI * 2);
    c.fill();
    // Near-side plasma travels in front of the lower horizon.
    c.save();
    c.beginPath();
    c.arc(0, 0, unit * 1.08, 0, Math.PI * 2);
    c.clip();
    c.beginPath();
    c.moveTo(-unit * 1.2, unit * 0.08);
    c.quadraticCurveTo(0, unit * 0.53, unit * 1.2, unit * 0.08);
    c.lineTo(unit * 1.3, unit * 1.3);
    c.lineTo(-unit * 1.3, unit * 1.3);
    c.closePath();
    c.clip();
    c.scale(1, 0.29);
    c.rotate(time * 0.055);
    c.globalCompositeOperation = "screen";
    c.drawImage(disk, -unit * 3.5, -unit * 3.5, unit * 7, unit * 7);
    c.restore();
    c.save();
    c.globalCompositeOperation = "screen";
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = `rgba(255,221,147,${0.035 * (1 - i / 7)})`;
      c.lineWidth = unit * (0.012 + i * 0.018);
      c.beginPath();
      c.ellipse(0, unit * 0.035, unit * 2.5, unit * 0.33, 0, 0, Math.PI);
      c.stroke();
    }
    c.restore();
    flow(true);
    if (o.front) star(sx, sy, sr, time, frame.energy);
    c.restore();
    // Low-amplitude real state response; no false microphone activity.
    if (frame.energy > 1.1)
      glow(
        cx,
        cy,
        unit * 2.2,
        "255,172,68",
        Math.min(0.07, (frame.energy - 1) * 0.04),
      );
  }
  return {
    draw,
    dispose() {
      disposed = true;
      disk.width =
        disk.height =
        sky.width =
        sky.height =
        grain.width =
        grain.height =
          0;
    },
  };
}
