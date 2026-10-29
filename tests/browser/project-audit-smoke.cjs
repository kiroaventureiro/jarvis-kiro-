const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3147';
const out = process.env.TEST_OUTPUT_DIR || '/tmp/jarvis-project-audit';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local audit only');
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const api = await browser.newContext();
    for (const path of ['/api/github', '/api/director', '/api/director/connectors', '/api/director/connections', '/api/director/operational-status', '/api/director/capabilities', '/api/director/task-history', '/api/director/workspace-connectors', '/api/director/workspace-read?provider=google&resource=files']) {
      const response = await api.request.get(base + path);
      assert.equal(response.status(), 401, path);
    }
    for (const path of ['/api/voice', '/api/analyze', '/api/director/abacus', '/api/director/connectors', '/api/director/workspace-connectors', '/api/director/codex/dispatch']) {
      const response = await api.request.post(base + path, { data: {} });
      assert.equal(response.status(), 401, path);
    }
    await api.close();
    console.log('PASS 15 unauthenticated API requests rejected; no provider called');
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const path of ['/', '/conexoes', '/configuracoes', '/integracoes', '/resultados', '/projetos', '/memoria', '/diagnostico', '/controle', '/criador']) {
        const response = await page.goto(base + path);
        assert.equal(response.status(), 200, path);
        await page.locator('main').waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path + ' overflow ' + width);
        if (path === '/') {
          assert.equal(await page.locator('.jk-monogram').count(), 0);
          assert.equal(await page.locator('.jarvis-glass-shards polygon').count(), 14);
          await page.screenshot({ path: `${out}/jarvis-${width}.png`, animations: 'disabled' });
        }
      }
      assert.deepEqual(errors, [], 'browser runtime errors');
      console.log(`PASS 10 pages at ${width}px; no horizontal overflow or runtime exceptions`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
