# Jarvis Kiro cloud n8n worker

This worker must run in a persistent cloud host (e.g. Railway worker service) and requires a separately hosted n8n server. It is not a Vercel serverless function.

## Required secrets
- `JARVIS_N8N_BRIDGE_SECRET`: server bridge secret from the **same Vercel environment**, 40+ characters. Never commit it.
- `N8N_API_KEY`: API token from hosted n8n.
- `N8N_BASE_URL`: HTTPS URL to hosted n8n, or private service URL inside the same Railway project.
- `JARVIS_WORKER_ENVIRONMENT`: `preproduction` (default) or `production`.
- `JARVIS_URL`: defaults to `https://jarvis-kiro-preproducao.vercel.app` for preproduction, or `https://jarvis-kiro.vercel.app` for production.
- `JARVIS_VERCEL_PROTECTION_BYPASS`: only when required by Vercel Deployment Protection.
- `JARVIS_ENABLE_PRODUCTION=true`: required **only** to enable the production worker, alongside a separate production bridge secret.

## Deploy on Railway
1. Connect Railway with user consent and create a project with persistent volume + an n8n Docker service. Restrict n8n admin by login, use Postgres and backups. Configure credentials in Railway secrets.
2. Add a *separate worker service* from this repository, with Dockerfile path `cloud/n8n-worker/Dockerfile`, root build context at repository root and no public inbound port.
3. Populate the required secrets in the **preproduction** worker. The worker provisions the n8n workflow using the n8n REST API and polls Jarvis every 15s.
4. Verify that the stable preview domain reports `protocolVersion:2` and `deploymentEnvironment:preview`, and that the n8n workflow runs.
5. Confirm a single owner-approved write from Jarvis by inspecting actual commit and draft PR. Only afterward shut down the local PowerShell worker; do not allow two workers to consume one shared queue unless proven safe.
6. Production requires a different worker and separate secrets. The worker exits unless `JARVIS_ENABLE_PRODUCTION=true`.

**Not yet deployed:** A Railway app connection and real hosted n8n service are required. Dockerfile / worker source alone do not provide cloud availability.

If the hosted worker is unavailable, the cloud bridge heartbeat times out and Jarvis should not promise a write. GitHub credentials are never copied to the n8n workflow.
