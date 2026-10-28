"use client";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import geography from "../../../config/holo-world-map.json";
import { googleMapsUrl } from "../../../lib/holo/presentation";
import HoloTypewriter from "./HoloTypewriter";
import type { HoloModule } from "../../../lib/holo/types";
function HoloWorldMap({
  module: m,
  automatic = false,
}: {
  automatic?: boolean;
  module: Extract<HoloModule, { kind: "map" }>;
}) {
  const pattern = useId().replace(/:/g, ""),
    svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState(m.focusCountry || ""),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [query, setQuery] = useState("");
  const country = geography.regions.find((r) => r.id === selected);
  useEffect(() => {
    if (!automatic || !m.focusCountry) return;
    setSelected(m.focusCountry);
    const target = svgRef.current?.querySelector<SVGGraphicsElement>(
      '[data-country="' + m.focusCountry + '"]',
    );
    if (!target) return;
    const box = target.getBBox();
    if (!box.width || !box.height) return;
    const scale = Math.max(
      1.15,
      Math.min(2.8, Math.min(700 / box.width, 330 / box.height)),
    );
    setZoom(scale);
    setOffset({
      x: scale * (500 - box.x - box.width / 2),
      y: scale * (250 - box.y - box.height / 2),
    });
  }, [automatic, m.focusCountry]);
  const choices = useMemo(() => {
    const n = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return geography.regions
      .filter((r) =>
        (r.name + " " + r.english + " " + r.iso)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(n),
      )
      .slice(0, 12);
  }, [query]);
  return (
    <div
      className={"holo-world-map" + (automatic ? " is-automatic-map" : "")}
      data-context-country={selected}
    >
      <div className="holo-world-viewport">
        <svg
          ref={svgRef}
          viewBox={geography.viewBox}
          role="group"
          aria-label={
            automatic
              ? "Mapa-múndi · " + (country?.name || "contexto global")
              : "Mapa-múndi interativo"
          }
        >
          <defs>
            <pattern
              id={pattern}
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M50 0H0V50"
                fill="none"
                stroke="#38baff"
                strokeWidth=".4"
                opacity=".25"
              />
            </pattern>
          </defs>
          <rect width="1000" height="500" fill={"url(#" + pattern + ")"} />
          <g
            style={{
              transform:
                "translate(" +
                (500 - 500 * zoom + offset.x) +
                "px," +
                (250 - 250 * zoom + offset.y) +
                "px) scale(" +
                zoom +
                ")",
            }}
            transform={
              "translate(" +
              (500 - 500 * zoom + offset.x) +
              "," +
              (250 - 250 * zoom + offset.y) +
              ") scale(" +
              zoom +
              ")"
            }
          >
            {geography.regions.map((r) => (
              <path
                key={r.id}
                data-country={r.id}
                d={r.d}
                fillRule="evenodd"
                pathLength="1"
                className={selected === r.id ? "is-selected" : ""}
                tabIndex={automatic ? -1 : 0}
                role={automatic ? "presentation" : "button"}
                aria-hidden={automatic || undefined}
                aria-label={"Selecionar " + r.name}
                aria-pressed={selected === r.id}
                onClick={automatic ? undefined : () => setSelected(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r.id);
                  }
                }}
              >
                <title>{r.name}</title>
              </path>
            ))}
          </g>
        </svg>
        <span className="holo-map-coordinate">EARTH / NATURAL EARTH 110M</span>
      </div>
      {!automatic ? (
        <>
          <div className="holo-map-tools">
            <button
              onClick={() => setZoom((v) => Math.min(5, v + 0.5))}
              aria-label="Aproximar mapa-múndi"
              disabled={zoom >= 5}
            >
              +
            </button>
            <button
              onClick={() => setZoom((v) => Math.max(1, v - 0.5))}
              aria-label="Afastar mapa-múndi"
              disabled={zoom <= 1}
            >
              −
            </button>
            <button
              onClick={() => setOffset((v) => ({ ...v, x: v.x + 70 }))}
              aria-label="Mover mapa para oeste"
            >
              ←
            </button>
            <button
              onClick={() => setOffset((v) => ({ ...v, x: v.x - 70 }))}
              aria-label="Mover mapa para leste"
            >
              →
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Restaurar
            </button>
          </div>
          <label className="holo-map-search">
            Buscar país ou localização
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              placeholder="País, cidade ou endereço"
            />
          </label>
          {query ? (
            <div className="holo-country-options">
              {choices.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setQuery("");
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <p className="holo-map-selection" role="status">
        {country?.name || "Selecione uma área no mapa"}
      </p>
      {!automatic ? (
        <a
          className="holo-google-maps"
          href={googleMapsUrl(query.trim() || country?.name || "Mundo")}
          target="_blank"
          rel="noreferrer"
        >
          Abrir {query.trim() || country?.name || "localização"} no Google Maps
          ↗
        </a>
      ) : null}
      <p className="holo-caption">
        {automatic ? <HoloTypewriter text={m.caption} /> : m.caption}
      </p>
      <a href={geography.url} target="_blank" rel="noreferrer">
        Natural Earth · cartografia de referência ↗
      </a>
    </div>
  );
}

export default memo(HoloWorldMap);
