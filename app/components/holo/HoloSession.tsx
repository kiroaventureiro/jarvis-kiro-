"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { HoloScene, HoloLocalMedia } from "../../../lib/holo/types";
import { normalizeScene } from "../../../lib/holo/validation";
import { narrationCoordinator } from "../../../lib/holo/narration";
import type { ExportFormat } from "../../../lib/holo/conversation-actions";
type Session = {
  exportRequest: { id: string; sceneId: string; format: ExportFormat } | null;
  requestExport: (sceneId: string, format: ExportFormat) => void;
  media: HoloLocalMedia[];
  rememberMedia: (
    files: Array<{ id: string; label: string; file: File }>,
  ) => void;
  scenes: HoloScene[];
  current: HoloScene | null;
  present: (s: unknown) => void;
  select: (id: string) => void;
  close: () => void;
  clear: () => void;
};
const Context = createContext<Session | null>(null);
export function HoloSessionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{
    scenes: HoloScene[];
    selected: string | null;
  }>({ scenes: [], selected: null });
  const [exportRequest, setExportRequest] =
    useState<Session["exportRequest"]>(null);
  const requestExport = useCallback((sceneId: string, format: ExportFormat) => {
    narrationCoordinator.cancel();
    setValue((v) => ({
      ...v,
      selected: v.scenes.some((s) => s.id === sceneId) ? sceneId : null,
    }));
    setExportRequest({ id: crypto.randomUUID(), sceneId, format });
  }, []);
  const heldMedia = useRef(new Map<string, HoloLocalMedia>());
  const [media, setMedia] = useState<HoloLocalMedia[]>([]);
  const rememberMedia = useCallback(
    (files: Array<{ id: string; label: string; file: File }>) => {
      for (const f of files.slice(0, 8)) {
        if (!heldMedia.current.has(f.id) && f.file.type.startsWith("image/"))
          heldMedia.current.set(f.id, {
            id: f.id,
            label: f.label,
            url: URL.createObjectURL(f.file),
            type: "image",
          });
      }
      setMedia([...heldMedia.current.values()]);
    },
    [],
  );
  useEffect(
    () => () => {
      for (const m of heldMedia.current.values()) URL.revokeObjectURL(m.url);
      heldMedia.current.clear();
    },
    [],
  );
  useEffect(() => {
    const keep = new Set(
      value.scenes.flatMap((s) =>
        s.modules.flatMap((m) =>
          m.kind === "media"
            ? m.items.flatMap((i) => (i.localId ? [i.localId] : []))
            : [],
        ),
      ),
    );
    let changed = false;
    for (const [id, m] of heldMedia.current) {
      if (!keep.has(id)) {
        URL.revokeObjectURL(m.url);
        heldMedia.current.delete(id);
        changed = true;
      }
    }
    if (changed) setMedia([...heldMedia.current.values()]);
  }, [value.scenes]);
  const present = useCallback((raw: unknown) => {
    const scene = normalizeScene(raw);
    if (!scene) return;
    narrationCoordinator.cancel();
    setValue((v) => ({
      scenes: [scene, ...v.scenes.filter((x) => x.id !== scene.id)].slice(0, 6),
      selected: scene.id,
    }));
  }, []);
  const select = useCallback(
    (id: string) =>
      setValue((v) => ({
        ...v,
        selected: v.scenes.some((s) => s.id === id) ? id : null,
      })),
    [],
  );
  const close = useCallback(() => {
      narrationCoordinator.cancel();
      setValue((v) => ({ ...v, selected: null }));
    }, []),
    clear = useCallback(() => {
      narrationCoordinator.cancel();
      setValue({ scenes: [], selected: null });
    }, []);
  const context = useMemo(
    () => ({
      media,
      exportRequest,
      requestExport,
      rememberMedia,
      scenes: value.scenes,
      current: value.scenes.find((x) => x.id === value.selected) || null,
      present,
      select,
      close,
      clear,
    }),
    [
      value,
      present,
      select,
      close,
      clear,
      media,
      rememberMedia,
      exportRequest,
      requestExport,
    ],
  );
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useHoloSession() {
  const session = useContext(Context);
  if (!session) throw Error("HoloSessionProvider required");
  return session;
}
