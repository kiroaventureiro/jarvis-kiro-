import { memo } from "react";
const random = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const nodes = Array.from({ length: 80 }, (_, i) => ({
  x: Math.round(random(i + 1) * 1600),
  y: Math.round(random(i + 101) * 960),
  r: i % 9 === 0 ? 3 : 1.3,
}));
const edges = nodes.flatMap((a, i) =>
  nodes
    .slice(i + 1)
    .map((b, j) => ({ a, b, j: i + j + 1 }))
    .filter(({ b }) => Math.hypot(a.x - b.x, a.y - b.y) < 225),
);
function HologramBackdrop() {
  return (
    <div className="jk-backdrop" aria-hidden="true">
      <div className="jk-perspective-grid" />
      <div className="jk-volume-shaft" />
      <div className="jk-orbit-environment" />
      <svg viewBox="0 0 1600 960" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="jk-distance">
            <stop stopColor="#087bff" stopOpacity=".12" />
            <stop offset="1" stopColor="#020713" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="800" cy="450" rx="650" ry="470" fill="url(#jk-distance)" />
        <g className="jk-architecture" fill="none" stroke="#4fcfff">
          <path d="M0 180H190L280 90H490M1600 180H1410L1320 90H1110M0 640H140L245 750H420M1600 640H1460L1355 750H1180" />
          <path d="M60 0V125L145 210V520L70 595V960M1540 0V125L1455 210V520L1530 595V960" />
          <path d="M275 0V65H565M1325 0V65H1035M0 330H94M1506 330H1600" />
          <ellipse cx="800" cy="815" rx="510" ry="72" />
          <ellipse
            cx="800"
            cy="815"
            rx="385"
            ry="45"
            strokeDasharray="110 34 5 34"
          />
        </g>
        <g stroke="#1688ee" strokeOpacity=".21" strokeWidth=".7">
          {edges.map(({ a, b, j }, i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              opacity={j % 4 === 0 ? 0.8 : 0.38}
            />
          ))}
        </g>
        <g fill="#1760a8" fillOpacity=".06">
          {nodes.slice(0, 18).map((a, i) => (
            <path
              key={i}
              d={"M" + a.x + " " + a.y + "l" + (52 + i * 3) + " 63 -84 38Z"}
            />
          ))}
        </g>
        <g fill="#42dfff">
          {nodes.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              opacity={i % 3 === 0 ? 0.55 : 0.2}
            />
          ))}
        </g>
        <g stroke="#087bff" strokeOpacity=".1" fill="none">
          <path d="M0 950L800 700 1600 950M0 850L800 700 1600 850M0 760H1600M0 820H1600M0 910H1600" />
        </g>
      </svg>
      <div className="jk-distant-light light-one" />
      <div className="jk-distant-light light-two" />
    </div>
  );
}

export default memo(HologramBackdrop);
