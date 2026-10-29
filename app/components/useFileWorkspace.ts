"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachmentType,
  fileProblem,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_AUDIO_BYTES,
} from "../../lib/attachment-policy";
export type LocalAttachment = { id: string; file: File; preview?: string };
export type FilePhase =
  | "idle"
  | "sending"
  | "transcribing"
  | "analyzing"
  | "responding"
  | "done"
  | "error";
type Callbacks = {
  stopVoice: () => void;
  onUser: (id: string, text: string) => void;
  onDelta: (id: string, text: string) => void;
  onComplete: (id: string, text: string) => void;
  onState: (
    state: "idle" | "listening" | "processing" | "responding" | "error",
  ) => void;
  history: () => { role: string; text: string }[];
};
export function useFileWorkspace(callbacks: Callbacks) {
  const [files, setFiles] = useState<LocalAttachment[]>([]),
    [phase, setPhase] = useState<FilePhase>("idle"),
    [notice, setNotice] = useState(""),
    [recording, setRecording] = useState(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const filesRef = useRef<LocalAttachment[]>([]),
    controller = useRef<AbortController | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recordStream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    version = useRef(0),
    alive = useRef(true),
    working = useRef(false),
    recordVersion = useRef(0);
  const setQueue = useCallback((queue: LocalAttachment[]) => {
    filesRef.current = queue;
    setFiles(queue);
  }, []);
  const cancel = useCallback(() => {
    version.current++;
    controller.current?.abort();
    controller.current = null;
    working.current = false;
    setPhase("idle");
    callbacksRef.current.onState("idle");
    setNotice(
      "Análise interrompida. Os anexos continuam disponíveis para tentar novamente.",
    );
  }, []);
  const releaseRecording = useCallback(() => {
    recordVersion.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    recordStream.current?.getTracks().forEach((t) => t.stop());
    recordStream.current = null;
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      version.current++;
      controller.current?.abort();
      releaseRecording();
      filesRef.current.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
    };
  }, [releaseRecording]);
  const ingest = useCallback(
    (incoming: File[]) => {
      if (working.current || recorder.current) {
        setNotice(
          "Aguarde a análise ou a gravação terminar antes de adicionar arquivos.",
        );
        return;
      }
      const queue = [...filesRef.current];
      const rejected: string[] = [];
      for (const file of incoming) {
        const error = fileProblem(file);
        if (error) {
          rejected.push(file.name + ": " + error);
          continue;
        }
        if (
          queue.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.file.lastModified === file.lastModified,
          )
        )
          continue;
        if (queue.length >= MAX_ATTACHMENTS) {
          rejected.push(file.name + ": máximo de 8 anexos por análise.");
          continue;
        }
        if (
          queue.reduce((n, item) => n + item.file.size, 0) + file.size >
          MAX_ATTACHMENT_BYTES
        ) {
          rejected.push(file.name + ": o total de anexos excede 3 MB.");
          continue;
        }
        queue.push({
          id: crypto.randomUUID(),
          file,
          preview:
            attachmentType(file.name)?.kind === "image"
              ? URL.createObjectURL(file)
              : undefined,
        });
      }
      setQueue(queue);
      setPhase("idle");
      setNotice(
        rejected.length
          ? rejected.slice(0, 4).join(" ")
          : queue.length
            ? "Arquivos preparados. Escreva ou grave o que deseja fazer com eles."
            : "Nenhum arquivo compatível recebido.",
      );
    },
    [setQueue],
  );
  const remove = useCallback(
    (id: string) => {
      if (working.current || recorder.current) return;
      const item = filesRef.current.find((item) => item.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      setQueue(filesRef.current.filter((item) => item.id !== id));
      setPhase("idle");
      setNotice("");
    },
    [setQueue],
  );
  const analyze = useCallback(async (instruction: string, voice?: File) => {
    if (
      working.current ||
      !filesRef.current.length ||
      (!instruction.trim() && !voice)
    )
      return false;
    working.current = true;
    const request = ++version.current;
    const abort = new AbortController();
    controller.current = abort;
    const id = "analysis-" + crypto.randomUUID();
    let answer = "",
      done = false;
    callbacksRef.current.stopVoice();
    callbacksRef.current.onState("processing");
    setPhase("sending");
    setNotice("");
    if (instruction.trim())
      callbacksRef.current.onUser(
        id + "-user",
        instruction.trim() +
          "\nAnexos: " +
          filesRef.current.map((item) => item.file.name).join(", "),
      );
    try {
      const form = new FormData();
      filesRef.current.forEach((item) => form.append("files", item.file));
      form.set("instruction", instruction);
      form.set(
        "history",
        JSON.stringify(
          callbacksRef.current
            .history()
            .slice(-8)
            .map((item) => ({ ...item, text: item.text.slice(0, 4000) })),
        ),
      );
      if (voice) form.set("audio", voice);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível enviar os arquivos.");
      }
      if (!response.body) throw new Error("Não foi possível abrir a análise.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let pending = "";
      const consume = (line: string) => {
        if (request !== version.current || !alive.current) return;
        const event = JSON.parse(line);
        if (event.type === "stage") {
          setPhase(
            event.stage === "transcribing" ? "transcribing" : "analyzing",
          );
          callbacksRef.current.onState("processing");
        }
        if (event.type === "transcript") {
          callbacksRef.current.onUser(
            id + "-voice",
            event.text +
              "\nAnexos: " +
              filesRef.current.map((item) => item.file.name).join(", "),
          );
        }
        if (event.type === "delta") {
          answer += event.text;
          setPhase("responding");
          callbacksRef.current.onState("responding");
          callbacksRef.current.onDelta(id, event.text);
        }
        if (event.type === "error")
          throw new Error(event.message || "A análise falhou.");
        if (event.type === "done") {
          done = true;
          answer = event.text;
          callbacksRef.current.onComplete(id, answer);
          setPhase("done");
          callbacksRef.current.onState("idle");
        }
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          pending += decoder.decode(chunk.value, { stream: true });
          let index;
          while ((index = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, index);
            pending = pending.slice(index + 1);
            if (line.trim()) consume(line);
          }
          if (pending.length > 1024 * 1024)
            throw new Error("Resposta inválida.");
        }
        pending += decoder.decode();
        if (pending.trim()) consume(pending);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (request !== version.current) return false;
      if (!done)
        throw new Error("A conexão terminou antes de concluir a análise.");
      return true;
    } catch (error) {
      if (request === version.current && alive.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a análise.";
        setPhase("error");
        setNotice(message);
        callbacksRef.current.onState("error");
        if (answer)
          callbacksRef.current.onDelta(
            id,
            "\n\n[Análise interrompida; resposta parcial.]",
          );
      }
      return false;
    } finally {
      if (request === version.current) {
        working.current = false;
        controller.current = null;
      }
    }
  }, []);
  const voiceInstruction = useCallback(async () => {
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    if (working.current || !filesRef.current.length) return;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setNotice(
        "Este navegador não permite gravar a orientação. Use o campo de texto.",
      );
      return;
    }
    callbacksRef.current.stopVoice();
    const recordingAttempt = ++recordVersion.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || recordingAttempt !== recordVersion.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recordStream.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      if (!mime)
        throw new Error("Gravação indisponível neste navegador. Use o texto.");
      const recording = new MediaRecorder(stream, { mimeType: mime });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0,
        oversized = false;
      recording.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          size += e.data.size;
          if (size > MAX_AUDIO_BYTES && recording.state === "recording") {
            oversized = true;
            recording.stop();
          }
        }
      };
      recording.onerror = () => {
        releaseRecording();
        setRecording(false);
        callbacksRef.current.onState("idle");
        setNotice("A gravação falhou. Use o campo de texto.");
      };
      recording.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        stream.getTracks().forEach((t) => t.stop());
        recordStream.current = null;
        recorder.current = null;
        if (!alive.current || recordingAttempt !== recordVersion.current)
          return;
        setRecording(false);
        callbacksRef.current.onState("idle");
        if (oversized || size > MAX_AUDIO_BYTES) {
          setNotice(
            "A gravação excedeu 512 KB. Grave uma orientação mais curta.",
          );
          return;
        }
        if (size === 0) {
          setNotice(
            "Nenhum áudio foi capturado. Tente novamente ou use texto.",
          );
          return;
        }
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        void analyze(
          "",
          new File(chunks, "orientacao." + ext, { type: mime.split(";")[0] }),
        );
      };
      recording.start(1000);
      setRecording(true);
      callbacksRef.current.onState("listening");
      setNotice(
        "Gravando orientação. Toque novamente no microfone para analisar. Limite: 45 segundos.",
      );
      timer.current = setTimeout(() => {
        if (recording.state === "recording") recording.stop();
      }, 45000);
    } catch (error) {
      releaseRecording();
      if (alive.current) {
        setRecording(false);
        callbacksRef.current.onState("idle");
        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível acessar o microfone.",
        );
      }
    }
  }, [analyze, releaseRecording]);
  return {
    files,
    phase,
    notice,
    recording,
    busy: ["sending", "transcribing", "analyzing", "responding"].includes(
      phase,
    ),
    ingest,
    remove,
    analyze,
    cancel,
    voiceInstruction,
  };
}
