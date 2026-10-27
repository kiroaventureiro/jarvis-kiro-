"use client";
import { useId } from "react";
const outline =
  "M77 16H120V126C120 173 98 194 59 194C23 194 5 176 2 141L40 134C42 153 48 159 59 159C72 159 77 149 77 126Z M137 16H179V90L240 16H290L213 103L296 192H242L179 122V192H137Z";
export default function JKMonogram() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="jk-monogram" viewBox="0 0 320 220" aria-hidden="true">
      <defs>
        <linearGradient
          id={id + "metal"}
          x1=".1"
          y1="0"
          x2=".83"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="#3a7599" />
          <stop offset=".07" stopColor="#0a1829" />
          <stop offset=".38" stopColor="#01050d" />
          <stop offset=".64" stopColor="#030a15" />
          <stop offset=".8" stopColor="#14334e" />
          <stop offset="1" stopColor="#020714" />
        </linearGradient>
        <linearGradient id={id + "edge"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e2faff" />
          <stop offset=".35" stopColor="#42dfff" />
          <stop offset=".58" stopColor="#06518a" />
          <stop offset="1" stopColor="#a7f6ff" />
        </linearGradient>
        <linearGradient id={id + "bevel"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#5094b8" />
          <stop offset=".3" stopColor="#040e20" />
          <stop offset="1" stopColor="#04233e" />
        </linearGradient>
        <filter id={id + "glow"} x="-30%" y="-40%" width="170%" height="190%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="3"
            floodColor="#087bff"
            floodOpacity=".9"
          />
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="9"
            floodColor="#42dfff"
            floodOpacity=".5"
          />
        </filter>
      </defs>
      <g transform="translate(11 5)" filter={"url(#" + id + "glow)"}>
        <path
          d={outline}
          transform="translate(7 7)"
          fill={"url(#" + id + "bevel)"}
          stroke="#1478ac"
          strokeWidth="1.2"
        />
        <path
          d={outline}
          fill={"url(#" + id + "metal)"}
          stroke={"url(#" + id + "edge)"}
          strokeWidth="1.7"
          strokeLinejoin="miter"
        />
        <path
          d="M80 19H117 M140 19H176V89 M241 19H281L211 99 M5 143L37 137 M181 125L244 189"
          fill="none"
          stroke="#b6eeff"
          strokeOpacity=".42"
          strokeWidth="1"
        />
        <path
          d="M113 25V125C113 168 95 187 62 187 M144 25V184 M280 23L204 104L284 186"
          fill="none"
          stroke="#142b43"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
