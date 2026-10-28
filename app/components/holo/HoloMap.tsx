"use client";
import { memo, useState } from "react";
import geography from "../../../config/holo-brazil-map.json";
import HoloTypewriter from "./HoloTypewriter";
import type { HoloModule } from "../../../lib/holo/types";
type Of<K extends HoloModule["kind"]> = Extract<HoloModule, { kind: K }>;
function HoloMap({
  module: m,
  automatic = false,
}: {
  module: Of<"map">;
  automatic?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(1);
  const region = geography.regions.find((r) => r.id === selected);
  return (
    <div className={"holo-map" + (automatic ? " is-automatic-map" : "")}>
      <div className="holo-map-viewport">
        <svg
          viewBox={geography.viewBox}
          aria-label="Mapa interativo das unidades da federação do Brasil"
          role="group"
        >
          <g
            transform={
              "translate(" +
              (165 - 165 * zoom) +
              "," +
              (167 - 167 * zoom) +
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
                className={selected === r.id ? "is-selected" : ""}
                role={automatic ? "presentation" : "button"}
                aria-hidden={automatic || undefined}
                tabIndex={automatic ? -1 : 0}
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
        <span className="holo-map-coordinate">BR / MALHA SIMPLIFICADA</span>
      </div>
      {!automatic ? (
        <div className="holo-map-tools">
          <button
            aria-label="Aproximar mapa"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            +
          </button>
          <button
            aria-label="Afastar mapa"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            −
          </button>
          <button
            onClick={() => {
              setSelected(null);
              setZoom(1);
            }}
          >
            Restaurar
          </button>
        </div>
      ) : null}
      <p className="holo-map-selection" role="status">
        {region
          ? region.name
          : automatic
            ? "Brasil · unidades da federação"
            : "Selecione um estado ou o Distrito Federal"}
      </p>
      <p className="holo-caption">
        {automatic ? <HoloTypewriter text={m.caption} /> : m.caption}
      </p>
      <a href={geography.url} target="_blank" rel="noreferrer">
        Fonte: IBGE · malha simplificada ↗
      </a>
    </div>
  );
}

export default memo(HoloMap);
