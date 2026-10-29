import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const urls = new Map();
async function urlFor(file) {
  if (urls.has(file)) return urls.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const match of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)]) {
    const url = await urlFor(
      path.resolve(path.dirname(file), match[2] + ".ts"),
    );
    code = code.replace(match[0], "from " + JSON.stringify(url));
  }
  const url =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  urls.set(file, url);
  return url;
}
const load = async (name) =>
  import(await urlFor(path.resolve("lib/voice/" + name + ".ts")));
const { VoiceController } = await load("voice-controller");
const { parseWake, localVoiceReply } = await load("wake-word-policy");
const prefs = await load("voice-preferences");
const { BrowserSpeechOutput } = await load("speech-output");
const { costPermission, ProviderCallBudget } = await load("cost-policy");
const { processAbacusRequest } = await load("abacus-gateway");
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function setup({
  continuous = true,
  muted = false,
  command,
  recognition = true,
} = {}) {
  let now = 0,
    id = 0;
  const timers = new Map(),
    instances = [],
    states = [],
    users = [],
    replies = [],
    speeches = [],
    calls = [],
    unavailable = [];
  let resolveSpeech = null;
  class Rec {
    start() {
      this.started = true;
      this.onstart?.();
    }
    abort() {
      this.started = false;
    }
    stop() {
      this.started = false;
    }
    emit(text) {
      this.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text } }],
      });
    }
    constructor() {
      instances.push(this);
    }
  }
  const speech = {
    cancel() {},
    speak(text, signal) {
      speeches.push(text);
      return new Promise((resolve, reject) => {
        resolveSpeech = resolve;
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    },
  };
  const engine = new VoiceController({
    recognition: recognition ? Rec : null,
    speech,
    continuous: () => continuous,
    muted: () => muted,
    command: async (text, signal) => {
      calls.push(text);
      return command
        ? command(text, signal)
        : { text: "Resposta da Abacus", provider: "abacus" };
    },
    onUser: (x) => users.push(x),
    onReply: (x) => replies.push(x),
    onSpeechUnavailable: () => unavailable.push(true),
    onState: (x) => states.push(x),
    now: () => now,
    delay: (fn, ms) => {
      const key = ++id;
      timers.set(key, { fn, at: now + ms });
      return key;
    },
    clear: (key) => timers.delete(key),
  });
  return {
    engine,
    instances,
    states,
    users,
    replies,
    speeches,
    calls,
    unavailable,
    finish: async () => {
      resolveSpeech?.();
      await flush();
    },
    advance: async (ms) => {
      const end = now + ms;
      let steps = 0;
      while (true) {
        const next = [...timers]
          .filter(([, v]) => v.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        if (++steps > 100) throw Error("unbounded restart");
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await flush();
      }
      now = end;
    },
  };
}
test("wake policy recognizes Jarvis, greetings and commands only after activation", () => {
  for (const phrase of [
    "Jarvis",
    "Bom dia, Jarvis",
    "Boa noite, Jarvis",
    "Ei, Jarvis",
    "Jarvis, preciso de ajuda",
  ])
    assert.ok(parseWake(phrase, false).accepted);
  assert.equal(parseWake("conversa sem ativação", false).accepted, false);
  assert.equal(parseWake("próximo comando", true).accepted, true);
  assert.equal(
    parseWake("Jarvis, abra meus projetos", false).command,
    "abra meus projetos",
  );
  assert.equal(localVoiceReply("abra meus projetos").navigate, "/projetos");
});
test("greeting is local, spoken and recognition pauses until speech ends", async () => {
  const t = setup();
  t.engine.start();
  assert.equal(t.states.at(-1).phase, "waiting");
  t.instances[0].emit("Bom dia, Jarvis");
  await flush();
  assert.equal(t.calls.length, 0);
  assert.match(t.speeches[0], /Bom dia! Estou à disposição/);
  assert.equal(t.states.at(-1).phase, "speaking");
  assert.equal(t.instances[0].started, false);
  t.instances[0].emit("Jarvis responda a você mesmo");
  assert.equal(t.users.length, 1);
  await t.advance(2000);
  assert.equal(t.instances.length, 1);
  await t.finish();
  await t.advance(450);
  assert.equal(t.instances.length, 2);
  assert.equal(t.states.at(-1).phase, "command");
  t.engine.stop();
});
test("bare wake asks for next command and no repeated mic clicks are needed", async () => {
  const t = setup();
  t.engine.start();
  t.instances[0].emit("Jarvis");
  await flush();
  assert.match(t.speeches[0], /O que você precisa/);
  await t.finish();
  await t.advance(450);
  t.instances[1].emit("Preciso de ideias para o canal");
  await flush();
  assert.deepEqual(t.calls, ["Preciso de ideias para o canal"]);
  await t.finish();
  await t.advance(450);
  assert.equal(t.states.at(-1).enabled, true);
  t.engine.stop();
});
test("duplicate activation and stale results cannot create concurrent calls", async () => {
  const t = setup();
  t.engine.start();
  t.instances[0].emit("Jarvis");
  await flush();
  t.instances[0].emit("Jarvis");
  assert.equal(t.replies.length, 1);
  await t.finish();
  await t.advance(450);
  t.instances[1].emit("Jarvis");
  await flush();
  assert.equal(t.replies.length, 1);
  t.engine.stop();
});
test("off aborts processing immediately and late answers are discarded", async () => {
  let complete;
  const t = setup({
    command: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  t.engine.start();
  t.instances[0].emit("Jarvis, preciso de ajuda");
  await flush();
  t.engine.stop();
  complete({ text: "Resposta tardia" });
  await flush();
  await t.advance(10000);
  assert.equal(t.states.at(-1).phase, "off");
  assert.equal(t.replies.length, 0);
  assert.equal(t.instances.length, 1);
});
test("permission denial never restarts and unsupported browser remains off", async () => {
  const t = setup();
  t.engine.start();
  t.instances[0].onerror({ error: "not-allowed" });
  await t.advance(120000);
  assert.equal(t.instances.length, 1);
  assert.equal(t.states.at(-1).enabled, false);
  assert.equal(t.states.at(-1).phase, "error");
  const u = setup({ recognition: false });
  u.engine.start();
  assert.equal(u.states.at(-1).phase, "error");
  assert.equal(u.instances.length, 0);
});
test("temporary errors have bounded retries, single-shot mode does not loop", async () => {
  const t = setup();
  t.engine.start();
  for (let i = 0; i < 4; i++) {
    t.instances.at(-1).onerror({ error: "network" });
    await t.advance(3500);
  }
  assert.equal(t.instances.length, 4);
  assert.equal(t.states.at(-1).enabled, false);
  const u = setup({ continuous: false });
  u.engine.start();
  u.instances[0].onend();
  await u.advance(60000);
  assert.equal(u.instances.length, 1);
  assert.equal(u.states.at(-1).phase, "off");
});
test("provider failure stops continuous mode without repeating external requests", async () => {
  const t = setup({
    command: async () => {
      throw Error("Abacus indisponível");
    },
  });
  t.engine.start();
  t.instances[0].emit("Jarvis, me ajude");
  await flush();
  await t.advance(120000);
  assert.equal(t.calls.length, 1);
  assert.equal(t.states.at(-1).phase, "error");
  assert.equal(t.states.at(-1).enabled, false);
});
test("manual mode answers once and returns fully off", async () => {
  const t = setup({ continuous: false });
  t.engine.start();
  t.instances[0].emit("Jarvis");
  await flush();
  await t.finish();
  await t.advance(5000);
  assert.equal(t.instances.length, 1);
  assert.equal(t.states.at(-1).phase, "off");
});
test("voice selection never guesses gender from a name and preferences are bounded", () => {
  const voices = [
    {
      voiceURI: "ptpt",
      name: "Masculina",
      lang: "pt-PT",
      localService: true,
      default: true,
    },
    {
      voiceURI: "a",
      name: "Antonio",
      lang: "pt-BR",
      localService: false,
      default: true,
    },
    {
      voiceURI: "b",
      name: "Voz escolhida",
      lang: "pt-BR",
      localService: true,
      default: false,
    },
  ];
  assert.equal(
    prefs.selectVoice(voices, prefs.DEFAULT_VOICE_PREFERENCES).voiceURI,
    "b",
  );
  assert.equal(
    prefs.selectVoice(voices, {
      ...prefs.DEFAULT_VOICE_PREFERENCES,
      maleConfirmedURI: "a",
    }).voiceURI,
    "a",
  );
  assert.equal(
    prefs.selectVoice(voices, {
      ...prefs.DEFAULT_VOICE_PREFERENCES,
      voiceURI: "b",
    }).voiceURI,
    "b",
  );
  assert.equal(
    prefs.selectVoice([voices[0]], prefs.DEFAULT_VOICE_PREFERENCES),
    null,
  );
  const p = prefs.sanitizeVoicePreferences({
    rate: 999,
    pitch: -99,
    volume: NaN,
    token: "ignored",
  });
  assert.equal(p.rate, 1.3);
  assert.equal(p.pitch, 0.6);
  assert.equal(p.volume, 1);
  assert.ok(!("token" in p));
});
test("speech applies pt-BR, chosen voice and controls, then releases the queue", async () => {
  let utter;
  const voice = {
    voiceURI: "v",
    lang: "pt-BR",
    name: "Personalizada",
    localService: true,
    default: true,
  };
  const api = {
    getVoices: () => [voice],
    speak: (u) => {
      utter = u;
    },
    cancel() {},
  };
  const speech = new BrowserSpeechOutput(
    () => api,
    (text) => ({ text }),
    () => ({
      ...prefs.DEFAULT_VOICE_PREFERENCES,
      voiceURI: "v",
      rate: 0.9,
      pitch: 0.8,
      volume: 0.5,
    }),
  );
  const run = speech.speak("Bom dia", new AbortController().signal);
  assert.equal(utter.lang, "pt-BR");
  assert.equal(utter.voice, voice);
  assert.equal(utter.rate, 0.9);
  assert.equal(utter.pitch, 0.8);
  assert.equal(utter.volume, 0.5);
  utter.onend();
  await run;
});
test("speech cancellation and errors settle instead of hanging or auto-retrying", async () => {
  let utter;
  const api = {
    getVoices: () => [
      {
        voiceURI: "v",
        lang: "pt-BR",
        name: "Voz",
        localService: true,
        default: true,
      },
    ],
    speak: (u) => {
      utter = u;
    },
    cancel() {},
  };
  const speech = new BrowserSpeechOutput(
    () => api,
    (text) => ({ text }),
  );
  const abort = new AbortController();
  const run = speech.speak("Teste", abort.signal);
  abort.abort();
  await assert.rejects(run, { name: "AbortError" });
  const fail = speech.speak("Teste", new AbortController().signal);
  utter.onerror({ error: "not-allowed" });
  await assert.rejects(fail, /reprodução de voz falhou/);
});
test("paid providers are denied by default and limits count attempted calls", () => {
  assert.equal(costPermission("abacus", {}).allowed, false);
  assert.equal(
    costPermission("abacus", { JARVIS_ABACUS_PAID_ALLOWED: "true" }).allowed,
    false,
  );
  const permission = costPermission("abacus", {
    JARVIS_ABACUS_PAID_ALLOWED: "true",
    JARVIS_ABACUS_MAX_CALLS_PER_HOUR: "2",
  });
  const budget = new ProviderCallBudget();
  assert.equal(budget.admit("abacus", permission, 1).allowed, true);
  assert.equal(budget.admit("abacus", permission, 2).allowed, true);
  assert.equal(budget.admit("abacus", permission, 3).allowed, false);
  assert.equal(budget.stats("abacus", 3).calls, 2);
});
test("Abacus gateway never calls a paid API without explicit server authorization", async () => {
  let calls = 0;
  const handler = (request) =>
    processAbacusRequest(request, {
      configured: () => true,
      permission: () => ({ allowed: false, callsPerHour: 0 }),
      admit: () => ({ allowed: true, reason: "" }),
      reply: async () => {
        calls++;
        return { text: "x", model: "x", usage: null };
      },
    });
  const request = new Request("http://localhost/api/director/abacus", {
    method: "POST",
    body: JSON.stringify({ message: "Olá" }),
  });
  assert.equal((await handler(request)).status, 403);
  assert.equal(calls, 0);
});
test("Abacus gateway accepts authorized text, rejects over-budget and malformed input", async () => {
  const budget = new ProviderCallBudget(),
    permission = { allowed: true, callsPerHour: 1 };
  let calls = 0;
  const handler = (message) =>
    processAbacusRequest(
      new Request("http://localhost/api/director/abacus", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
      {
        configured: () => true,
        permission: () => permission,
        admit: (p) => budget.admit("abacus", p, 10),
        reply: async () => {
          calls++;
          return { text: "Resposta", model: "route-llm", usage: null };
        },
      },
    );
  assert.equal((await handler("Olá")).status, 200);
  assert.equal((await handler("Outra pergunta")).status, 429);
  assert.equal((await handler("x".repeat(1501))).status, 400);
  assert.equal(calls, 1);
});

test("speech waits for asynchronously loaded voices and cancellation prevents late output", async () => {
  const events = new EventTarget();
  let voices = [],
    utter = null;
  let calls = 0;
  const api = {
    getVoices: () => voices,
    speak: (u) => {
      utter = u;
      calls++;
    },
    cancel() {},
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
  };
  const speech = new BrowserSpeechOutput(
    () => api,
    (text) => ({ text }),
  );
  const run = speech.speak("Olá", new AbortController().signal);
  voices = [
    {
      voiceURI: "v",
      lang: "pt-BR",
      name: "Compatível",
      default: true,
      localService: true,
    },
  ];
  events.dispatchEvent(new Event("voiceschanged"));
  await flush();
  assert.equal(calls, 1);
  utter.onend();
  await run;
  voices = [];
  const cancelled = speech.speak(
    "Não reproduzir",
    new AbortController().signal,
  );
  speech.cancel();
  voices = [{ voiceURI: "v", lang: "pt-BR" }];
  events.dispatchEvent(new Event("voiceschanged"));
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(calls, 1);
});

test("muted voice explicitly requests text fallback", async () => {
  const t = setup({ muted: true });
  t.engine.start();
  t.instances[0].emit("Bom dia, Jarvis");
  await flush();
  assert.equal(t.unavailable.length, 1);
  assert.equal(t.speeches.length, 0);
  t.engine.stop();
});
test("stopping speech requests fallback once and cancelled work cannot repeat it", async () => {
  const t = setup();
  t.engine.start();
  t.instances[0].emit("Bom dia, Jarvis");
  await flush();
  t.engine.stop();
  await flush();
  assert.equal(t.unavailable.length, 1);
  assert.equal(t.states.at(-1).phase, "off");
});
