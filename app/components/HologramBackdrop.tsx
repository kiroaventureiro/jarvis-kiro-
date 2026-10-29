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
// Separated facets leave a calm opening behind the core; static SVG avoids another render loop.
const shards = [
  "0,0 510,0 630,300 340,220", "525,0 1020,0 890,240 650,305",
  "1040,0 1600,0 1285,240 910,240", "1600,20 1600,440 1300,350 1295,255",
  "1600,460 1600,960 1205,705 1310,370", "1590,960 1060,960 1005,740 1190,720",
  "1040,960 505,960 650,755 980,750", "485,960 0,960 325,690 630,745",
  "0,940 0,450 300,370 315,675", "0,430 0,20 325,235 310,350",
  "350,240 620,325 505,495 325,350", "920,260 1270,260 1285,350 1110,480",
  "330,390 490,515 600,720 340,670", "1130,510 1290,390 1180,690 1015,720",
];
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
          <linearGradient id="jarvis-glass" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#b8ebff" stopOpacity=".12" />
            <stop offset=".45" stopColor="#16384e" stopOpacity=".025" />
            <stop offset="1" stopColor="#66cfff" stopOpacity=".08" />
          </linearGradient>
        </defs>
        <ellipse cx="800" cy="450" rx="650" ry="470" fill="url(#jk-distance)" />
        <g className="jarvis-glass-shards" fill="url(#jarvis-glass)" stroke="#b4e6ff" strokeWidth=".8" strokeOpacity=".22">
          {shards.map((points, i) => <polygon key={i} points={points} />)}
        </g>
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
