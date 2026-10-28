"use client";
import {
  projectWorldPoint,
  type PlaceRow,
} from "../../../lib/holo/place-policy";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import geography from "../../../config/holo-world-map.json";
import { googleMapsUrl } from "../../../lib/holo/presentation";
import HoloTypewriter from "./HoloTypewriter";
import type { HoloModule } from "../../../lib/holo/types";
let placesRequest: Promise<PlaceRow[]> | null = null;
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
  const [place, setPlace] = useState<PlaceRow | null>(null),
    [placeError, setPlaceError] = useState(false);
  useEffect(() => {
    if (!m.focusPlaceId) {
      setPlace(null);
      return;
    }
    let active = true;
    setPlaceError(false);
    if (!placesRequest)
      placesRequest = fetch("/holo-places-index.json", {
        signal: AbortSignal.timeout(10000),
      }).then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      });
    void placesRequest.then(
      (rows) => {
        if (!active) return;
        const p = rows.find((r) => r[0] === m.focusPlaceId);
        if (p) setPlace(p);
        else setPlaceError(true);
      },
      () => {
        if (active) setPlaceError(true);
        placesRequest = null;
      },
    );
    return () => {
      active = false;
    };
  }, [m.focusPlaceId]);
  useEffect(() => {
    if (!automatic || !place) return;
    const point = projectWorldPoint(place[3], place[4]),
      scale = 5;
    setZoom(scale);
    setSelected(place[2]);
    setOffset({ x: scale * (500 - point.x), y: scale * (250 - point.y) });
  }, [automatic, place]);
  useEffect(() => {
    if (!automatic || !m.focusCountries?.length) return;
    setSelected("");
    setZoom(1.1);
    setOffset({ x: 0, y: 0 });
  }, [automatic, m.focusCountries]);
  const showPlace =
    place && (automatic || selected === place[2]) ? place : null;
  const point = showPlace
    ? projectWorldPoint(showPlace[3], showPlace[4])
    : null;
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
      data-context-country={selected || m.focusLabel}
      data-context-place={showPlace?.[1]}
      data-holo-pending={
        m.focusPlaceId && !place && !placeError ? true : undefined
      }
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
                className={
                  selected === r.id ||
                  (automatic && m.focusCountries?.includes(r.id))
                    ? "is-selected"
                    : ""
                }
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
            {point && showPlace ? (
              <g
                className="holo-world-place-marker"
                transform={"translate(" + point.x + "," + point.y + ")"}
                aria-label={"Localidade de referência: " + showPlace[1]}
              >
                <circle
                  r={4 / zoom}
                  fill="#ffe4aa"
                  stroke="#fff3d8"
                  strokeWidth={1 / zoom}
                />
                <circle
                  r={8 / zoom}
                  fill="none"
                  stroke="#ffe4aa"
                  strokeWidth={0.6 / zoom}
                />
                <text
                  x={11 / zoom}
                  y={-8 / zoom}
                  fill="#fff0c8"
                  fontSize={15 / zoom}
                >
                  {showPlace[1]}
                </text>
              </g>
            ) : null}
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
        {showPlace?.[1] ||
          m.focusLabel ||
          country?.name ||
          "Selecione uma área no mapa"}
      </p>
      {!automatic ? (
        <a
          className="holo-google-maps"
          href={googleMapsUrl(
            query.trim() || showPlace?.[1] || country?.name || "Mundo",
          )}
          target="_blank"
          rel="noreferrer"
        >
          Abrir{" "}
          {query.trim() || showPlace?.[1] || country?.name || "localização"} no
          Google Maps ↗
        </a>
      ) : null}
      {showPlace ? (
        <small className="holo-geography-note">
          Ponto de referência Natural Earth · {showPlace[4].toFixed(3)},{" "}
          {showPlace[3].toFixed(3)} · sem mapa de ruas.
        </small>
      ) : null}
      {placeError ? (
        <p role="status">
          Não foi possível carregar a localidade. O contexto do país continua
          disponível.
        </p>
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
