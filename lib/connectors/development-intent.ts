export const JK_DEVELOPMENT_TARGET = {
  id: "jarvis-kiro",
  name: "Jarvis Kiro · desenvolvimento supervisionado",
};
export function developmentIntent(text: string) {
  const n = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
  // Addressing the assistant is not a request to modify the assistant itself.
  const target = n.replace(/^(?:oi[,\s]+)?jarvis(?:\s*[,!:]\s*|\s+)/, "");
  if (
    !/\b(melhore|melhora|encontre|diagnostique|verifique|proponha|corrija|corrige|conserte|conserta|ajuste|ajusta|implemente|implementa|desenvolva|desenvolve|crie|cria|analise)\b/.test(
      n,
    ) ||
    !/\b(sua|seu|jarvis|jk)\b/.test(target)
  )
    return null;
  const area = /voz|audio|fala|narracao/.test(n)
    ? "voice"
    : /mapa|geogra/.test(n)
      ? "map"
      : "presentation";
  return {
    project: JK_DEVELOPMENT_TARGET.id,
    area,
    paths:
      area === "voice"
        ? [
            "lib/voice/speech-output.ts",
            "lib/holo/narration.ts",
            "app/components/WakeListener.tsx",
          ]
        : area === "map"
          ? [
              "app/components/holo/HoloMap.tsx",
              "app/components/holo/HoloWorldMap.tsx",
              "lib/holo/geographic-focus.ts",
            ]
          : [
              "app/components/holo/CinematicPresentation.tsx",
              "app/components/holo/useDemonstration.ts",
              "lib/holo/director.ts",
            ],
  };
}
