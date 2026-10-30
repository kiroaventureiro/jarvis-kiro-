// Real production Next.js server, browser-mocked account/audio responses. No provider inference.
const cp = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const base = "http://localhost:3156";
const server = cp.spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "localhost", "-p", "3156"],
  { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(Error("Server readiness timeout: " + log)),
    30000,
  );
  const read = (data) => {
    log += data;
    if (log.includes("Ready in")) {
      clearTimeout(timer);
      resolve();
    }
  };
  server.stdout.on("data", read);
  server.stderr.on("data", read);
  server.once("error", reject);
  server.once("exit", (code) => {
    clearTimeout(timer);
    if (code) reject(Error("Server failed: " + log));
  });
});
(async () => {
  try {
    await ready;
    const result = await new Promise((resolve, reject) => {
      const child = cp.spawn(
        process.execPath,
        ["tests/browser/cosmic-smoke.cjs"],
        {
          cwd: root,
          windowsHide: true,
          stdio: "inherit",
          env: {
            ...process.env,
            TEST_BASE_URL: base,
            TEST_OUTPUT_DIR:
              process.env.TEST_OUTPUT_DIR || "work/cosmic-evidence",
          },
        },
      );
      child.on("error", reject);
      child.on("exit", resolve);
    });
    if (result !== 0) throw Error("Cosmic UI failed: " + result);
  } finally {
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
