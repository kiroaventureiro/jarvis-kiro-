"use client";
import { memo, useId, useMemo, useState } from "react";
import geography from "../../../config/holo-world-map.json";
import { googleMapsUrl } from "../../../lib/holo/presentation";
import type { HoloModule } from "../../../lib/holo/types";
function HoloWorldMap({
  module: m,
}: {
  module: Extract<HoloModule, { kind: "map" }>;
}) {
  const pattern = useId().replace(/:/g, "");
  const [selected, setSelected] = useState(m.focusCountry || ""),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [query, setQuery] = useState("");
  const country = geography.regions.find((r) => r.id === selected);
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
    <div className="holo-world-map">
      <div className="holo-world-viewport">
        <svg
          viewBox={geography.viewBox}
          role="group"
          aria-label="Mapa-múndi interativo"
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
                d={r.d}
                fillRule="evenodd"
                pathLength="1"
                className={selected === r.id ? "is-selected" : ""}
                tabIndex={0}
                role="button"
                aria-label={"Selecionar " + r.name}
                aria-pressed={selected === r.id}
                onClick={() => setSelected(r.id)}
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
      <p className="holo-map-selection" role="status">
        {country?.name || "Selecione uma área no mapa"}
      </p>
      <a
        className="holo-google-maps"
        href={googleMapsUrl(query.trim() || country?.name || "Mundo")}
        target="_blank"
        rel="noreferrer"
      >
        Abrir {query.trim() || country?.name || "localização"} no Google Maps ↗
      </a>
      <p className="holo-caption">{m.caption}</p>
      <a href={geography.url} target="_blank" rel="noreferrer">
        Natural Earth · cartografia de referência ↗
      </a>
    </div>
  );
}

export default memo(HoloWorldMap);
