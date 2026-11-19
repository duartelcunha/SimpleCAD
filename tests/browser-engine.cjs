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
const files = new Set(['index.html', 'styles.css', 'app.js', 'project-data.js', 'default-room.js', 'icon.svg', 'icon.ico', 'manifest.webmanifest', 'sw.js']);
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

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

test('3D occlusion hides rear nightstand and handles behind the wardrobe', async page => {
  const measureOcclusion = () => page.evaluate(() => {
    const canvas = document.getElementById('cadCanvas');
    const cctx = canvas.getContext('2d');
    const dpr = canvas.width / canvas.clientWidth;
    const x0 = Math.floor(canvas.clientWidth * 0.25 * dpr);
    const y0 = Math.floor(canvas.clientHeight * 0.25 * dpr);
    const w = Math.floor(canvas.clientWidth * 0.45 * dpr);
    const h = Math.floor(canvas.clientHeight * 0.53 * dpr);
    const data = cctx.getImageData(x0, y0, w, h).data;
    let amber = 0;
    let handles = 0;
    let wardrobeGray = 0;
    let paperLight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 150 && g > 100 && r - b > 60) amber++;
      if (b > r + 4 && r >= 165 && g >= 168 && b >= 175) handles++;
      if (Math.abs(r - g) < 16 && Math.abs(g - b) < 16 && r >= 75 && r <= 205) wardrobeGray++;
      if (r > 220 && g > 215 && b > 205) paperLight++;
    }
    return { amber, handles, wardrobeGray, paperLight };
  });

  // Positive control: exposed amber nightstand and front-facing wardrobe handles (rot: 0) trigger detectors.
  await load(page, fixture([
    furniture({ id: 'rear-amber', name: 'Exposed nightstand', type: 'nightstand', color: 'amber', x: 180, y: 260, w: 50, h: 46, zHeight: 55, rot: 270 }),
    furniture({ id: 'front-wardrobe', name: 'Front wardrobe', type: 'wardrobe', color: 'zinc', x: 300, y: 315, w: 160, h: 64, zHeight: 215, rot: 0 })
  ]));
  await page.locator('#btn-view-3d').click();
  await page.locator('#btn-style3d-solid').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const solidControl = await measureOcclusion();
  assert(solidControl.amber > 1000, 'Exposed amber nightstand control must be detected in Solid 3D.');
  assert(solidControl.handles >= 15, 'Front-facing wardrobe handles control must be detected in Solid 3D.');

  await page.locator('#btn-style3d-sketch').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sketchControl = await measureOcclusion();
  assert(sketchControl.amber > 500, 'Exposed amber nightstand control must be detected in Sketch 3D.');

  // Occlusion check: rear nightstand (y: 215) and rear-facing wardrobe handles (rot: 180) must be hidden behind wardrobe.
  await load(page, fixture([
    furniture({ id: 'rear-amber', name: 'Rear nightstand', type: 'nightstand', color: 'amber', x: 300, y: 215, w: 50, h: 46, zHeight: 55, rot: 270 }),
    furniture({ id: 'front-wardrobe', name: 'Front wardrobe', type: 'wardrobe', color: 'zinc', x: 300, y: 315, w: 160, h: 64, zHeight: 215, rot: 180 })
  ]));
  await page.locator('#btn-style3d-solid').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const solidOccluded = await measureOcclusion();
  assert(solidOccluded.wardrobeGray > 10000, 'Wardrobe faces must render solidly in 3D.');
  assert.equal(solidOccluded.amber, 0, 'Rear amber nightstand must be completely occluded behind the front wardrobe.');
  assert.equal(solidOccluded.handles, 0, 'Rear-facing wardrobe handles must be completely occluded behind the wardrobe body.');

  await page.locator('#btn-style3d-sketch').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sketchOccluded = await measureOcclusion();
  assert(sketchOccluded.paperLight > 1000, 'Sketch 3D mode must render warm architectural paper tones.');
  assert.equal(sketchOccluded.amber, 0, 'Sketch 3D must also occlude the rear amber nightstand behind the front wardrobe.');
});

test('sidebar room dimension inputs accept up to 2000 cm and clamp out-of-range values', async page => {
  await page.locator('#tab-btn-room').click();
  assert.equal(await page.locator('#room-w').getAttribute('max'), '2000');
  assert.equal(await page.locator('#room-h').getAttribute('max'), '2000');
  await page.locator('#room-w').fill('2000');
  await page.locator('#room-w').dispatchEvent('change');
  await page.locator('#room-h').fill('1850');
  await page.locator('#room-h').dispatchEvent('change');
  const updated = await snapshot(page);
  assert.equal(updated.room.w, 2000);
  assert.equal(updated.room.h, 1850);
  assert.equal(await page.locator('#room-size-badge').textContent(), '2000×1850 cm');
  assert.equal((await persistedSnapshot(page)).room.w, 2000);

  await page.locator('#room-w').fill('2500');
  await page.locator('#room-w').dispatchEvent('change');
  await page.locator('#room-h').fill('50');
  await page.locator('#room-h').dispatchEvent('change');
  const clamped = await snapshot(page);
  assert.equal(clamped.room.w, 2000, 'Values above 2000 cm must clamp to 2000 cm.');
  assert.equal(clamped.room.h, 100, 'Values below 100 cm must clamp to 100 cm.');
});

test('responsive viewports (768x1024 and 390x844) avoid toolbar/HUD clipping and keep Sketch stamp clear of coordinates', async page => {
  await page.locator('#btn-view-2d').click();
  await page.locator('#btn-style3d-sketch').click();
  await page.locator('.item-select-btn').first().click();

  for (const vp of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const metrics = await page.evaluate((vw) => {
      const tb = document.getElementById('main-toolbar');
      const hudActs = document.querySelector('.hud-actions');
      const readout = document.querySelector('.bottom-readout');
      const coords = document.getElementById('cursor-coords');
      const vpEl = document.getElementById('viewport');
      const vpRect = vpEl.getBoundingClientRect();
      const readoutRect = readout.getBoundingClientRect();
      const tbButtons = [...tb.querySelectorAll('button:not(.hidden), select')].map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, left: r.left, right: r.right, width: r.width };
      });
      const hudButtons = [...hudActs.querySelectorAll('button')].map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, left: r.left, right: r.right, width: r.width };
      });

      // Sample canvas along x = 12 (the ochre accent bar of the 2D drawing stamp) above readoutTop
      const canvas = document.getElementById('cadCanvas');
      const cctx = canvas.getContext('2d');
      const dpr = canvas.width / canvas.clientWidth;
      const readoutTopRel = Math.floor(readoutRect.top - vpRect.top);
      let stampBarBottomY = -1;
      for (let y = Math.max(0, readoutTopRel - 120); y < Math.min(canvas.clientHeight, readoutTopRel + 10); y++) {
        const px = cctx.getImageData(Math.floor(11 * dpr), Math.floor(y * dpr), 1, 1).data;
        // Sketch stamp ochre bar is #9e6b1b (158, 107, 27)
        if (px[0] > 135 && px[0] < 180 && px[1] > 85 && px[1] < 130 && px[2] < 55) {
          stampBarBottomY = y;
        }
      }

      return {
        tbOverflow: tb.scrollWidth - tb.clientWidth,
        hudOverflow: hudActs.scrollWidth - hudActs.clientWidth,
        tbClipped: tbButtons.filter(b => b.left < -0.5 || b.right > vw + 0.5 || b.width < 24),
        hudClipped: hudButtons.filter(b => b.left < -0.5 || b.right > vw + 0.5 || b.width < 24),
        coordsVisible: getComputedStyle(coords).display !== 'none' && readoutRect.width > 60,
        stampClearancePx: stampBarBottomY > 0 ? (readoutTopRel - stampBarBottomY) : null
      };
    }, vp.width);

    assert(metrics.tbOverflow <= 1, `Toolbar must not scroll horizontally at ${vp.width}x${vp.height} (overflow=${metrics.tbOverflow}).`);
    assert(metrics.hudOverflow <= 1, `HUD actions must not scroll horizontally at ${vp.width}x${vp.height} (overflow=${metrics.hudOverflow}).`);
    assert.deepEqual(metrics.tbClipped, [], `All toolbar controls must fit inside ${vp.width}x${vp.height}.`);
    assert.deepEqual(metrics.hudClipped, [], `All HUD controls must fit inside ${vp.width}x${vp.height}.`);
    assert(metrics.coordsVisible, `Coordinates badge must remain visible at ${vp.width}x${vp.height}.`);
    assert(metrics.stampClearancePx !== null && metrics.stampClearancePx >= 12,
      `2D Sketch scale block must stay at least 12px above bottom readout at ${vp.width}x${vp.height} (got ${metrics.stampClearancePx}px).`);
  }
});

test('mobile QR dialog generates SVG QR code and compressed #p= URL round-trips while rejecting corrupted #p=', async page => {
  // First verify the full default 11-item Studio Bedroom generates a valid scannable QR code
  await page.locator('#btn-mobile-qr').click();
  assert(await page.locator('#qr-dialog').evaluate(el => el.open), 'QR dialog must open.');
  await page.waitForFunction(() => document.querySelector('#qr-url-input').value.includes('#p='));
  const defaultSvgPath = await page.locator('#qr-code-box svg path').getAttribute('d');
  assert(defaultSvgPath && defaultSvgPath.length > 200, 'Full default 11-item room must fit in SVG QR code.');
  await page.locator('[data-close-dialog="qr-dialog"]').first().click();

  const custom = fixture([furniture({ name: 'Shared Mobile Desk', x: 315, y: 210 })]);
  await load(page, custom);
  const original = await snapshot(page);
  await page.locator('#hud-dup').click();
  const edited = await snapshot(page);

  await page.locator('#btn-mobile-qr').click();
  assert(await page.locator('#qr-dialog').evaluate(el => el.open), 'QR dialog must open.');
  await page.waitForFunction(() => document.querySelector('#qr-url-input').value.includes('#p='));
  const shareUrl = await page.locator('#qr-url-input').inputValue();
  const svgPath = await page.locator('#qr-code-box svg path').getAttribute('d');
  assert(svgPath && svgPath.length > 100, 'Offline SVG QR code must render module path.');
  const hashPart = shareUrl.slice(shareUrl.indexOf('#p='));
  await page.locator('[data-close-dialog="qr-dialog"]').first().click();

  // Corrupted #p= hash must leave open project, saved project, and undo history untouched
  await page.evaluate(() => { window.location.hash = '#p=z.!!!invalid_base64_payload!!!'; });
  await page.evaluate(() => new Promise(r => setTimeout(r, 80)));
  assert.deepEqual(await snapshot(page), edited, 'Corrupted #p= link must not mutate open state.');
  assert.deepEqual(await persistedSnapshot(page), edited, 'Corrupted #p= link must not overwrite saved project.');
  await page.locator('#btn-undo').click();
  assert.deepEqual((await snapshot(page)).items, original.items, 'Corrupted #p= link must not consume undo history.');

  // Valid #p= hash loads the shared project in a fresh page
  const mobilePage = await page.context().newPage();
  try {
    await mobilePage.goto(`${ORIGIN}/${hashPart}`);
    await ready(mobilePage);
    await mobilePage.waitForFunction(() => !window.location.hash.includes('#p='));
    const loadedOnMobile = await snapshot(mobilePage);
    assert.equal(loadedOnMobile.items.length, edited.items.length);
    assert.equal(loadedOnMobile.items[0].name, 'Shared Mobile Desk');
  } finally {
    await mobilePage.close();
  }
});

test('live Wi-Fi sync (/api/project) synchronizes mobile edits and 1-tap camera photos to PC in real time', async page => {
  let serverRevision = 0;
  let serverProject = null;
  const syncToken = 'testtoken123456';

  await page.context().route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/sync-info') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active: true,
          port: 4173,
          token: syncToken,
          lanUrls: [`${ORIGIN}/?sync=${syncToken}`],
          revision: serverRevision
        })
      });
    }
    if (url.pathname === '/api/project') {
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ revision: serverRevision, updatedAt: Date.now(), project: serverProject })
        });
      }
      if (method === 'POST') {
        serverProject = JSON.parse(route.request().postData());
        serverRevision++;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, revision: serverRevision, updatedAt: Date.now() })
        });
      }
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto(`${ORIGIN}/?sync=${syncToken}`);
  await ready(page);
  await page.waitForFunction(() => document.getElementById('btn-mobile-qr').classList.contains('is-live'));

  // Connect a mobile page via the QR code URL (?sync=...)
  const phone = await page.context().newPage();
  try {
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${ORIGIN}/?sync=${syncToken}`);
    await ready(phone);

    // Open mobile bottom drawer, select first furniture item, and attach a camera photo via 1-tap #inp-sel-photo
    await phone.locator('#btn-mobile-sheet').click();
    await phone.locator('.item-select-btn').first().click();
    const onePxPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await phone.locator('#inp-sel-photo').setInputFiles({
      name: 'mobile-camera.png',
      mimeType: 'image/png',
      buffer: onePxPng
    });
    await phone.waitForFunction(() => !document.getElementById('sel-photo-box').classList.contains('hidden'));

    // Trigger sync check on PC by dispatching focus and verify PC received the photo from the phone
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('simplecad_project_v5');
      return raw && raw.includes('data:image/jpeg;base64,');
    });
    const syncedOnPc = await snapshot(page);
    assert(syncedOnPc.items.some(it => typeof it.photoDataUrl === 'string' && it.photoDataUrl.startsWith('data:image/jpeg;base64,')),
      'PC must receive the compressed furniture photo captured on the mobile device.');
  } finally {
    await phone.close();
  }
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
