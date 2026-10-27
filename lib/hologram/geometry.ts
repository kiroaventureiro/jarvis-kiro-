export type Geometry = {
  lines: Float32Array;
  points: Float32Array;
  particles: number;
};
const TAU = Math.PI * 2;
/** Position, family, arc, alpha, point size. Deterministic, shared by all frames. */
export function createGeometry(particles = 150): Geometry {
  const lines: number[] = [],
    points: number[] = [];
  const vertex = (
    out: number[],
    p: number[],
    group: number,
    arc: number,
    alpha: number,
    size = 1,
  ) => out.push(...p, group, arc, alpha, size);
  function curve(
    group: number,
    steps: number,
    alpha: number,
    point: (a: number) => number[],
  ) {
    for (let i = 0; i < steps; i++) {
      vertex(lines, point(i / steps), group, i / steps, alpha);
      vertex(lines, point((i + 1) / steps), group, (i + 1) / steps, alpha);
    }
  }
  // Tilted great circles and curved parallels create an actual three-dimensional shell.
  for (let k = 0; k < 13; k++) {
    const turn = k * 2.39996,
      tilt = 0.2 + k * 0.19;
    curve(0, 112, 0.27 + (k % 3) * 0.06, (a) => {
      const t = a * TAU,
        r = 1 + 0.018 * Math.sin(t * 5 + k);
      const x = Math.cos(t) * r,
        y = Math.sin(t) * Math.cos(tilt) * r,
        z = Math.sin(t) * Math.sin(tilt) * r;
      return [
        x * Math.cos(turn) + z * Math.sin(turn),
        y,
        -x * Math.sin(turn) + z * Math.cos(turn),
      ];
    });
  }
  for (let k = -2; k <= 2; k++) {
    const y = k * 0.28,
      radius = Math.sqrt(1 - y * y);
    curve(0, 112, 0.18, (a) => [
      radius * Math.cos(a * TAU),
      y,
      radius * Math.sin(a * TAU),
    ]);
  }
  for (let k = 0; k < 4; k++) {
    const tilt = [0.3, -0.42, 0.61, -0.64][k],
      roll = [0.1, -0.26, 0.51, -0.48][k],
      radius = [1.45, 1.36, 1.25, 1.3][k];
    const orbit = (a: number) => {
      const x = Math.cos(a * TAU) * radius,
        y = Math.sin(a * TAU) * radius * Math.sin(tilt),
        z = Math.sin(a * TAU) * radius * Math.cos(tilt);
      return [
        x * Math.cos(roll) - y * Math.sin(roll),
        x * Math.sin(roll) + y * Math.cos(roll),
        z,
      ];
    };
    curve(k + 1, 160, 0.7, orbit);
    for (let p = 0; p < 7; p++)
      vertex(points, orbit(p / 7), k + 1, p / 7, 0.85, p % 2 ? 9 : 20);
  }
  const count = Math.max(0, Math.min(150, Math.floor(particles)));
  for (let k = 0; k < count; k++) {
    const y = 1 - (2 * (k + 0.5)) / Math.max(1, count),
      phi = k * 2.3999632,
      r = Math.sqrt(1 - y * y);
    const p = [r * Math.cos(phi), y, r * Math.sin(phi)];
    vertex(points, p, 0, k / count, 0.4 + (k % 4) * 0.15, k % 9 ? 6 : 21);
  }
  return {
    lines: new Float32Array(lines),
    points: new Float32Array(points),
    particles: count,
  };
}
