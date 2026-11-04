// End-to-end checks in a real browser. Run with: npm run e2e
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, launch, openApp, OVERPASS } from './helpers.mjs';

let srv;
before(async () => { srv = await serve(); });
after(async () => { await srv.close(); });

test('app boots, map handle is exposed, every module announces its version, no page errors', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    const v = await p.evaluate(() => ({ enh: window.__arahEnh, pwa: window.__arahPWA, places: window.__arahPlaces, festive: window.__arahFestive, awake: window.__arahKeepAwake, ar: window.__arahAR }));
    for (const [k, x] of Object.entries(v)) assert.match(String(x), /^\d+\.\d+\.\d+$/, k);
    assert.deepEqual(p.errors, []);
  } finally { await b.close(); }
});

test('PWA: installable, precached, and the whole app reloads with no network', async () => {
  const b = await launch({ serviceWorkers: 'allow' }); const p = await b.page();
  try {
    await p.goto(srv.url + '/?source=pwa', { waitUntil: 'load' });
    await p.evaluate(() => { window.__noReload = 1; });
    await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    assert.equal(await p.evaluate(() => window.__noReload), 1, 'first install must not reload the page');
    const caches = await p.evaluate(() => caches.keys());
    assert.ok(caches.some((k) => k.startsWith('arah-pwa-core-')));
    const cdp = await b.ctx.newCDPSession(p);
    const inst = await cdp.send('Page.getInstallabilityErrors'); assert.deepEqual(inst.installabilityErrors, []);
    const man = await cdp.send('Page.getAppManifest'); assert.deepEqual(man.errors, []);
    await b.ctx.setOffline(true);
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 30000 });
    assert.match(await p.title(), /ARAH/);
    await b.ctx.setOffline(false);
  } finally { await b.close(); }
});

test('PWA install prompts: iPhone shows the Add-to-Home-Screen guide', async () => {
  const { devices } = await import('playwright');
  const { chromium } = await import('playwright');
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await br.newContext({ ...devices['iPhone 14'], serviceWorkers: 'block' }); const p = await ctx.newPage();
    await ctx.route('**/*', (r) => { const u = r.request().url(); if (/localhost/.test(u)) return r.continue(); if (/maplibre-gl.*\.js$/.test(u)) return r.fulfill({ path: 'node_modules/maplibre-gl/dist/maplibre-gl.js', contentType: 'application/javascript' }); if (/maplibre-gl.*\.css$/.test(u)) return r.fulfill({ path: 'node_modules/maplibre-gl/dist/maplibre-gl.css', contentType: 'text/css' }); return r.abort(); });
    await p.goto(srv.url + '/index.html'); await p.waitForSelector('.arah-pwa-pill', { state: 'visible', timeout: 30000 });
    await p.click('.arah-pwa-pill'); await p.waitForSelector('.arah-pwa-dlg');
    assert.match(await p.innerText('.arah-pwa-dlg'), /Add to Home Screen/);
    await p.keyboard.press('Escape'); assert.equal(await p.locator('.arah-pwa-dlg').count(), 0);
  } finally { await br.close(); }
});

test('Makan & Mall: brand sheet, live results as plain text, marker on the map', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.click('.ap-btn'); await p.waitForSelector('.ap-sheet');
    assert.ok((await p.locator('.ap-chip').count()) >= 40);
    await p.locator('.ap-tab').nth(1).click(); await p.fill('.ap-q', 'suria'); assert.equal(await p.locator('.ap-chip').count(), 2);
    await p.fill('.ap-q', ''); await p.locator('.ap-tab').nth(0).click();
    await p.locator('.ap-chip', { hasText: 'KFC' }).first().click();
    await p.waitForSelector('.ap-row');
    assert.equal(await p.locator('.ap-row').count(), OVERPASS.elements.length);
    assert.equal(await p.locator('.ap-row b b').count(), 0, 'outlet names must never become markup');
    assert.ok(b.seen.overpass.some((q) => q.includes('"KFC|Kentucky Fried"') && !/\\/.test(q.split('~"')[2] || '')));
    await p.locator('.ap-row').first().click();
    await p.waitForSelector('.ap-mk');
    assert.equal(await p.locator('.ap-mk').count(), 1);
  } finally { await b.close(); }
});

test('Festive: Deepavali by date, manual pick, off, and calm during a trip', async () => {
  const b = await launch({ init: "Date.now = (() => { const t = new Date('2026-11-03T04:00:00Z').getTime(); const O = Date; globalThis.Date = class extends O { constructor(...a) { a.length ? super(...a) : super(t); } static now() { return t; } }; return () => t; })();" });
  const p = await b.page();
  try {
    await openApp(p, srv.url);
    assert.equal(await p.evaluate(() => window.__arahFestiveApi.current()), 'deepavali');
    await p.click('.af-btn'); await p.waitForSelector('.af-sheet');
    await p.locator('.af-row', { hasText: 'Hari Merdeka' }).click();
    assert.equal(await p.evaluate(() => window.__arahFestiveApi.current()), 'merdeka');
    await p.locator('.af-row', { hasText: 'Mati' }).click();
    assert.equal(await p.evaluate(() => document.documentElement.hasAttribute('data-festive')), false);
    await p.locator('.af-row', { hasText: 'Auto' }).first().click(); await p.keyboard.press('Escape');
    await p.evaluate(() => { const x = document.createElement('button'); x.textContent = 'Tamat'; document.body.appendChild(x); });
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.af-cv')).display === 'none', null, { timeout: 8000 });
    assert.deepEqual(p.errors, []);
  } finally { await b.close(); }
});

test('Keep-awake: holds the screen (lock or silent video) and the off switch releases it', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.waitForFunction(() => { const s = window.__arahAwake.status(); return s.locked || s.video; }, null, { timeout: 10000 });
    await p.evaluate(() => window.__arahAwake.set(false));
    const s = await p.evaluate(() => window.__arahAwake.status());
    assert.equal(s.enabled, false); assert.equal(s.locked, false); assert.equal(s.video, false);
  } finally { await b.close(); }
});

test('AR: refuses a software GPU with a clear message (no silent CPU inference)', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.evaluate(() => { localStorage.setItem('arah.ar.ack.v1', '1'); window.__arahARApi.start(false); });
    await p.waitForFunction(() => /GPU/.test(window.__arahARApi.state.err || ''), null, { timeout: 60000 });
    assert.equal(await p.evaluate(() => window.__arahARApi.state.on), false);
  } finally { await b.close(); }
});

test('Supply chain: nothing is fetched from a script/style CDN at runtime; the map library is the bundled one', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url); await p.waitForTimeout(2000);
    const cdn = b.seen.external.filter((u) => /unpkg\.com|jsdelivr|cdnjs/.test(u));
    assert.deepEqual(cdn, [], 'the CSP no longer allows CDNs, so nothing may ask for one');
    const v = await p.evaluate(() => window.maplibregl.getVersion());
    assert.match(v, /^5\.\d+\.\d+$/, 'bundled MapLibre line; update this and the sanitizer note in SECURITY.md when upgrading');
  } finally { await b.close(); }
});

test('Resilience: Overpass down -> mirror answers; Photon down -> Nominatim answers; the app keeps working', async () => {
  const hits = new Set();
  const b = await launch({ route: async (u, r) => {
    const host = new URL(u).hostname; if (!/overpass|photon|nominatim/.test(host)) return false; hits.add(host);
    if (host === 'overpass-api.de' || host === 'photon.komoot.io') { await r.fulfill({ status: host.startsWith('photon') ? 500 : 503, contentType: 'text/html', body: 'down' }); return true; }
    if (host === 'overpass.kumi.systems') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OVERPASS) }); return true; }
    if (host === 'nominatim.openstreetmap.org') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ lat: '3.1579', lon: '101.7116', name: 'Zzyzx Fallback Tower', type: 'building', display_name: 'Zzyzx Fallback Tower, KL', address: { road: 'Jalan Test', city: 'Kuala Lumpur' } }]) }); return true; }
    return false;
  } });
  const p = await b.page();
  try {
    await openApp(p, srv.url);
    assert.match(await p.evaluate(() => window.__arahNet.version), /^\d+\.\d+\.\d+$/);
    await p.click('.ap-btn'); await p.waitForSelector('.ap-sheet');
    await p.locator('.ap-chip', { hasText: 'KFC' }).first().click(); await p.waitForSelector('.ap-row', { timeout: 20000 });
    assert.equal(await p.locator('.ap-row').count(), OVERPASS.elements.length);
    assert.ok(hits.has('overpass.kumi.systems'));
    await p.keyboard.press('Escape'); if (await p.locator('.ap-sheet').count()) await p.locator('.ap-scrim').click({ force: true }).catch(() => {});
    const box = p.getByPlaceholder(/Cari tempat/); await box.fill('zzyzx tower');
    await p.getByText('Zzyzx Fallback Tower').first().waitFor({ timeout: 15000 });
    assert.ok(hits.has('nominatim.openstreetmap.org'));
    const st = await p.evaluate(() => window.__arahNet.status()); assert.ok(st.fallbacks >= 2);
    assert.deepEqual(p.errors, []);
  } finally { await b.close(); }
});

const DSN = 'https://0123456789abcdef0123456789abcdef@o123.ingest.us.sentry.io/456';
const sentryRoutes = (sent) => async (u, r) => {
  if (u.endsWith('/assets/observability/config.json')) { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dsn: DSN }) }); return true; }
  if (new URL(u).hostname.endsWith('.ingest.us.sentry.io')) { sent.push({ url: u, body: r.request().postData() || '' }); await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return true; }
  return false;
};

test('Crash reports: inactive without a DSN (no card, no Sentry code)', async () => {
  const b = await launch({ route: async (u, r) => { if (!u.endsWith('/assets/observability/config.json')) return false; await r.fulfill({ status: 200, contentType: 'application/json', body: '{"dsn":""}' }); return true; } }); const p = await b.page();
  try {
    await openApp(p, srv.url);
    const st = await p.evaluate(() => window.__arahObserve.status());
    assert.equal(st.configured, false); assert.equal(await p.locator('.ao-card').count(), 0);
    assert.equal(await p.evaluate(() => typeof window.__arahSentryLib), 'undefined');
  } finally { await b.close(); }
});

test('Crash reports: opt-in loads the pinned SDK (SRI checked by the browser) and sends a scrubbed event', async () => {
  const sent = []; const b = await launch({ route: sentryRoutes(sent) }); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.waitForSelector('.ao-card', { timeout: 20000 });
    assert.equal(sent.length, 0, 'nothing is sent before consent');
    assert.equal(await p.evaluate(() => typeof window.__arahSentryLib), 'undefined', 'no Sentry code before consent');
    await p.locator('.ao-card .ao-yes').click();
    await p.waitForFunction(() => window.__arahObserve.status().active, null, { timeout: 15000 });
    await p.evaluate(() => { setTimeout(() => { throw new Error('boom at 3.157912,101.711633 for query klcc'); }, 0); });
    await p.waitForFunction(() => true); await p.waitForTimeout(500);
    await p.evaluate(() => window.__arahSentryLib.flush(2000)); await p.waitForTimeout(1500);
    const env = sent.map((x) => x.body).join('\n');
    assert.ok(sent.length >= 1 && sent[0].url.includes('/api/456/envelope/'), 'an envelope reached the ingest host');
    assert.ok(env.includes('boom at [coords]'), 'message is scrubbed');
    assert.ok(!env.includes('3.157912') && !env.includes('101.711633'), 'coordinates never leave the device');
    assert.match(env, /arah@\d+\.\d+\.\d+/);
  } finally { await b.close(); }
});

test('Crash reports: "No thanks" means Sentry is never downloaded and nothing is sent', async () => {
  const sent = []; const b = await launch({ route: sentryRoutes(sent) }); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.waitForSelector('.ao-card', { timeout: 20000 }); await p.locator('.ao-card button').first().click();
    await p.evaluate(() => { setTimeout(() => { throw new Error('ignored'); }, 0); }); await p.waitForTimeout(1000);
    assert.equal(sent.length, 0); assert.equal(await p.evaluate(() => typeof window.__arahSentryLib), 'undefined');
    assert.equal(await p.evaluate(() => localStorage.getItem('arah.observe.v1')), 'off');
  } finally { await b.close(); }
});

const DEEPAVALI = "Date.now = (() => { const t = new Date('2026-11-03T04:00:00Z').getTime(); const O = Date; globalThis.Date = class extends O { constructor(...a) { a.length ? super(...a) : super(t); } static now() { return t; } }; return () => t; })();";

test('Performance: with a festival theme on, an idle map stays idle (no continuous redraw)', async () => {
  const b = await launch({ init: DEEPAVALI }); const p = await b.page();
  try {
    await openApp(p, srv.url); await p.waitForTimeout(2500);
    assert.equal(await p.evaluate(() => window.__arahFestiveApi.current()), 'deepavali');
    const r = await p.evaluate(() => new Promise((res) => { const m = window.__arahMap; let n = 0; const f = () => n++; m.on('render', f); setTimeout(() => { m.off('render', f); res({ n, loaded: m.loaded() }); }, 3000); }));
    // Before the fix a style-change feedback loop redrew the whole 3D map ~30x/s forever (battery, heat, jank).
    assert.ok(r.n <= 3, `idle map rendered ${r.n} times in 3 s`);
  } finally { await b.close(); }
});

test('Accessibility: page language is set and our buttons name their visible text', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    assert.equal(await p.evaluate(() => document.documentElement.lang), 'ms');
    const mismatch = await p.evaluate(() => [...document.querySelectorAll('.ap-btn, .arah-pwa-pill')].map((bt) => {
      const vis = (bt.querySelector('span') || bt).textContent.trim().toLowerCase(), name = (bt.getAttribute('aria-label') || '').toLowerCase();
      return name.startsWith(vis) ? null : vis + ' !~ ' + name;
    }).filter(Boolean));
    assert.deepEqual(mismatch, [], 'WCAG 2.5.3 label in name');
  } finally { await b.close(); }
});

test('Fonts: every bundled icon has a real glyph, and the Latin UI fonts load', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url); await p.waitForTimeout(1500);
    const r = await p.evaluate(async () => {
      await document.fonts.ready;
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40; const g = cv.getContext('2d');
      // A glyph the font does not have draws as the font's "missing" box (or nothing): compare pixels against that.
      const draw = (fam, ch) => { g.clearRect(0, 0, 40, 40); g.font = '28px "' + fam + '"'; g.textBaseline = 'middle'; g.fillText(ch, 4, 20); return cv.toDataURL(); };
      const out = { blank: [], total: 0, families: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))] };
      await document.fonts.load('28px "Phosphor"', '\ue4f6'); await document.fonts.load('28px "Phosphor-Fill"', '\ue4f6');
      const missing = { Phosphor: draw('Phosphor', '\uf8fe'), 'Phosphor-Fill': draw('Phosphor-Fill', '\uf8fe') };
      for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
        for (const rule of rules) { const m = rule.selectorText && rule.selectorText.match(/^\.(ph|ph-fill)\.ph-([a-z0-9-]+)::?before$/); if (!m) continue;
          const ch = JSON.parse(rule.style.getPropertyValue('content')); const fam = m[1] === 'ph' ? 'Phosphor' : 'Phosphor-Fill';
          out.total++; if (draw(fam, ch) === missing[fam]) out.blank.push(m[2]); } }
      return out;
    });
    assert.ok(r.total >= 100, 'icon rules present: ' + r.total);
    assert.deepEqual(r.blank, [], 'icons whose glyph is missing from the trimmed font');
    for (const f of ['Phosphor', 'Phosphor-Fill', 'Ubuntu', 'Barlow Condensed']) assert.ok(r.families.includes(f), f + ' loaded');
  } finally { await b.close(); }
});

test('Keep-awake is a small button in the map button column area, overlaps nothing, and it toggles', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.waitForSelector('.ak-btn:not([hidden])', { timeout: 15000 });
    await p.waitForTimeout(1500); // layout layer settles
    const g = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(), k = document.querySelector('.ak-btn'), kr = r(k), col = window.__arahLayout.column();
      const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      const toggle = document.querySelector('button[aria-label^="Togol"]');
      return { w: kr.width, h: kr.height, toast: !!document.querySelector('.ak-toast'), overlapsColumn: [...col.children].some((x) => hit(kr, r(x))), overlapsToggle: hit(kr, r(toggle)),
        colVsToggle: [...col.children].some((x) => hit(r(x), r(toggle))), pt: window.__arahLayout.panelTop(), kb: kr.bottom, right: innerWidth - kr.right };
    });
    assert.equal(g.toast, false); assert.ok(g.w >= 44 && g.h >= 44);
    assert.equal(g.overlapsColumn, false, 'not on top of a map button'); assert.equal(g.overlapsToggle, false, 'not on top of the panel toggle'); assert.equal(g.colVsToggle, false, 'column clears the panel toggle');
    assert.ok(g.right >= 12 && g.right < 140, 'on the right side: ' + g.right);
    await p.click('.ak-btn');
    assert.equal(await p.evaluate(() => localStorage.getItem('arah.awake.v1')), '0');
    assert.equal(await p.getAttribute('.ak-btn', 'aria-pressed'), 'false');
  } finally { await b.close(); }
});

test('Vehicles: a 3D vehicle replaces the route arrow while navigating, follows the travel mode, reacts to taps, and gives the arrow back', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url);
    await p.evaluate(() => { // same arrow marker the app puts on the route during a trip
      localStorage.setItem('arah.prefs.v1', JSON.stringify({ mode: 'bus' }));
      const el = document.createElement('div'); el.style.cssText = 'width:30px;height:36px';
      el.innerHTML = '<div style="width:100%;height:100%;clip-path:polygon(50% 0,100% 100%,50% 76%,0 100%);background:#2fd0ec"></div>';
      window.__pk = new window.maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(window.__arahMap.unproject([195, 285])).setRotation(35).addTo(window.__arahMap);
    });
    await p.waitForFunction(() => window.__arahVehicle.status().running, null, { timeout: 30000 });
    let st = await p.evaluate(() => window.__arahVehicle.status());
    assert.equal(st.mode, 'bus'); assert.equal(st.failed, false);
    assert.equal(await p.evaluate(() => window.__pk.getElement().firstElementChild.style.visibility), 'hidden', 'arrow is hidden while the vehicle shows');
    const c = await p.evaluate(() => { const cv = [...document.body.children].find((e) => e.tagName === 'CANVAS' && e.style.width === '120px'); const r = cv.getBoundingClientRect(); return { x: r.left + 60, y: r.top + 60, w: r.width }; });
    assert.equal(c.w, 120);
    await p.mouse.click(c.x, c.y); // tap the vehicle: next colour, remembered
    st = await p.evaluate(() => window.__arahVehicle.status()); assert.equal(st.colour, 1);
    await p.evaluate(() => window.__pk.remove()); // trip ends
    await p.waitForFunction(() => !window.__arahVehicle.status().running, null, { timeout: 10000 });
    assert.equal(await p.evaluate(() => [...document.body.children].some((e) => e.tagName === 'CANVAS' && e.style.width === '120px')), false, 'overlay removed');
    // walking keeps the plain arrow
    await p.evaluate(() => { localStorage.setItem('arah.prefs.v1', JSON.stringify({ mode: 'walk' })); const m = window.__arahMap; const el = document.createElement('div'); el.style.cssText = 'width:30px;height:36px'; el.innerHTML = '<div style="width:100%;height:100%;clip-path:polygon(50% 0,100% 100%,50% 76%,0 100%)"></div>'; window.__pk = new window.maplibregl.Marker({ element: el }).setLngLat(m.getCenter()).addTo(m); });
    await p.waitForTimeout(2000);
    assert.equal(await p.evaluate(() => window.__arahVehicle.status().running), false);
  } finally { await b.close(); }
});

test('Accessibility: axe finds no WCAG 2.2 A/AA or AAA violations on the main screens (landmarks, contrast, target size)', async () => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const b = await launch(); const p = await b.page();
  try {
    await openApp(p, srv.url); await p.waitForTimeout(9000); // let the greeting banner go
    const bad = [];
    const scan = async (label) => { for (const tags of [['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'], ['wcag2aaa']]) {
      const r = await new AxeBuilder({ page: p }).withTags(tags).exclude('.maplibregl-canvas').analyze();
      for (const v of r.violations) bad.push(label + ': ' + v.id + ' (' + v.nodes.length + ') ' + v.nodes[0].target.join(' ').slice(0, 70)); } };
    await scan('home');
    for (const t of [/route/i, /nearby/i]) { await p.getByRole('button', { name: t }).first().click(); await p.waitForTimeout(600); await scan(String(t)); }
    await p.locator('.ap-btn').first().click(); await p.waitForTimeout(600); await scan('places'); await p.keyboard.press('Escape');
    await p.locator('.af-btn').first().click(); await p.waitForTimeout(600); await scan('festive');
    assert.deepEqual(bad, []);
  } finally { await b.close(); }
});

test('Loader: the branded 3D loader paints from the page shell, carries over into the app, and leaves once the map has drawn', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await p.goto(srv.url + '/index.html', { waitUntil: 'commit' });
    await p.waitForSelector('#arah-loader', { timeout: 10000 }); // in the shell, before the bundle unpacks
    assert.equal(await p.evaluate(() => document.getElementById('arah-loader').getAttribute('role')), 'status');
    await p.waitForFunction(() => !!window.__arahMap, null, { timeout: 30000 });
    assert.equal(await p.evaluate(() => !!document.getElementById('arah-loader')), true, 'still covering the app while the map starts');
    await p.waitForFunction(() => !document.getElementById('arah-loader'), null, { timeout: 30000 });
    assert.equal(await p.evaluate(() => !!document.getElementById('arah-loader-css')), false, 'style removed with it');
  } finally { await b.close(); }
});

test('Loader: with reduced motion nothing animates', async () => {
  const b = await launch(); const p = await b.page();
  try {
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(srv.url + '/index.html', { waitUntil: 'commit' });
    await p.waitForSelector('#arah-loader .al-arrow i', { timeout: 10000 });
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('#arah-loader .al-arrow')).animationName), 'none');
  } finally { await b.close(); }
});
