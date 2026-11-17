#!/usr/bin/env node
'use strict';

// Real application checks through its controls, JSON dialog, and rendered canvas.
// No application functions are replaced or exported for these tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const modulePath = process.env.SIMPLECAD_PLAYWRIGHT_MODULE;
if (modulePath && !path.isAbsolute(modulePath)) throw new Error('SIMPLECAD_PLAYWRIGHT_MODULE must be absolute.');
const { chromium } = require(modulePath || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://simplecad.test';
const STORAGE_KEY = 'simplecad_project_v5';
const files = new Set(['index.html', 'styles.css', 'app.js', 'project-data.js', 'default-room.js', 'icon.svg', 'icon.ico']);
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function furniture(overrides = {}) {
  return { id: 'review-desk', name: 'Review desk', type: 'desk', w: 140, h: 64, zHeight: 75,
    x: 280, y: 250, rot: 0, color: 'zinc', visible: true, lockedDims: false, ignoreCollision: false, ...overrides };
}
function fixture(items = [furniture()], doors = []) {
  return { app: 'SimpleCAD', version: 2, room: { name: 'Synthetic test room', w: 600, h: 500,
    wallThickness: 14, doors, windows: [], outlets: [] }, items, cables: [], layouts: [] };
}
async function ready(page) {
  await page.locator('.item-select-btn').first().waitFor();
}
async function closeJson(page) {
  if (await page.locator('#json-dialog').evaluate(el => el.open)) {
    await page.locator('[data-close-dialog="json-dialog"]').click();
  }
}
async function snapshot(page) {
  await closeJson(page);
  await page.locator('#btn-open-json').click();
  const value = JSON.parse(await page.locator('#json-textarea').inputValue());
  await closeJson(page);
  return value;
}
async function apply(page, value) {
  await page.locator('#btn-open-json').click();
  await page.locator('#json-textarea').fill(JSON.stringify(value));
  await page.locator('#btn-apply-json').click();
  await page.waitForFunction(() => !document.querySelector('#json-dialog').open || document.querySelector('#json-feedback').textContent.length > 0);
  return page.locator('#json-dialog').evaluate(el => !el.open);
}
async function load(page, value) {
  const accepted = await apply(page, value);
  assert(accepted, `A valid test project must load. ${accepted ? '' : await page.locator('#json-feedback').textContent()}`);
  await ready(page);
  await page.locator('.item-select-btn').first().click();
}
async function persistedSnapshot(page) {
  const probe = await page.context().newPage();
  try {
    await probe.goto(ORIGIN);
    await ready(probe);
    return await snapshot(probe);
  } finally { await probe.close(); }
}
async function cursorWorld(page) {
  const text = await page.locator('#cursor-coords').textContent();
  const match = text.match(/X:\s*(-?\d+)\s*cm\s*\|\s*Y:\s*(-?\d+)/);
  assert(match, 'The editor must display world coordinates.');
  return { x: Number(match[1]), y: Number(match[2]) };
}
async function worldPoint(page, x, y) {
  // Calibrate against the actual coordinate readout, not a copied camera algorithm.
  const rect = await page.locator('#cadCanvas').boundingBox();
  const p1 = { x: rect.x + rect.width * 0.30, y: rect.y + rect.height * 0.45 };
  const p2 = { x: p1.x + 100, y: p1.y + 100 };
  await page.mouse.move(p1.x, p1.y);
  const w1 = await cursorWorld(page);
  await page.mouse.move(p2.x, p2.y);
  const w2 = await cursorWorld(page);
  return { x: p1.x + (x - w1.x) * 100 / (w2.x - w1.x), y: p1.y + (y - w1.y) * 100 / (w2.y - w1.y) };
}
async function drag(page, point, dx, dy, button = 'left') {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button });
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 5 });
  await page.mouse.up({ button });
}
async function pngHash(page) {
  const downloading = page.waitForEvent('download');
  await page.locator('#btn-export-png').click();
  const download = await downloading;
  const stream = await download.createReadStream();
  assert(stream, 'PNG download must provide bytes.');
  const parts = [];
  for await (const part of stream) parts.push(part);
  const bytes = Buffer.concat(parts);
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Export must be a PNG.');
  assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, 'PNG dimensions must be positive.');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const tests = [];
function test(name, run, options = {}) { tests.push({ name, run, ...options }); }

test('side resize preserves the untouched dimension and position', async page => {
  await load(page, fixture());
  const before = (await snapshot(page)).items[0];
  const east = await worldPoint(page, before.x + before.w / 2, before.y);
  await drag(page, east, 40, 0);
  const after = (await snapshot(page)).items[0];
  assert(after.w > before.w, 'East handle must change width.');
  assert.equal(after.h, before.h, 'East handle must not round the depth to the grid.');
  assert.equal(after.y, before.y, 'East handle must not shift the vertical position.');
  assert(Math.abs((after.x - after.w / 2) - (before.x - before.w / 2)) < 0.11, 'Opposite edge must remain anchored.');
});

test('Shift corner resize preserves aspect ratio', async page => {
  await load(page, fixture([furniture({ w: 141 })]));
  const before = (await snapshot(page)).items[0];
  const corner = await worldPoint(page, before.x + before.w / 2, before.y + before.h / 2);
  await page.keyboard.down('Shift');
  try { await drag(page, corner, 50, 35); } finally { await page.keyboard.up('Shift'); }
  const after = (await snapshot(page)).items[0];
  assert(after.w > before.w, 'Corner handle must enlarge the item.');
  assert(Math.abs(after.w / after.h - before.w / before.h) < 0.005, 'Grid rounding must not break the aspect ratio.');
});

test('touch drag followed by pinch is saved and can be undone', async page => {
  await load(page, fixture([furniture({ h: 60 })]));
  await page.reload();
  await ready(page);
  await page.locator('.item-select-btn').first().click();
  const before = await snapshot(page);
  const center = await worldPoint(page, before.items[0].x, before.items[0].y);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const first = { id: 1, ...center, radiusX: 2, radiusY: 2, force: 1 };
  const moved = { ...first, x: first.x + 45, y: first.y + 15 };
  const second = { id: 2, x: center.x + 110, y: center.y + 140, radiusX: 2, radiusY: 2, force: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [moved, second] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await snapshot(page);
  assert.notEqual(after.items[0].x, before.items[0].x, 'Touch must move the item.');
  assert.deepEqual((await persistedSnapshot(page)).items, after.items, 'Pinch must not discard the pending save.');
  await page.locator('#btn-undo').click();
  assert.deepEqual((await snapshot(page)).items, before.items, 'The drag must retain its own undo entry.');
});

test('collision UI distinguishes touching, overlap, bounds, and door swing', async page => {
  const first = furniture({ x: 200, y: 200, w: 100, h: 100 });
  const second = furniture({ id: 'second', name: 'Second box', type: 'box', x: 300, y: 200, w: 100, h: 100 });
  await load(page, fixture([first, second]));
  assert(await page.locator('#collision-strip').evaluate(el => el.classList.contains('hidden')), 'Flush contact is allowed.');
  await load(page, fixture([first, { ...second, x: 299 }]));
  assert.match(await page.locator('#collision-list').textContent(), /Review desk.*Second box/);
  await load(page, fixture([furniture({ x: 40, y: 200, w: 100, h: 100 })]));
  assert.match(await page.locator('#collision-list').textContent(), /Fora dos limites/);
  await load(page, fixture([furniture({ x: 240, y: 450, w: 40, h: 40 })], [{ id: 'door', name: 'Door', wall: 'bottom', offset: 200, width: 90, hinge: 'left', swing: 'inward' }]));
  assert.match(await page.locator('#collision-list').textContent(), /Bloqueia porta/);
});

test('divider joint drag changes folds and undo restores the item', async page => {
  await load(page, fixture([furniture({ id: 'divider', type: 'divider', name: 'Review divider', x: 300, y: 240, w: 160, h: 4, foldAngles: [0, 0, 0] })]));
  const before = (await snapshot(page)).items[0];
  await drag(page, await worldPoint(page, 300, 240), 0, 35);
  assert.notDeepEqual((await snapshot(page)).items[0].foldAngles, before.foldAngles);
  await page.locator('#btn-undo').click();
  assert.deepEqual((await snapshot(page)).items[0], before);
});

for (const [label, corrupt] of [
  ['null item', p => { p.items = [null]; }],
  ['null door', p => { p.room.doors = [null]; }],
  ['unsupported v3 graph', p => { p.version = 3; p.buildings = [{ id: 'building', storeys: [] }]; }],
  ['oversized room', p => { p.room.w = 3600; }]
]) {
  test(`rejecting ${label} preserves state, stored data, and undo`, async page => {
    await load(page, fixture());
    await page.reload();
    await ready(page);
    const original = await snapshot(page);
    await page.locator('#hud-dup').click();
    const before = await snapshot(page);
    const bad = structuredClone(before);
    bad.room.name = 'Must not replace the current project';
    corrupt(bad);
    assert.equal(await apply(page, bad), false, 'Invalid input must remain in the dialog with an error.');
    assert.match(await page.locator('#json-feedback').textContent(), /Erro/i);
    assert.deepEqual(await snapshot(page), before, 'Failed import must not partially mutate the editor.');
    assert.deepEqual(await persistedSnapshot(page), before, 'Failed import must not overwrite stored data.');
    await page.locator('#btn-undo').click();
    assert.deepEqual((await snapshot(page)).items, original.items, 'Failed import must not consume an undo entry.');
  });
}

test('JSON round trip retains settings and cable color', async page => {
  const payload = fixture();
  payload.room.outlets = [{ id: 'socket', name: 'Socket', wall: 'top', pos: 200 }];
  payload.cables = [{ id: 'cable', name: 'Test cable', fromId: 'review-desk', toId: 'socket', maxMeters: 5, warnMeters: 4,
    routingMode: 'direct', visible: true, color: '#123456' }];
  payload.gridStep = 1;
  payload.wallSnap = false;
  payload.style3d = 'sketch';
  await load(page, payload);
  const exported = await snapshot(page);
  assert.equal(exported.gridStep, 1);
  assert.equal(exported.wallSnap, false);
  assert.equal(exported.style3d, 'sketch');
  assert.equal(exported.cables[0].color, '#123456');
  await page.locator('#btn-grid').click();
  await page.locator('#btn-snap').click();
  await page.locator('#btn-style3d-solid').click();
  assert(await apply(page, exported));
  assert.deepEqual(await snapshot(page), exported);
  assert.deepEqual(await persistedSnapshot(page), exported);
});

test('HTML in structural numeric values is rejected without execution', async page => {
  await load(page, fixture());
  const before = await snapshot(page);
  const bad = structuredClone(before);
  bad.room.doors = [{ id: 'bad-door', name: 'Malformed door', wall: 'bottom', offset: 20, hinge: 'left',
    width: '<img data-test-import-node src="invalid-image" onerror="document.documentElement.dataset.importExecuted=\'yes\'">' }];
  const accepted = await apply(page, bad);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('html').getAttribute('data-import-executed'), null, 'Imported numeric text must never execute HTML.');
  assert.equal(await page.locator('[data-test-import-node]').count(), 0, 'Imported numeric text must never create DOM nodes.');
  assert.equal(accepted, false);
  assert.deepEqual(await snapshot(page), before);
});

test('pure preview never overwrites an existing saved project', async page => {
  await load(page, fixture());
  const before = await snapshot(page);
  const preview = await page.context().newPage();
  try {
    await preview.goto(`${ORIGIN}/?pure=1`);
    await preview.locator('#cadCanvas').waitFor();
    await preview.waitForFunction(() => document.body.classList.contains('pure-cad') && document.querySelector('#room-w').value !== '');
    assert.notEqual(Number(await preview.locator('#room-w').inputValue()), before.room.w, 'The preview must display its own demo.');
    assert.deepEqual(await persistedSnapshot(page), before, 'Opening a demo preview must not save it over the existing design.');
    await preview.reload();
    await preview.locator('#cadCanvas').waitFor();
    assert.deepEqual(await persistedSnapshot(page), before, 'Reloading a demo preview must leave the saved project intact.');
  } finally { await preview.close(); }
});

test('malformed saved JSON is preserved during fallback and subsequent edits', async page => {
  const malformed = '{"app":"SimpleCAD","unfinished":';
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: STORAGE_KEY, raw: malformed });
  await page.reload();
  await ready(page);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), malformed, 'Fallback must preserve the original bytes.');
  assert(await page.locator('#toast').isVisible(), 'Recovery warning must remain visible.');
  assert.match(await page.locator('#toast').textContent(), /preservado/i);
  await page.locator('#hud-dup').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), malformed, 'Editing the fallback demo must not overwrite recoverable saved data.');
  await page.reload();
  await ready(page);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), malformed);
});

test('a saved legacy project with empty layouts is recovered without losing its design', async page => {
  await load(page, fixture());
  const before = await snapshot(page);
  const legacy = { ...before, layouts: [], activeLayoutId: 'missing-layout' };
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: STORAGE_KEY, raw: JSON.stringify(legacy) });
  await page.reload();
  await ready(page);
  const recovered = await snapshot(page);
  assert.deepEqual(recovered.items, before.items);
  assert.deepEqual(recovered.room, before.room);
  assert.equal(recovered.layouts.length, 1);
  assert.equal(recovered.activeLayoutId, recovered.layouts[0].id);
  await page.locator('#hud-dup').click();
  const edited = await snapshot(page);
  assert.equal(edited.items.length, before.items.length + 1);
  assert.deepEqual(await persistedSnapshot(page), edited, 'Recovered legacy projects must remain editable and save normally.');
});

test('storage quota failure warns visibly while retaining the saved project', async page => {
  await load(page, fixture());
  const before = await snapshot(page);
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (candidateKey, value) {
      if (candidateKey === key) throw new DOMException('Synthetic test quota', 'QuotaExceededError');
      return original.call(this, candidateKey, value);
    };
  }, STORAGE_KEY);
  await page.reload();
  await ready(page);
  await page.locator('#hud-dup').click();
  assert.equal((await snapshot(page)).items.length, before.items.length + 1, 'The edit remains available to export.');
  assert(await page.locator('#toast').isVisible(), 'A failed save must have a visible warning.');
  assert.match(await page.locator('#toast').textContent(), /não foi possível guardar.*exporta.*JSON/i);
  assert.deepEqual(await persistedSnapshot(page), before, 'A quota failure must leave the earlier stored project intact.');
});

test('undo during an animated layout switch redoes the completed destination', async page => {
  const initial = await snapshot(page);
  assert(initial.layouts.length >= 2, 'Default demo must offer a second layout.');
  const targetId = initial.layouts.find(layout => layout.id !== initial.activeLayoutId).id;
  // Reduced motion gives a real UI reference for the completed destination.
  await page.locator('#layout-select').selectOption(targetId);
  const completed = await snapshot(page);
  await page.locator('#layout-select').selectOption(initial.activeLayoutId);
  const source = await snapshot(page);
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#layout-select').selectOption(targetId);
  await page.clock.runFor(64);
  await page.locator('#btn-undo').click({ force: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.deepEqual((await snapshot(page)).items, source.items, 'Undo must restore the source layout.');
  await page.locator('#btn-redo').click();
  const redone = await snapshot(page);
  assert.equal(redone.activeLayoutId, targetId);
  assert.deepEqual(redone.items, completed.items, 'Redo must restore the destination, not an intermediate animation frame.');
}, { clock: true });

test('zoom and canvas input finish an animated rotation before saving or undo', async page => {
  await load(page, fixture());
  const before = await snapshot(page);
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#hud-rot-cw').click({ force: true });
  await page.clock.runFor(64);
  await page.locator('#btn-zoom-in').click({ force: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await snapshot(page)).items[0].rot, 90, 'Zoom must complete the requested rotation.');
  assert.equal((await persistedSnapshot(page)).items[0].rot, 90);
  await page.locator('#btn-undo').click();
  assert.deepEqual((await snapshot(page)).items, before.items);
  await page.locator('#btn-redo').click();
  assert.equal((await snapshot(page)).items[0].rot, 90);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#hud-rot-cw').click({ force: true });
  await page.clock.runFor(64);
  const canvas = await page.locator('#cadCanvas').boundingBox();
  await page.mouse.click(canvas.x + 30, canvas.y + canvas.height - 40);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await snapshot(page)).items[0].rot, 180, 'Canvas input must complete the next rotation.');
  assert.equal((await persistedSnapshot(page)).items[0].rot, 180);
}, { clock: true });

test('the last custom layout cannot be deleted; another custom layout can', async page => {
  const payload = fixture();
  payload.layouts = [{ id: 'only-layout', name: 'Only layout', builtIn: false, placements: {} }];
  payload.activeLayoutId = 'only-layout';
  await load(page, payload);
  const before = await snapshot(page);
  assert(await page.locator('#btn-delete-layout').isHidden(), 'The final layout must have no delete action.');
  assert.deepEqual(await persistedSnapshot(page), before);
  await page.locator('#btn-save-layout').click();
  await page.locator('#dlg-layout-name').fill('Second layout');
  await page.locator('#layout-form button[type="submit"]').click();
  const added = await snapshot(page);
  assert.equal(added.layouts.length, 2);
  assert.notEqual(added.activeLayoutId, 'only-layout');
  assert(await page.locator('#btn-delete-layout').isVisible());
  await page.locator('#btn-delete-layout').click();
  await page.locator('#confirm-dialog-ok').click();
  await page.locator('#confirm-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(await snapshot(page), before, 'Deleting the second layout must retain the first and its project data.');
  assert(await page.locator('#btn-delete-layout').isHidden());
  assert.deepEqual(await persistedSnapshot(page), before);
});

test('3D export preserves subsequent click hit testing', async page => {
  await page.locator('#btn-view-3d').click();
  const rect = await page.locator('#cadCanvas').boundingBox();
  const point = { x: rect.x + 398, y: rect.y + 320 };
  await page.mouse.click(point.x, point.y);
  const before = (await snapshot(page)).selectedId;
  assert(before, 'Control click must select a real item.');
  await pngHash(page);
  await page.mouse.click(point.x, point.y);
  assert.equal((await snapshot(page)).selectedId, before, 'Export must not replace live hit regions with export coordinates.');
});

test('2D and 3D PNGs exclude selection; 2D excludes camera and measurement overlays', async page => {
  await load(page, fixture([furniture(), furniture({ id: 'second', name: 'Second box', type: 'box', x: 450, y: 350, w: 60, h: 60 })]));
  for (const view of ['2d', '3d']) {
    await page.locator(`#btn-view-${view}`).click();
    for (const style of ['solid', 'sketch']) {
      await page.locator(`#btn-style3d-${style}`).click();
      await page.locator('.item-select-btn').nth(0).click();
      const first = await pngHash(page);
      await page.locator('.item-select-btn').nth(1).click();
      assert.equal(await pngHash(page), first, `${view}/${style} export must exclude selection handles and outlines.`);
    }
  }
  await page.locator('#btn-view-2d').click();
  const clean = await pngHash(page);
  const rect = await page.locator('#cadCanvas').boundingBox();
  const empty = { x: rect.x + 30, y: rect.y + rect.height - 60 };
  await drag(page, empty, 25, -20, 'middle');
  await page.mouse.wheel(0, -200);
  await page.locator('#btn-measure').click();
  await page.mouse.click(empty.x, empty.y);
  await page.mouse.click(empty.x + 80, empty.y - 40);
  assert.equal(await pngHash(page), clean, 'Editor zoom, pan, and measurement overlays must not change the exported drawing.');
});

async function main() {
  const browserPath = process.env.SIMPLECAD_BROWSER_PATH;
  if (browserPath && !path.isAbsolute(browserPath)) throw new Error('SIMPLECAD_BROWSER_PATH must be absolute.');
  const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
  let failed = 0;
  try {
    for (const entry of tests) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
      context.setDefaultTimeout(5000);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (!files.has(name) || !fs.existsSync(path.join(ROOT, name))) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ body: fs.readFileSync(path.join(ROOT, name)), contentType: contentTypes[path.extname(name)] });
      });
      const pageErrors = [];
      context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
      const page = await context.newPage();
      try {
        if (entry.clock) await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto(ORIGIN);
        await ready(page);
        await entry.run(page);
        assert.deepEqual(pageErrors, [], 'The real app must not raise uncaught page errors.');
        console.log(`PASS ${entry.name}`);
      } catch (error) {
        failed++;
        console.error(`FAIL ${entry.name}\n${error.stack || error}`);
        if (pageErrors.length) console.error(`Page errors: ${JSON.stringify(pageErrors)}`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log(`Browser engine suite: ${tests.length - failed} passed, ${failed} failed.`);
  process.exitCode = failed ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
