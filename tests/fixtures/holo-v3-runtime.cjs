// Explicit loopback-only fixture. Never imported by application code.
const nativeFetch = globalThis.fetch;
require("./connectors-runtime.cjs");
const priorFetch = globalThis.fetch;
const fixturePage = {
  title: "File:Rio de Janeiro fixture.jpg",
  imageinfo: [
    {
      thumburl:
        "https://upload.wikimedia.org/wikipedia/commons/a/ab/Rio_fixture.jpg",
      extmetadata: {
        Artist: { value: "Autor simulado para teste" },
        LicenseShortName: { value: "CC BY-SA 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
        ImageDescription: {
          value:
            "Photograph. Fixture only; not an actual public research result.",
        },
      },
    },
  ],
};
globalThis.fetch = async (input, options = {}) => {
  const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    u = new URL(raw);
  if (
    [
      "commons.wikimedia.org",
      "upload.wikimedia.org",
      "thumb.wikimedia.org",
    ].includes(u.hostname)
  ) {
    if (process.env.JARVIS_IMAGES_PUBLIC_NETWORK === "1")
      return nativeFetch(input, options);
    if (u.hostname === "commons.wikimedia.org" && u.pathname === "/w/api.php")
      return Response.json({ query: { pages: [fixturePage] } });
    if (options.method === "HEAD")
      return new Response(null, { headers: { "content-type": "image/jpeg" } });
    throw Error("Unexpected image fixture operation");
  }
  return priorFetch(input, options);
};
