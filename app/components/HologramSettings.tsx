"use client";
import { useEffect, useState } from "react";
import {
  readGraphicsPreference,
  setGraphicsPreference,
  type GraphicsPreference,
} from "../../lib/hologram/policy";
export default function HologramSettings() {
  const [preference, setPreference] = useState<GraphicsPreference>("auto");
  useEffect(() => setPreference(readGraphicsPreference()), []);
  return (
    <div className="graphics-settings">
      <label htmlFor="graphics-quality">Qualidade do holograma JK</label>
      <select
        id="graphics-quality"
        value={preference}
        onChange={(e) => {
          const value = e.target.value === "eco" ? "eco" : "auto";
          setPreference(value);
          setGraphicsPreference(value);
        }}
      >
        <option value="auto">Automática — adapta ao dispositivo</option>
        <option value="eco">
          Econômica — menos partículas e resolução menor
        </option>
      </select>
      <p>
        Preferência salva neste dispositivo. Movimento reduzido do sistema é
        respeitado; animações pausam com a página oculta. Sem WebGL, o núcleo
        usa uma versão vetorial.
      </p>
    </div>
  );
}
