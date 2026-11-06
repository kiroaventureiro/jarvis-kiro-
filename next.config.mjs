/** Include only the reviewed browser extension source in its private download route. */
const nextConfig = { outputFileTracingIncludes: { "/api/director/browser-extension": ["./extensions/jarvis-browser/*"] } };
export default nextConfig;
