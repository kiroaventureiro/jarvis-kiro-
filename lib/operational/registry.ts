import {
  EVIDENCE_TTL,
  serviceStatus,
  type Configuration,
  type Evidence,
  type OperationalSnapshot,
  type ServiceId,
} from "./state";
type Options = {
  configurations: () => Configuration[];
  keyFor: (id: ServiceId) => string;
  probes: Partial<
    Record<
      ServiceId,
      (signal?: AbortSignal) => Promise<Omit<Evidence, "checkedAt">>
    >
  >;
  projects: Array<{ id: string; name: string }>;
  catalog: Array<{ id: string; name: string }>;
  environment: () => string;
  now?: () => number;
};
export class OperationalRegistry {
  private evidence = new Map<string, Evidence>();
  private pending = new Map<string, Promise<void>>();
  constructor(private options: Options) {}
  private now() {
    return (this.options.now || Date.now)();
  }
  record(
    id: ServiceId,
    ok: boolean,
    checks: string[] = [],
    failure?: Evidence["failure"],
  ) {
    const key = this.options.keyFor(id),
      old = this.evidence.get(key),
      now = this.now();
    this.evidence.set(key, {
      ok,
      checkedAt: now,
      checks: ok
        ? [
            ...new Set([
              ...(old?.ok && now - old.checkedAt < EVIDENCE_TTL
                ? old.checks
                : []),
              ...checks,
            ]),
          ]
        : [],
      ...(failure ? { failure } : {}),
    });
    if (this.evidence.size > 64)
      this.evidence.delete(this.evidence.keys().next().value!);
  }
  snapshot(): OperationalSnapshot {
    const configurations = this.options.configurations(),
      integrations = configurations.map((c) =>
        serviceStatus(
          c,
          this.evidence.get(this.options.keyFor(c.id)),
          this.now(),
        ),
      );
    const norm = (text: string) =>
      text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const match = (name: string, id: string) =>
      integrations.find((s) =>
        s.id === "abacus"
          ? /abacus|routellm/.test(norm(name + id))
          : s.id === "supabase-memory"
            ? /supabase/.test(norm(name + id))
            : s.id === "openai-voice"
              ? /openai/.test(norm(name + id))
              : s.id === "google"
                ? /gmail|google|gdrive|gcalendar/.test(norm(name + id))
                : s.id === "microsoft"
                  ? /microsoft|outlook|onedrive/.test(norm(name + id))
                  : norm(name) === norm(s.name) || norm(id) === norm(s.id),
      );
    const rows = this.options.catalog.map((item) => ({
      name: item.name,
      status: match(item.name, item.id),
    }));
    return {
      schemaVersion: 1,
      environment: this.options.environment(),
      generatedAt: new Date(this.now()).toISOString(),
      integrations,
      projects: this.options.projects.map((x) => ({ ...x })),
      catalog: {
        total: rows.length,
        notConfigured: rows.filter((x) => !x.status?.configured).length,
        needsValidation: rows.filter(
          (x) => x.status?.configured && !x.status?.verified,
        ).length,
        examples: rows
          .filter((x) => !x.status?.configured)
          .slice(0, 8)
          .map((x) => x.name),
      },
    };
  }
  async read(
    options: { verify?: boolean; ids?: ServiceId[]; signal?: AbortSignal } = {},
  ) {
    if (options.verify) {
      await Promise.all(
        this.options
          .configurations()
          .filter(
            (c) =>
              c.configured &&
              c.configurationValid &&
              this.options.probes[c.id] &&
              (!options.ids || options.ids.includes(c.id)),
          )
          .map(async (c) => {
            const key = this.options.keyFor(c.id),
              old = this.evidence.get(key);
            if (old && this.now() - old.checkedAt < EVIDENCE_TTL) return;
            let job = this.pending.get(key);
            if (!job) {
              job = (async () => {
                try {
                  const result = await this.options.probes[c.id]!(
                    options.signal,
                  );
                  if (options.signal?.aborted) return;
                  this.evidence.set(key, { ...result, checkedAt: this.now() });
                } catch {
                  if (!options.signal?.aborted)
                    this.evidence.set(key, {
                      ok: false,
                      checkedAt: this.now(),
                      checks: [],
                      failure: "network",
                    });
                } finally {
                  this.pending.delete(key);
                }
              })();
              this.pending.set(key, job);
            }
            await job;
          }),
      );
    }
    if (options.signal?.aborted)
      throw new DOMException("Cancelled", "AbortError");
    return this.snapshot();
  }
}
