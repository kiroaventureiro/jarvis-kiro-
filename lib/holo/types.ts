export type HoloSource = {
  kind: "assistant" | "reference" | "connector" | "operational" | "attachment";
  label: string;
  href?: string;
  checkedAt?: string;
};
export type HoloPoint = { label: string; detail: string };
type Base = { id: string; title: string };
export type HoloModule =
  | (Base & { kind: "text"; text: string; tags: string[] })
  | (Base & { kind: "map"; region: "BR"; caption: string })
  | (Base & {
      kind: "timeline";
      events: Array<{
        when: string;
        label: string;
        detail: string;
        href?: string;
      }>;
    })
  | (Base & {
      kind: "report";
      summary: string;
      items: HoloPoint[];
      body?: string;
      href?: string;
    })
  | (Base & {
      kind: "media";
      items: Array<{
        id: string;
        label: string;
        type: "image" | "video";
        url?: string;
        localId?: string;
        caption?: string;
      }>;
    })
  | (Base & {
      kind: "compare";
      columns: Array<{ label: string; points: string[] }>;
    })
  | (Base & {
      kind: "metrics";
      unit: string;
      style: "bars" | "line" | "radar" | "rings";
      values: Array<{ label: string; value: number }>;
    })
  | (Base & {
      kind: "connections";
      items: Array<{
        id: string;
        label: string;
        state:
          | "not_configured"
          | "credentials_configured"
          | "connection_validated"
          | "operational_authorized"
          | "temporarily_unavailable"
          | "not_consulted";
        checkedAt?: string;
        detail: string;
      }>;
    });
export type HoloScene = {
  version: 1;
  id: string;
  title: string;
  mode: "explanation" | "technical" | "creative" | "analysis";
  createdAt: string;
  source: HoloSource;
  modules: HoloModule[];
};
export type HoloLocalMedia = {
  id: string;
  label: string;
  url: string;
  type: "image" | "video";
};
