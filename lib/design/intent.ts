import type { HoloScene } from "../holo/types";
export function designIntent(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(img-to-html|extract-ds|to-wireframe|wireframe|design system)\b/.test(
      n,
    ) ||
    (/\b(crie|criar|gere|gerar|desenvolva|desenvolver|transforme|recrie|extraia|extrair)\b/.test(
      n,
    ) &&
      /\b(interface|layout|html|site|tela|sistema de design)\b/.test(n))
  );
}
export function answerDesignRequest(message: string) {
  if (!designIntent(message)) return null;
  return {
    text: "Abra o Criador de interfaces. Posso transformar uma referência em estrutura e arquivos HTML/CSS, ou extrair fundamentos de HTML e CSS fornecidos. Você revisa a estrutura antes de gerar e pode baixar os arquivos. A análise de imagem pede autorização na própria tela.",
    model: "jk-design-studio",
    usage: null,
    provider: "local_operational" as const,
    visual: {
      version: 1,
      id: "design-" + crypto.randomUUID(),
      title: "Criador de interfaces",
      mode: "creative",
      createdAt: new Date().toISOString(),
      source: { kind: "operational", label: "Ferramenta nativa do JK" },
      modules: [
        {
          id: "workspace",
          kind: "report",
          title: "Imagem, estrutura e design system",
          summary: "",
          items: [
            {
              label: "Entregas",
              detail: "Prévia, HTML/CSS, estrutura e catálogo para download.",
            },
          ],
          href: "/criador",
        },
      ],
    } as HoloScene,
  };
}
