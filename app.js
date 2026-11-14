/* ============================================================================
   SimpleCAD — Motor CAD Interativo 2D & 3D, OBB, Colisões SAT, Cabos & Offline
   ============================================================================ */
(() => {
  'use strict';

  const STORAGE_KEY = 'simplecad_project_v3';
  const MAX_HISTORY = 50;

  // =========================================================================
  // 1. STATE & HISTORY
  // =========================================================================
  const state = {
    room: null,
    items: [],
    cables: [],
    layouts: [],
    activeLayoutId: 'opt1',
    selectedId: 'cama',
    activeTab: 'furniture',
    viewMode: '2d', // '2d' | 'cables' | '3d'
    cam3d: { yaw: -38, pitch: 46, zoom: 1, panX: 0, panY: 0 },
    hitRegions3D: [],
    handleHits3D: [],
    gridStep: 5,
    wallSnap: true,
    measureMode: false,
    measurePts: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    snapGuides: [],
    quickPhotoDataUrl: null,
    editingItemId: null,
    editingCableId: null,
    pendingModalPhoto: null,
    cableAnimRaf: null,
    activeAnimRaf: null
  };

  const history = {
    past: [],
    future: []
  };

  const view = {
    scale: 1,
    ox: 0,
    oy: 0
  };

  const interaction = {
    pointers: new Map(),
    mode: null, // 'drag' | 'rotate' | 'resize' | 'fold-node' | 'pan' | 'pinch' | 'orbit3d' | 'drag3d'
    itemId: null,
    handle: null,
    nodeIndex: -1,
    startDividerNodes: null,
    startWorld: null,
    startItem: null,
    startScreen: null,
    startPan: null,
    startCam3d: null,
    drag3dPlaneZ: 0,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    pinchStartPan: null,
    pinchStartMid: null,
    beforeSnapshot: null
  };

  // DOM References
  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('cadCanvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('object-hud');
  const srStatus = document.getElementById('sr-status');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  // =========================================================================
  // 2. HELPERS & CLONING
  // =========================================================================
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function normalizeAngle(deg) {
    let a = ((deg % 360) + 360) % 360;
    return Math.round(a * 10) / 10;
  }

  function normalizeSignedAngle(deg) {
    let a = ((deg + 180) % 360 + 360) % 360 - 180;
    return Math.round(a * 10) / 10;
  }

  function isReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelActiveAnim() {
    if (state.activeAnimRaf) {
      cancelAnimationFrame(state.activeAnimRaf);
      state.activeAnimRaf = null;
    }
  }

  /**
   * Interpolates values smoothly using cubic ease-out at display refresh rate.
   * Falls back immediately when reduced-motion is active.
   */
  function animateTransition(durationMs, onTick, onComplete) {
    cancelActiveAnim();
    if (isReducedMotion() || durationMs <= 0) {
      onTick(1);
      if (onComplete) onComplete();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const raw = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - raw, 3);
      onTick(eased);
      draw();
      positionHUD();
      if (raw < 1) {
        state.activeAnimRaf = requestAnimationFrame(step);
      } else {
        state.activeAnimRaf = null;
        if (onComplete) onComplete();
      }
    };
    state.activeAnimRaf = requestAnimationFrame(step);
  }

  function sanitizeFoldAngles(arr) {
    if (Array.isArray(arr) && arr.length === 3) {
      return arr.map(v => Math.max(-135, Math.min(135, Number(v) || 0)));
    }
    return [0, 0, 0];
  }

  function showToast(msg) {
    srStatus.textContent = msg;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2400);
  }

  function getPaletteColor(colorKey) {
    return window.COLOR_PALETTE[colorKey] || window.COLOR_PALETTE.zinc;
  }

  // =========================================================================
  // 3. PROJECT INITIALIZATION & PERSISTENCE
  // =========================================================================
  function buildItemsFromLayout(catalog, layout) {
    const placements = (layout && layout.placements) || {};
    return catalog.map((base, idx) => {
      const p = placements[base.id] || {};
      const item = {
        id: base.id,
        name: base.name,
        type: base.type || 'box',
        w: Number(p.w ?? base.w ?? 60),
        h: Number(p.h ?? base.h ?? 45),
        zHeight: Number(p.zHeight ?? base.zHeight ?? 75),
        x: 0,
        y: 0,
        rot: Number(p.rot ?? 0),
        foldAngles: (base.type === 'divider') ? sanitizeFoldAngles(p.foldAngles ?? base.foldAngles) : undefined,
        color: base.color || 'zinc',
        ignoreCollision: Boolean(base.ignoreCollision),
        lockedDims: Boolean(base.lockedDims),
        visible: p.visible !== undefined ? Boolean(p.visible) : (base.visible !== false),
        adjustable: Boolean(base.adjustable),
        photoDataUrl: base.photoDataUrl || null
      };

      if (typeof p.cx === 'number' && typeof p.cy === 'number') {
        item.x = p.cx;
        item.y = p.cy;
      } else if (typeof p.minX === 'number' && typeof p.minY === 'number') {
        placeFromAABB(item, p.minX, p.minY);
      } else {
        item.x = 60 + (idx % 3) * 40;
        item.y = 80 + Math.floor(idx / 3) * 40;
      }
      return item;
    });
  }

  function applyDefaultProject(preserveSelection = false) {
    const def = deepClone(window.DEFAULT_PROJECT);
    state.room = def.room;
    state.cables = def.cables;
    state.layouts = def.layouts;
    state.activeLayoutId = def.activeLayoutId || 'opt1';
    const activeLayout = state.layouts.find(l => l.id === state.activeLayoutId) || state.layouts[0];
    state.items = buildItemsFromLayout(def.catalog, activeLayout);
    if (!preserveSelection || !state.items.some(i => i.id === state.selectedId)) {
      state.selectedId = state.items[0] ? state.items[0].id : null;
    }
    state.snapGuides = [];
    saveState();
    syncUI();
  }

  function snapshotProjectData() {
    return {
      version: 2,
      app: 'SimpleCAD',
      room: deepClone(state.room),
      cables: deepClone(state.cables),
      items: deepClone(state.items),
      layouts: deepClone(state.layouts),
      activeLayoutId: state.activeLayoutId,
      selectedId: state.selectedId,
      gridStep: state.gridStep,
      wallSnap: state.wallSnap
    };
  }

  function restoreFromSnapshot(snap) {
    state.room = deepClone(snap.room);
    state.cables = deepClone(snap.cables);
    state.items = deepClone(snap.items);
    state.layouts = deepClone(snap.layouts);
    state.activeLayoutId = snap.activeLayoutId;
    state.selectedId = snap.selectedId;
    saveState();
    syncUI();
  }

  function pushUndoSnapshot(snap) {
    const prev = snap || snapshotProjectData();
    history.past.push(prev);
    if (history.past.length > MAX_HISTORY) history.past.shift();
    history.future = [];
    updateHistoryButtons();
  }

  function undo() {
    if (history.past.length === 0) return;
    history.future.push(snapshotProjectData());
    const prev = history.past.pop();
    restoreFromSnapshot(prev);
    updateHistoryButtons();
    showToast('Desfeito');
  }

  function redo() {
    if (history.future.length === 0) return;
    history.past.push(snapshotProjectData());
    const next = history.future.pop();
    restoreFromSnapshot(next);
    updateHistoryButtons();
    showToast('Refeito');
  }

  function updateHistoryButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    u.setAttribute('aria-disabled', history.past.length === 0 ? 'true' : 'false');
    r.setAttribute('aria-disabled', history.future.length === 0 ? 'true' : 'false');
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotProjectData()));
    } catch (_) {
      // Ignore storage quota errors cleanly
    }
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.room || !Array.isArray(parsed.items)) return false;

      state.room = parsed.room;
      state.cables = Array.isArray(parsed.cables) ? parsed.cables : [];
      state.items = parsed.items;
      state.layouts = Array.isArray(parsed.layouts) && parsed.layouts.length
        ? parsed.layouts
        : deepClone(window.DEFAULT_PROJECT.layouts);
      state.activeLayoutId = parsed.activeLayoutId || state.layouts[0].id;
      state.selectedId = parsed.selectedId || (state.items[0] ? state.items[0].id : null);
      state.gridStep = typeof parsed.gridStep === 'number' ? parsed.gridStep : 5;
      state.wallSnap = typeof parsed.wallSnap === 'boolean' ? parsed.wallSnap : true;
      return true;
    } catch (_) {
      return false;
    }
  }

  // =========================================================================
  // 4. OBB GEOMETRY, RESIZE & 4-WALL DOOR MATH
  // =========================================================================
  const DIVIDER_FOLD_PRESETS = {
    flat: [0, 0, 0],
    zigzag: [45, -90, 90],
    'l-right': [0, 90, 0],
    'l-left': [0, -90, 0],
    arc: [25, 25, 25],
    close: [90, 0, -90]
  };

  /**
   * Computes world coordinates of the 5 hinge nodes and 4 panel polygons
   * for an articulated folding divider while preserving its geometric center.
   */
  function getDividerGeometry(item) {
    const segLen = Math.max(8, (Number(item.w) || 145) / 4);
    const thick = Math.max(4, Number(item.h) || 4);
    const folds = sanitizeFoldAngles(item.foldAngles);
    const baseRot = Number(item.rot) || 0;
    const angles = [
      baseRot,
      baseRot + folds[0],
      baseRot + folds[0] + folds[1],
      baseRot + folds[0] + folds[1] + folds[2]
    ];

    const raw = [{ x: 0, y: 0 }];
    for (let i = 0; i < 4; i++) {
      const r = degToRad(angles[i]);
      raw.push({
        x: raw[i].x + Math.cos(r) * segLen,
        y: raw[i].y + Math.sin(r) * segLen
      });
    }

    let sumMidX = 0;
    let sumMidY = 0;
    for (let i = 0; i < 4; i++) {
      sumMidX += (raw[i].x + raw[i + 1].x) * 0.5;
      sumMidY += (raw[i].y + raw[i + 1].y) * 0.5;
    }
    const dx = (item.x || 0) - sumMidX / 4;
    const dy = (item.y || 0) - sumMidY / 4;
    const nodes = raw.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));

    const halfT = thick * 0.5;
    const segments = [];
    for (let i = 0; i < 4; i++) {
      const p0 = nodes[i];
      const p1 = nodes[i + 1];
      const r = degToRad(angles[i]);
      const nx = -Math.sin(r) * halfT;
      const ny = Math.cos(r) * halfT;
      segments.push({
        p0,
        p1,
        cx: (p0.x + p1.x) * 0.5,
        cy: (p0.y + p1.y) * 0.5,
        angle: angles[i],
        len: segLen,
        thick,
        poly: [
          { x: p0.x + nx, y: p0.y + ny },
          { x: p1.x + nx, y: p1.y + ny },
          { x: p1.x - nx, y: p1.y - ny },
          { x: p0.x - nx, y: p0.y - ny }
        ]
      });
    }
    return { nodes, segments, folds };
  }

  function getItemPolygons(item) {
    if (item && item.type === 'divider') {
      return getDividerGeometry(item).segments.map(s => s.poly);
    }
    return [getCorners(item)];
  }

  function getCorners(item) {
    const rad = degToRad(item.rot || 0);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = item.w / 2;
    const hh = item.h / 2;
    const local = [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh }
    ];
    return local.map(pt => ({
      x: item.x + pt.x * cos - pt.y * sin,
      y: item.y + pt.x * sin + pt.y * cos
    }));
  }

  function getAABB(item) {
    const polys = getItemPolygons(item);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pts of polys) {
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    return { minX, maxX, minY, maxY };
  }

  function placeFromAABB(item, minX, minY) {
    const box = getAABB(item);
    item.x = Number((item.x + (minX - box.minX)).toFixed(1));
    item.y = Number((item.y + (minY - box.minY)).toFixed(1));
  }

  function pointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function polygonsOverlap(polyA, polyB) {
    const eps = 0.25; // 2.5mm tolerance for clean flush furniture touching
    const polys = [polyA, polyB];
    for (let p = 0; p < 2; p++) {
      const poly = polys[p];
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const nx = -(poly[j].y - poly[i].y);
        const ny = poly[j].x - poly[i].x;

        let minA = Infinity, maxA = -Infinity;
        for (const v of polyA) {
          const proj = nx * v.x + ny * v.y;
          if (proj < minA) minA = proj;
          if (proj > maxA) maxA = proj;
        }
        let minB = Infinity, maxB = -Infinity;
        for (const v of polyB) {
          const proj = nx * v.x + ny * v.y;
          if (proj < minB) minB = proj;
          if (proj > maxB) maxB = proj;
        }

        const len = Math.hypot(nx, ny) || 1;
        if (maxA - eps * len <= minB || maxB - eps * len <= minA) {
          return false;
        }
      }
    }
    return true;
  }

  function getDoorGeometry(door, room) {
    const W = room.w;
    const H = room.h;
    const r = Number(door.width) || 90;
    const off = Number(door.offset) || 0;
    const hinge = door.hinge === 'right' ? 'right' : 'left';
    const wall = door.wall || 'bottom';

    let hx = 0, hy = 0, closedAngle = 0, openAngle = 0, aStart = 0, aEnd = 0;

    if (wall === 'bottom') {
      hy = H;
      if (hinge === 'left') {
        hx = off;
        closedAngle = 0;
        openAngle = -Math.PI / 2;
        aStart = -Math.PI / 2;
        aEnd = 0;
      } else {
        hx = off + r;
        closedAngle = Math.PI;
        openAngle = (3 * Math.PI) / 2;
        aStart = Math.PI;
        aEnd = (3 * Math.PI) / 2;
      }
    } else if (wall === 'top') {
      hy = 0;
      if (hinge === 'left') {
        hx = off;
        closedAngle = 0;
        openAngle = Math.PI / 2;
        aStart = 0;
        aEnd = Math.PI / 2;
      } else {
        hx = off + r;
        closedAngle = Math.PI;
        openAngle = Math.PI / 2;
        aStart = Math.PI / 2;
        aEnd = Math.PI;
      }
    } else if (wall === 'left') {
      hx = 0;
      if (hinge === 'left') {
        hy = off;
        closedAngle = Math.PI / 2;
        openAngle = 0;
        aStart = 0;
        aEnd = Math.PI / 2;
      } else {
        hy = off + r;
        closedAngle = -Math.PI / 2;
        openAngle = 0;
        aStart = -Math.PI / 2;
        aEnd = 0;
      }
    } else {
      // right wall
      hx = W;
      if (hinge === 'left') {
        hy = off;
        closedAngle = Math.PI / 2;
        openAngle = Math.PI;
        aStart = Math.PI / 2;
        aEnd = Math.PI;
      } else {
        hy = off + r;
        closedAngle = (3 * Math.PI) / 2;
        openAngle = Math.PI;
        aStart = Math.PI;
        aEnd = (3 * Math.PI) / 2;
      }
    }

    return {
      hx,
      hy,
      r,
      closedAngle,
      openAngle,
      aStart,
      aEnd,
      openEnd: { x: hx + Math.cos(openAngle) * r, y: hy + Math.sin(openAngle) * r },
      closedEnd: { x: hx + Math.cos(closedAngle) * r, y: hy + Math.sin(closedAngle) * r }
    };
  }

  function angleInArc(angle, aStart, aEnd) {
    const TWO_PI = Math.PI * 2;
    const norm = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;
    const s = norm(aStart);
    const e = norm(aEnd);
    const a = norm(angle);
    const eps = 0.015;
    if (s <= e) return a >= s - eps && a <= e + eps;
    return a >= s - eps || a <= e + eps;
  }

  function segmentsIntersect(a1, a2, b1, b2) {
    const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
  }

  function hitsDoorSwing(poly, door, room) {
    const g = getDoorGeometry(door, room);
    const hingePt = { x: g.hx, y: g.hy };

    // 1. Hinge inside furniture
    if (pointInPolygon(hingePt, poly)) return true;

    // 2. Any corner inside circular sector
    for (const p of poly) {
      const dist = Math.hypot(p.x - g.hx, p.y - g.hy);
      if (dist < g.r - 0.5) {
        const ang = Math.atan2(p.y - g.hy, p.x - g.hx);
        if (angleInArc(ang, g.aStart, g.aEnd)) return true;
      }
    }

    // 3. Edges against radial segments & circular arc (sampled robustly along each edge)
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (segmentsIntersect(p1, p2, hingePt, g.openEnd)) return true;

      const steps = 16;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const sx = p1.x + (p2.x - p1.x) * t;
        const sy = p1.y + (p2.y - p1.y) * t;
        const d = Math.hypot(sx - g.hx, sy - g.hy);
        if (d < g.r - 0.5) {
          const ang = Math.atan2(sy - g.hy, sx - g.hx);
          if (angleInArc(ang, g.aStart, g.aEnd)) return true;
        }
      }
    }
    return false;
  }

  function computeCollisions() {
    const bad = new Set();
    const messages = [];
    const vis = state.items.filter(i => i.visible);

    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      const polysA = getItemPolygons(a);
      const boxA = getAABB(a);

      if (boxA.minX < -0.4 || boxA.maxX > state.room.w + 0.4 || boxA.minY < -0.4 || boxA.maxY > state.room.h + 0.4) {
        bad.add(a.id);
        messages.push(`Fora dos limites: ${a.name}`);
      }

      if (a.ignoreCollision) continue;

      for (const door of state.room.doors) {
        if (polysA.some(polyA => hitsDoorSwing(polyA, door, state.room))) {
          bad.add(a.id);
          messages.push(`Bloqueia porta (${door.width}cm): ${a.name}`);
          break;
        }
      }

      for (let j = i + 1; j < vis.length; j++) {
        const b = vis[j];
        if (b.ignoreCollision) continue;
        const polysB = getItemPolygons(b);
        let hit = false;
        for (const polyA of polysA) {
          for (const polyB of polysB) {
            if (polygonsOverlap(polyA, polyB)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          bad.add(a.id);
          bad.add(b.id);
          messages.push(`${a.name} ↔ ${b.name}`);
        }
      }
    }
    return { bad, messages };
  }

  function computeClearances(target) {
    const box = getAABB(target);
    const midX = (box.minX + box.maxX) / 2;
    const midY = (box.minY + box.maxY) / 2;

    let nStop = 0;
    let sStop = state.room.h;
    let wStop = 0;
    let eStop = state.room.w;

    for (const other of state.items) {
      if (!other.visible || other.id === target.id || other.ignoreCollision) continue;
      const ob = getAABB(other);

      if (ob.maxX > box.minX + 1 && ob.minX < box.maxX - 1) {
        if (ob.maxY <= box.minY + 0.5 && ob.maxY > nStop) nStop = ob.maxY;
        if (ob.minY >= box.maxY - 0.5 && ob.minY < sStop) sStop = ob.minY;
      }
      if (ob.maxY > box.minY + 1 && ob.minY < box.maxY - 1) {
        if (ob.maxX <= box.minX + 0.5 && ob.maxX > wStop) wStop = ob.maxX;
        if (ob.minX >= box.maxX - 0.5 && ob.minX < eStop) eStop = ob.minX;
      }
    }

    return {
      N: { from: { x: midX, y: box.minY }, to: { x: midX, y: nStop }, dist: Math.max(0, box.minY - nStop) },
      S: { from: { x: midX, y: box.maxY }, to: { x: midX, y: sStop }, dist: Math.max(0, sStop - box.maxY) },
      W: { from: { x: box.minX, y: midY }, to: { x: wStop, y: midY }, dist: Math.max(0, box.minX - wStop) },
      E: { from: { x: box.maxX, y: midY }, to: { x: eStop, y: midY }, dist: Math.max(0, eStop - box.maxX) }
    };
  }

  function roundItemCornerToCm(item) {
    const box = getAABB(item);
    const rx = Math.round(box.minX);
    const ry = Math.round(box.minY);
    item.x = Number((item.x + (rx - box.minX)).toFixed(1));
    item.y = Number((item.y + (ry - box.minY)).toFixed(1));
  }

  function checkAxisCenter(targetId, minPos, boxSize, gapStart, gapEnd, roomSize, startDist, endDist, axis) {
    const tol = 0.6;
    const gapTargetMin = Math.round(gapStart + ((gapEnd - gapStart) - boxSize) / 2);
    const roomTargetMin = Math.round((roomSize - boxSize) / 2);

    if (Math.abs(minPos - gapTargetMin) <= tol) {
      const d1 = Math.round(startDist);
      const d2 = Math.round(endDist);
      const isRoom = gapStart === 0 && gapEnd === roomSize;
      return {
        kind: isRoom ? 'room' : 'gap',
        axisPos: (gapStart + gapEnd) / 2,
        d1,
        d2,
        rounded: Math.abs(d1 - d2) === 1
      };
    }

    if (Math.abs(minPos - roomTargetMin) <= tol) {
      const d1 = Math.round(minPos);
      const d2 = Math.round(roomSize - (minPos + boxSize));
      return {
        kind: 'room',
        axisPos: roomSize / 2,
        d1,
        d2,
        rounded: Math.abs(d1 - d2) === 1
      };
    }

    for (const other of state.items) {
      if (!other.visible || other.id === targetId || other.ignoreCollision) continue;
      const ob = getAABB(other);
      const oc = axis === 'x' ? (ob.minX + ob.maxX) / 2 : (ob.minY + ob.maxY) / 2;
      const otherTargetMin = Math.round(oc - boxSize / 2);
      if (Math.abs(minPos - otherTargetMin) <= tol) {
        return { kind: 'item', axisPos: oc, otherName: other.name, rounded: false };
      }
    }
    return null;
  }

  function computeCenteringInfo(target) {
    const box = getAABB(target);
    const boxW = Math.round(box.maxX - box.minX);
    const boxH = Math.round(box.maxY - box.minY);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const clr = computeClearances(target);

    const gapTargetMinX = Math.round(clr.W.to.x + ((clr.E.to.x - clr.W.to.x) - boxW) / 2);
    const gapTargetMinY = Math.round(clr.N.to.y + ((clr.S.to.y - clr.N.to.y) - boxH) / 2);
    const roomTargetMinX = Math.round((state.room.w - boxW) / 2);
    const roomTargetMinY = Math.round((state.room.h - boxH) / 2);

    const cxRes = checkAxisCenter(target.id, box.minX, boxW, clr.W.to.x, clr.E.to.x, state.room.w, clr.W.dist, clr.E.dist, 'x');
    const cyRes = checkAxisCenter(target.id, box.minY, boxH, clr.N.to.y, clr.S.to.y, state.room.h, clr.N.dist, clr.S.dist, 'y');

    const centeredX = cxRes ? { kind: cxRes.kind, axisX: cxRes.axisPos, leftCm: cxRes.d1, rightCm: cxRes.d2, otherName: cxRes.otherName, rounded: cxRes.rounded } : null;
    const centeredY = cyRes ? { kind: cyRes.kind, axisY: cyRes.axisPos, topCm: cyRes.d1, botCm: cyRes.d2, otherName: cyRes.otherName, rounded: cyRes.rounded } : null;

    return { box, boxW, boxH, cx, cy, clr, gapTargetMinX, gapTargetMinY, roomTargetMinX, roomTargetMinY, centeredX, centeredY };
  }

  // =========================================================================
  // 5. CABLES ROUTING & LENGTH CALCULATION
  // =========================================================================
  function resolveEndpoint(endpointId) {
    const item = state.items.find(i => i.id === endpointId && i.visible);
    if (item) return { x: item.x, y: item.y, name: item.name, kind: 'item' };
    const outlet = state.room.outlets.find(o => o.id === endpointId);
    if (outlet) {
      const coords = getOutletCoords(outlet);
      return { x: coords.x, y: coords.y, name: `Tomada ${outlet.name}`, kind: 'outlet' };
    }
    return null;
  }

  function getOutletCoords(outlet) {
    const W = state.room.w;
    const H = state.room.h;
    const p = Number(outlet.pos) || 0;
    if (outlet.wall === 'left') return { x: 0, y: Math.min(H, Math.max(0, p)) };
    if (outlet.wall === 'right') return { x: W, y: Math.min(H, Math.max(0, p)) };
    if (outlet.wall === 'top') return { x: Math.min(W, Math.max(0, p)), y: 0 };
    return { x: Math.min(W, Math.max(0, p)), y: H };
  }

  function computeCableStats(cable) {
    const a = resolveEndpoint(cable.fromId);
    const b = resolveEndpoint(cable.toId);
    if (!a || !b) return null;

    let distCm = 0;
    if (cable.routingMode === 'wall') {
      // Manhattan perimeter approximation with 10% routing margin
      distCm = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) * 1.1;
    } else {
      // Direct Euclidean + 5% vertical drop slack
      distCm = Math.hypot(b.x - a.x, b.y - a.y) * 1.05;
    }

    const meters = distCm / 100;
    const maxM = Number(cable.maxMeters) || 3.0;
    const warnM = Number(cable.warnMeters) || maxM * 0.85;
    let status = 'ok';
    if (meters > maxM) status = 'bad';
    else if (meters > warnM) status = 'warn';

    return { a, b, meters, maxM, warnM, status };
  }

  // =========================================================================
  // 6. SMART MAGNETIC SNAPPING & RESIZE ANCHOR MATH
  // =========================================================================
  function applySnapping(item) {
    state.snapGuides = [];

    // 1. Grid snap
    if (state.gridStep > 0) {
      const box = getAABB(item);
      const snapMinX = Math.round(box.minX / state.gridStep) * state.gridStep;
      const snapMinY = Math.round(box.minY / state.gridStep) * state.gridStep;
      item.x += snapMinX - box.minX;
      item.y += snapMinY - box.minY;
    }

    if (state.wallSnap) {
      const wallThresh = 6;
      const itemThresh = 5;
      let bestDx = null;
      let bestDy = null;
      let bestAbsX = wallThresh + 0.1;
      let bestAbsY = wallThresh + 0.1;
      let guideX = null;
      let guideY = null;

      const cInfo = computeCenteringInfo(item);
      const box = cInfo.box;
      const { boxW, boxH, clr } = cInfo;

      // Room walls + deterministic room/gap centering snap
      const xRoomAndCenter = [
        { delta: -box.minX, pos: 0 },
        { delta: state.room.w - box.maxX, pos: state.room.w },
        { delta: cInfo.gapTargetMinX - box.minX, pos: (clr.W.to.x + clr.E.to.x) / 2 },
        { delta: cInfo.roomTargetMinX - box.minX, pos: state.room.w / 2 }
      ];
      for (const c of xRoomAndCenter) {
        const ad = Math.abs(c.delta);
        if (ad < bestAbsX) { bestAbsX = ad; bestDx = c.delta; guideX = c.pos; }
      }

      const yRoomAndCenter = [
        { delta: -box.minY, pos: 0 },
        { delta: state.room.h - box.maxY, pos: state.room.h },
        { delta: cInfo.gapTargetMinY - box.minY, pos: (clr.N.to.y + clr.S.to.y) / 2 },
        { delta: cInfo.roomTargetMinY - box.minY, pos: state.room.h / 2 }
      ];
      for (const c of yRoomAndCenter) {
        const ad = Math.abs(c.delta);
        if (ad < bestAbsY) { bestAbsY = ad; bestDy = c.delta; guideY = c.pos; }
      }

      // Furniture-to-furniture edge & alignment snap
      for (const other of state.items) {
        if (!other.visible || other.id === item.id || other.ignoreCollision) continue;
        const ob = getAABB(other);
        const ocx = (ob.minX + ob.maxX) / 2;
        const ocy = (ob.minY + ob.maxY) / 2;

        const xCandidates = [
          { delta: ob.maxX - box.minX, pos: ob.maxX }, // flush left-to-right
          { delta: ob.minX - box.maxX, pos: ob.minX }, // flush right-to-left
          { delta: ob.minX - box.minX, pos: ob.minX }, // align left edges
          { delta: ob.maxX - box.maxX, pos: ob.maxX }, // align right edges
          { delta: Math.round(ocx - boxW / 2) - box.minX, pos: ocx } // align centers X
        ];
        for (const c of xCandidates) {
          const ad = Math.abs(c.delta);
          if (ad <= itemThresh && ad < bestAbsX) {
            bestAbsX = ad;
            bestDx = c.delta;
            guideX = c.pos;
          }
        }

        const yCandidates = [
          { delta: ob.maxY - box.minY, pos: ob.maxY },
          { delta: ob.minY - box.maxY, pos: ob.minY },
          { delta: ob.minY - box.minY, pos: ob.minY },
          { delta: ob.maxY - box.maxY, pos: ob.maxY },
          { delta: Math.round(ocy - boxH / 2) - box.minY, pos: ocy }
        ];
        for (const c of yCandidates) {
          const ad = Math.abs(c.delta);
          if (ad <= itemThresh && ad < bestAbsY) {
            bestAbsY = ad;
            bestDy = c.delta;
            guideY = c.pos;
          }
        }
      }

      if (bestDx !== null) {
        item.x += bestDx;
        if (guideX !== null) state.snapGuides.push({ axis: 'x', val: guideX });
      }
      if (bestDy !== null) {
        item.y += bestDy;
        if (guideY !== null) state.snapGuides.push({ axis: 'y', val: guideY });
      }
    }

    roundItemCornerToCm(item);
  }

  function applyAnchoredResize(item, startItem, handle, dxWorld, dyWorld, preserveAspect) {
    const rad = degToRad(startItem.rot || 0);
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const vx = -Math.sin(rad);
    const vy = Math.cos(rad);

    // Projections of world pointer delta onto item's local width (u) and depth (v) unit axes
    const projU = dxWorld * ux + dyWorld * uy;
    const projV = dxWorld * vx + dyWorld * vy;

    let dW = 0;
    let dH = 0;
    let signU = 0; // +1 if East side moves, -1 if West side moves
    let signV = 0; // +1 if South side moves, -1 if North side moves

    if (handle.includes('e')) { dW = projU; signU = 1; }
    if (handle.includes('w')) { dW = -projU; signU = -1; }
    if (handle.includes('s')) { dH = projV; signV = 1; }
    if (handle.includes('n')) { dH = -projV; signV = -1; }

    if (preserveAspect && signU !== 0 && signV !== 0 && startItem.w > 0) {
      const ratio = startItem.h / startItem.w;
      if (Math.abs(dW) >= Math.abs(dH)) dH = dW * ratio;
      else dW = dH / ratio;
    }

    const snapInc = state.gridStep > 0 ? state.gridStep : 1;
    let newW = Math.max(10, Math.min(600, Math.round((startItem.w + dW) / snapInc) * snapInc));
    let newH = Math.max(4, Math.min(600, Math.round((startItem.h + dH) / snapInc) * snapInc));

    const actualDW = signU !== 0 ? (newW - startItem.w) : 0;
    const actualDH = signV !== 0 ? (newH - startItem.h) : 0;

    // Shift center by half the dimension change along the moving axis so opposite edge stays invariant
    const shiftU = signU * (actualDW / 2);
    const shiftV = signV * (actualDH / 2);

    item.w = newW;
    item.h = newH;
    item.x = Number((startItem.x + shiftU * ux + shiftV * vx).toFixed(1));
    item.y = Number((startItem.y + shiftU * uy + shiftV * vy).toFixed(1));
    if ((Math.round(item.rot || 0) % 90) === 0) {
      roundItemCornerToCm(item);
    }
  }

  // =========================================================================
  // 7. CANVAS VIEWPORT, HANDLES & RENDERING
  // =========================================================================
  function onResize() {
    const rect = viewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    positionHUD();
  }

  function updateTransform(vw, vh) {
    const padSide = vw < 640 ? 32 : 68;
    const hudVisible = hudEl && !hudEl.classList.contains('hidden');
    const hudBottom = hudVisible ? (hudEl.offsetTop + hudEl.offsetHeight) : 0;
    const padTop = Math.max(vw < 640 ? 58 : 108, hudBottom > 0 ? hudBottom + 42 : 0);
    const padBot = vw < 640 ? 76 : 98;
    const availW = Math.max(120, vw - padSide * 2);
    const availH = Math.max(120, vh - padTop - padBot);
    const baseScale = Math.min(availW / state.room.w, availH / state.room.h);
    view.scale = Math.max(0.25, baseScale * state.zoom);
    view.ox = (vw - state.room.w * view.scale) / 2 + state.panX;
    view.oy = padTop + (availH - state.room.h * view.scale) / 2 + state.panY;
  }

  function toScreen(wx, wy) {
    return { x: view.ox + wx * view.scale, y: view.oy + wy * view.scale };
  }

  function toWorld(sx, sy) {
    return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
  }

  const ICON_FIT = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  const ICON_ROUTE_DIRECT = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="5" r="2.2"/><path d="M6.8 17.2L17.2 6.8"/></svg>';
  const ICON_ROUTE_WALL = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="5" r="2.2"/><polyline points="5 16.8 5 5 16.8 5"/></svg>';

  function setZoomLabel(z) {
    const el = document.getElementById('zoom-label');
    if (!el) return;
    if (z === 1) el.innerHTML = ICON_FIT;
    else el.textContent = `${Math.round(z * 100)}%`;
  }

  function zoomBy(delta) {
    cancelActiveAnim();
    if (state.viewMode === '3d') {
      state.cam3d.zoom = Math.max(0.45, Math.min(3.5, Number((state.cam3d.zoom + delta).toFixed(2))));
      setZoomLabel(state.cam3d.zoom);
      draw();
      positionHUD();
      return;
    }
    state.zoom = Math.max(0.4, Math.min(4.5, Number((state.zoom + delta).toFixed(2))));
    setZoomLabel(state.zoom);
    draw();
    positionHUD();
  }

  function resetCamera() {
    if (state.viewMode === '3d') {
      const s = { ...state.cam3d };
      const dyaw = shortAngleDelta(s.yaw, -38);
      animateTransition(280, (t) => {
        state.cam3d.yaw = s.yaw + dyaw * t;
        state.cam3d.pitch = s.pitch + (46 - s.pitch) * t;
        state.cam3d.zoom = s.zoom + (1 - s.zoom) * t;
        state.cam3d.panX = s.panX * (1 - t);
        state.cam3d.panY = s.panY * (1 - t);
        setZoomLabel(t === 1 ? 1 : state.cam3d.zoom);
      }, () => {
        state.cam3d = { yaw: -38, pitch: 46, zoom: 1, panX: 0, panY: 0 };
        setZoomLabel(1);
        draw();
      });
      return;
    }

    const sz = state.zoom, spx = state.panX, spy = state.panY;
    animateTransition(240, (t) => {
      state.zoom = sz + (1 - sz) * t;
      state.panX = spx * (1 - t);
      state.panY = spy * (1 - t);
      setZoomLabel(t === 1 ? 1 : state.zoom);
    }, () => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      setZoomLabel(1);
      draw();
      positionHUD();
    });
  }

  function getHandleScreenPositions(item) {
    const center = toScreen(item.x, item.y);
    const rad = degToRad(item.rot || 0);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = (item.w * view.scale) / 2;
    const hh = (item.h * view.scale) / 2;

    const toS = (lx, ly) => ({
      x: center.x + lx * cos - ly * sin,
      y: center.y + lx * sin + ly * cos
    });

    if (item.type === 'divider') {
      const box = getAABB(item);
      const topCenter = toScreen((box.minX + box.maxX) * 0.5, box.minY);
      const geom = getDividerGeometry(item);
      const handles = [
        { id: 'rot', x: topCenter.x, y: topCenter.y - 26, cursor: 'grab' }
      ];
      geom.nodes.forEach((pt, idx) => {
        const sp = toScreen(pt.x, pt.y);
        handles.push({
          id: `node_${idx}`,
          type: 'fold-node',
          nodeIndex: idx,
          x: sp.x,
          y: sp.y,
          cursor: 'grab'
        });
      });
      return handles;
    }

    const handles = [
      { id: 'rot', ...toS(0, -hh - 26), cursor: 'grab' }
    ];

    if (!item.lockedDims) {
      handles.push(
        { id: 'n',  ...toS(0, -hh),  cursor: 'ns-resize' },
        { id: 's',  ...toS(0, hh),   cursor: 'ns-resize' },
        { id: 'w',  ...toS(-hw, 0),  cursor: 'ew-resize' },
        { id: 'e',  ...toS(hw, 0),   cursor: 'ew-resize' },
        { id: 'nw', ...toS(-hw, -hh), cursor: 'nwse-resize' },
        { id: 'ne', ...toS(hw, -hh),  cursor: 'nesw-resize' },
        { id: 'se', ...toS(hw, hh),   cursor: 'nwse-resize' },
        { id: 'sw', ...toS(-hw, hh),  cursor: 'nesw-resize' }
      );
    }
    return handles;
  }

  function setViewMode(mode) {
    if (mode !== '2d' && mode !== 'cables' && mode !== '3d') return;
    cancelActiveAnim();
    state.viewMode = mode;
    if (mode === 'cables' && !isReducedMotion()) {
      ensureCableAnimLoop();
    } else if (state.cableAnimRaf) {
      cancelAnimationFrame(state.cableAnimRaf);
      state.cableAnimRaf = null;
    }
    syncUI();
  }

  function ensureCableAnimLoop() {
    if (state.cableAnimRaf || state.viewMode !== 'cables' || isReducedMotion()) return;
    const tick = () => {
      if (state.viewMode !== 'cables' || isReducedMotion()) {
        state.cableAnimRaf = null;
        return;
      }
      draw();
      state.cableAnimRaf = requestAnimationFrame(tick);
    };
    state.cableAnimRaf = requestAnimationFrame(tick);
  }

  function drawSceneToContext(targetCtx, widthPx, heightPx, targetView, theme = 'dark') {
    const isLight = theme === 'blueprint';
    if (!isLight && state.viewMode === '3d') {
      drawScene3D(targetCtx, widthPx, heightPx);
      return;
    }

    const isCableMode = !isLight && state.viewMode === 'cables';
    const s = targetView.scale;
    const ox = targetView.ox;
    const oy = targetView.oy;
    const rw = state.room.w * s;
    const rh = state.room.h * s;

    targetCtx.fillStyle = isLight ? '#ffffff' : '#0d0e10';
    targetCtx.fillRect(0, 0, widthPx, heightPx);

    // Room floor
    targetCtx.fillStyle = isLight ? '#f8fafc' : '#121316';
    targetCtx.fillRect(ox, oy, rw, rh);

    // Technical Grid (10cm minor, 50cm major)
    targetCtx.lineWidth = 1;
    for (let x = 0; x <= state.room.w; x += 10) {
      const px = Math.round(ox + x * s) + 0.5;
      targetCtx.strokeStyle = isLight
        ? (x % 50 === 0 ? '#cbd5e1' : '#e2e8f0')
        : (x % 50 === 0 ? '#27272a' : '#16161a');
      targetCtx.beginPath();
      targetCtx.moveTo(px, oy);
      targetCtx.lineTo(px, oy + rh);
      targetCtx.stroke();
    }
    for (let y = 0; y <= state.room.h; y += 10) {
      const py = Math.round(oy + y * s) + 0.5;
      targetCtx.strokeStyle = isLight
        ? (y % 50 === 0 ? '#cbd5e1' : '#e2e8f0')
        : (y % 50 === 0 ? '#27272a' : '#16161a');
      targetCtx.beginPath();
      targetCtx.moveTo(ox, py);
      targetCtx.lineTo(ox + rw, py);
      targetCtx.stroke();
    }

    const { bad: collisions } = computeCollisions();
    const mapScreen = (wx, wy) => ({ x: ox + wx * s, y: oy + wy * s });

    // Doors
    for (const door of state.room.doors) {
      const g = getDoorGeometry(door, state.room);
      const ho = mapScreen(g.hx, g.hy);
      const rPx = g.r * s;
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.moveTo(ho.x, ho.y);
      targetCtx.arc(ho.x, ho.y, rPx, g.aStart, g.aEnd, false);
      targetCtx.closePath();
      targetCtx.fillStyle = isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(245, 158, 11, 0.08)';
      targetCtx.fill();
      targetCtx.setLineDash([4, 4]);
      targetCtx.strokeStyle = '#d97706';
      targetCtx.lineWidth = 1.25;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      const openPt = mapScreen(g.openEnd.x, g.openEnd.y);
      targetCtx.beginPath();
      targetCtx.moveTo(ho.x, ho.y);
      targetCtx.lineTo(openPt.x, openPt.y);
      targetCtx.strokeStyle = '#f59e0b';
      targetCtx.lineWidth = 2.6;
      targetCtx.stroke();

      targetCtx.fillStyle = '#d97706';
      targetCtx.font = '600 9px "JetBrains Mono", Consolas, monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(`PORTA ${door.width}cm`, (ho.x + openPt.x) / 2 + 28, (ho.y + openPt.y) / 2);
      targetCtx.restore();
    }

    // Outer walls
    targetCtx.strokeStyle = isLight ? '#0f172a' : '#71717a';
    targetCtx.lineWidth = 2.5;
    targetCtx.strokeRect(ox, oy, rw, rh);

    // Windows
    for (const win of state.room.windows) {
      const off = Number(win.offset) || 0;
      const wLen = Number(win.width) || 100;
      targetCtx.save();
      let wx1, wy1, ww, wh, tx, ty;
      if (win.wall === 'top' || win.wall === 'bottom') {
        const yPos = win.wall === 'top' ? 0 : state.room.h;
        const p = mapScreen(off, yPos);
        wx1 = p.x; wy1 = p.y - 3; ww = wLen * s; wh = 6;
        tx = p.x + ww / 2;
        ty = win.wall === 'top' ? p.y - 8 : p.y + 15;
      } else {
        const xPos = win.wall === 'left' ? 0 : state.room.w;
        const p = mapScreen(xPos, off);
        wx1 = p.x - 3; wy1 = p.y; ww = 6; wh = wLen * s;
        tx = win.wall === 'left' ? p.x - 10 : p.x + 10;
        ty = p.y + wh / 2;
      }
      targetCtx.fillStyle = isLight ? '#ffffff' : '#0d0e10';
      targetCtx.fillRect(wx1, wy1, ww, wh);
      targetCtx.strokeStyle = '#6b93b8';
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(wx1, wy1, ww, wh);
      targetCtx.fillStyle = isLight ? '#4a6f94' : '#8cb0d1';
      targetCtx.font = '600 9px "JetBrains Mono", Consolas, monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(`${win.name || 'JANELA'} ${wLen}cm`, tx, ty);
      targetCtx.restore();
    }

    // Outlets
    for (const out of state.room.outlets) {
      const oc = getOutletCoords(out);
      const p = mapScreen(oc.x, oc.y);
      if (isCableMode) {
        targetCtx.beginPath();
        targetCtx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(250, 204, 21, 0.16)';
        targetCtx.fill();
        targetCtx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        targetCtx.lineWidth = 1;
        targetCtx.stroke();
      }
      const rSq = isCableMode ? 5 : 3.5;
      targetCtx.fillStyle = '#eab308';
      targetCtx.fillRect(p.x - rSq, p.y - rSq, rSq * 2, rSq * 2);
      targetCtx.font = isCableMode ? '700 10.5px "JetBrains Mono", Consolas, monospace' : '600 9.5px "JetBrains Mono", Consolas, monospace';
      targetCtx.fillStyle = isLight ? '#b45309' : '#facc15';
      if (out.wall === 'left') {
        targetCtx.textAlign = 'right';
        targetCtx.fillText(out.name || out.id, p.x - (isCableMode ? 10 : 7), p.y + 3);
      } else if (out.wall === 'right') {
        targetCtx.textAlign = 'left';
        targetCtx.fillText(out.name || out.id, p.x + (isCableMode ? 10 : 7), p.y + 3);
      } else if (out.wall === 'top') {
        targetCtx.textAlign = 'center';
        targetCtx.fillText(out.name || out.id, p.x, p.y - (isCableMode ? 11 : 8));
      } else {
        targetCtx.textAlign = 'center';
        targetCtx.fillText(out.name || out.id, p.x, p.y + (isCableMode ? 16 : 13));
      }
    }

    // Room Outer Dimensions
    targetCtx.strokeStyle = isLight ? '#64748b' : '#52525b';
    targetCtx.fillStyle = isLight ? '#334155' : '#a1a1aa';
    targetCtx.font = '600 10px "JetBrains Mono", Consolas, monospace';
    targetCtx.lineWidth = 1;

    const dimY = oy + rh + 18;
    targetCtx.beginPath();
    targetCtx.moveTo(ox, dimY);
    targetCtx.lineTo(ox + rw, dimY);
    targetCtx.stroke();
    targetCtx.textAlign = 'center';
    targetCtx.fillText(`${state.room.w} cm (${(state.room.w / 100).toFixed(2)} m)`, ox + rw / 2, dimY + 13);

    const dimX = ox + rw + 18;
    targetCtx.beginPath();
    targetCtx.moveTo(dimX, oy);
    targetCtx.lineTo(dimX, oy + rh);
    targetCtx.stroke();
    targetCtx.save();
    targetCtx.translate(dimX + 12, oy + rh / 2);
    targetCtx.rotate(Math.PI / 2);
    targetCtx.fillText(`${state.room.h} cm (${(state.room.h / 100).toFixed(2)} m)`, 0, 0);
    targetCtx.restore();

    // Draw Rugs / Ignore-Collision Layer First, Then Normal Items, Selected On Top
    const ordered = [...state.items].sort((a, b) => {
      if (a.id === state.selectedId) return 1;
      if (b.id === state.selectedId) return -1;
      if (a.ignoreCollision !== b.ignoreCollision) return a.ignoreCollision ? -1 : 1;
      return 0;
    });

    targetCtx.save();
    if (isCableMode) targetCtx.globalAlpha = 0.24;
    for (const item of ordered) {
      if (!item.visible) continue;
      drawFurnitureItem(targetCtx, item, mapScreen, s, item.id === state.selectedId && !isLight && !isCableMode, collisions.has(item.id), isLight);
    }
    targetCtx.restore();

    // Selected Item Guides & Direct Handles (only in live interactive viewport)
    if (!isLight && !isCableMode) {
      const sel = state.items.find(i => i.id === state.selectedId && i.visible);
      if (sel) {
        drawClearanceGuides(targetCtx, sel, mapScreen);
        drawSelectionHandles(targetCtx, sel);
      }

      // Snap Alignment Guides
      for (const g of state.snapGuides) {
        targetCtx.save();
        targetCtx.setLineDash([4, 4]);
        targetCtx.strokeStyle = '#c8a96e';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        if (g.axis === 'x') {
          const px = mapScreen(g.val, 0).x;
          targetCtx.moveTo(px, oy - 12);
          targetCtx.lineTo(px, oy + rh + 12);
        } else {
          const py = mapScreen(0, g.val).y;
          targetCtx.moveTo(ox - 12, py);
          targetCtx.lineTo(ox + rw + 12, py);
        }
        targetCtx.stroke();
        targetCtx.restore();
      }
    }

    // Cables
    for (const cable of state.cables) {
      if (!cable.visible) continue;
      const stats = computeCableStats(cable);
      if (stats) drawCableLine(targetCtx, cable, stats, mapScreen, isLight);
    }

    // Measure Tool Overlay
    if (!isLight && state.measurePts.length > 0) {
      drawMeasureOverlay(targetCtx, mapScreen);
    }
  }

  function get3DTransform(widthPx, heightPx) {
    const rw = state.room.w || 270;
    const rh = state.room.h || 475;
    const cam = state.cam3d;
    const scale = Math.min(widthPx / Math.max(260, rw * 1.48), heightPx / Math.max(320, rh * 1.25)) * cam.zoom;
    return {
      cx: rw * 0.5,
      cy: rh * 0.5,
      yawRad: degToRad(cam.yaw),
      pitchRad: degToRad(Math.max(14, Math.min(82, cam.pitch))),
      scale,
      sxMid: widthPx * 0.5 + cam.panX,
      syMid: heightPx * 0.52 + cam.panY
    };
  }

  function project3D(wx, wy, wz, t) {
    const dx = wx - t.cx;
    const dy = wy - t.cy;
    const cY = Math.cos(t.yawRad);
    const sY = Math.sin(t.yawRad);
    const sP = Math.sin(t.pitchRad);
    const cP = Math.cos(t.pitchRad);
    const rx = dx * cY - dy * sY;
    const ry = dx * sY + dy * cY;
    const sy = ry * sP - wz * cP;
    const depth = ry * cP + wz * sP;
    return {
      x: t.sxMid + rx * t.scale,
      y: t.syMid + sy * t.scale,
      depth
    };
  }

  function unproject3DPlane(sx, sy, widthPx, heightPx, planeZ = 0) {
    const t = get3DTransform(widthPx, heightPx);
    const cY = Math.cos(t.yawRad);
    const sY = Math.sin(t.yawRad);
    const sP = Math.max(0.18, Math.sin(t.pitchRad));
    const cP = Math.cos(t.pitchRad);
    const rx = (sx - t.sxMid) / t.scale;
    const ry = ((sy - t.syMid) / t.scale + (Number(planeZ) || 0) * cP) / sP;
    return {
      x: t.cx + rx * cY + ry * sY,
      y: t.cy - rx * sY + ry * cY
    };
  }

  function unproject3DFloor(sx, sy, widthPx, heightPx) {
    return unproject3DPlane(sx, sy, widthPx, heightPx, 0);
  }

  function hitTestHandles3D(sx, sy) {
    if (!state.handleHits3D || !state.handleHits3D.length) return null;
    let best = null;
    let bestDist = 15;
    for (const h of state.handleHits3D) {
      const d = Math.hypot(sx - h.x, sy - h.y);
      if (d <= bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  function pointInPoly2D(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const hit = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function hitTest3D(sx, sy) {
    for (let i = state.hitRegions3D.length - 1; i >= 0; i--) {
      const reg = state.hitRegions3D[i];
      if (pointInPoly2D(sx, sy, reg.pts)) {
        return state.items.find(it => it.id === reg.itemId) || null;
      }
    }
    return null;
  }

  const RGB_3D_PALETTE = {
    zinc:    [118, 115, 108],
    sky:     [82, 110, 138],
    emerald: [84, 124, 108],
    amber:   [172, 140, 86],
    violet:  [124, 110, 96],
    rose:    [176, 86, 86]
  };

  function shadeRgb(rgb, factor, alpha = 0.92) {
    const r = Math.min(255, Math.round(rgb[0] * factor));
    const g = Math.min(255, Math.round(rgb[1] * factor));
    const b = Math.min(255, Math.round(rgb[2] * factor));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawScene3D(targetCtx, widthPx, heightPx) {
    targetCtx.fillStyle = '#0d0e10';
    targetCtx.fillRect(0, 0, widthPx, heightPx);

    const t = get3DTransform(widthPx, heightPx);
    const W = state.room.w;
    const H = state.room.h;
    const WALL_Z = 240;
    const p3 = (wx, wy, wz) => project3D(wx, wy, wz, t);

    // 1. Floor Base & Grid
    const fl = [p3(0, 0, 0), p3(W, 0, 0), p3(W, H, 0), p3(0, H, 0)];
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(fl[0].x, fl[0].y);
    targetCtx.lineTo(fl[1].x, fl[1].y);
    targetCtx.lineTo(fl[2].x, fl[2].y);
    targetCtx.lineTo(fl[3].x, fl[3].y);
    targetCtx.closePath();
    targetCtx.fillStyle = '#111116';
    targetCtx.fill();
    targetCtx.strokeStyle = '#3f3f46';
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();

    // 50cm floor grid lines
    targetCtx.lineWidth = 1;
    targetCtx.strokeStyle = '#1e1e26';
    for (let x = 50; x < W; x += 50) {
      const a = p3(x, 0, 0);
      const b = p3(x, H, 0);
      targetCtx.beginPath();
      targetCtx.moveTo(a.x, a.y);
      targetCtx.lineTo(b.x, b.y);
      targetCtx.stroke();
    }
    for (let y = 50; y < H; y += 50) {
      const a = p3(0, y, 0);
      const b = p3(W, y, 0);
      targetCtx.beginPath();
      targetCtx.moveTo(a.x, a.y);
      targetCtx.lineTo(b.x, b.y);
      targetCtx.stroke();
    }

    // Floor Door Swing Arcs
    for (const door of state.room.doors) {
      const g = getDoorGeometry(door, state.room);
      const steps = 14;
      const pts = [p3(g.hx, g.hy, 0.5)];
      let a0 = g.aStart;
      let a1 = g.aEnd;
      if (a1 < a0) a1 += Math.PI * 2;
      for (let i = 0; i <= steps; i++) {
        const ang = a0 + ((a1 - a0) * i) / steps;
        pts.push(p3(g.hx + Math.cos(ang) * g.r, g.hy + Math.sin(ang) * g.r, 0.5));
      }
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i].x, pts[i].y);
      targetCtx.closePath();
      targetCtx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      targetCtx.fill();
      targetCtx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      targetCtx.stroke();
    }

    // Collect 3D Faces for Painter's Depth Sort
    const faces = [];
    state.hitRegions3D = [];
    state.handleHits3D = [];

    const pushQuad = (pts3, fill, stroke, lineWidth = 1, bias = 0, itemId = null, label = null) => {
      const proj = pts3.map(v => p3(v.x, v.y, v.z));
      const depth = proj.reduce((acc, q) => acc + q.depth, 0) / proj.length + bias;
      faces.push({ pts: proj, fill, stroke, lineWidth, depth, itemId, label });
    };

    const addBox3D = (poly2d, z0, z1, baseRgb, stroke, lineWidth = 1, itemId = null, label = null, bias = 0) => {
      const bot = poly2d.map(pt => ({ x: pt.x, y: pt.y, z: z0 }));
      const top = poly2d.map(pt => ({ x: pt.x, y: pt.y, z: z1 }));
      for (let i = 0; i < poly2d.length; i++) {
        const j = (i + 1) % poly2d.length;
        const sideFactor = i % 2 === 0 ? 0.68 : 0.52;
        pushQuad([bot[i], bot[j], top[j], top[i]], shadeRgb(baseRgb, sideFactor), stroke, lineWidth, bias, itemId, null);
      }
      pushQuad(top, shadeRgb(baseRgb, 0.96), stroke, lineWidth + 0.25, bias + 0.5, itemId, label);
    };

    const makeLocalToWorld = (item) => {
      const rad = degToRad(item.rot || 0);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return (nx0, ny0, nx1, ny1) => {
        const x0 = nx0 * item.w;
        const x1 = nx1 * item.w;
        const y0 = ny0 * item.h;
        const y1 = ny1 * item.h;
        return [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 }
        ].map(pt => ({
          x: item.x + pt.x * cos - pt.y * sin,
          y: item.y + pt.x * sin + pt.y * cos
        }));
      };
    };

    const makeLocalPolygon = (item, ptsLocal) => {
      const rad = degToRad(item.rot || 0);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return ptsLocal.map(pt => {
        const lx = pt.x * item.w;
        const ly = pt.y * item.h;
        return {
          x: item.x + lx * cos - ly * sin,
          y: item.y + lx * sin + ly * cos
        };
      });
    };

    const makeCirclePoly = (item, rxNorm, ryNorm, sides = 8) => {
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        pts.push({ x: Math.cos(a) * rxNorm, y: Math.sin(a) * ryNorm });
      }
      return makeLocalPolygon(item, pts);
    };

    const renderFurnitureItem3D = (item, rgb, stroke, lineW, zH, bias) => {
      const box = makeLocalToWorld(item);
      const part = (nx0, ny0, nx1, ny1, z0, z1, pRgb = rgb, pStroke = stroke, pLineW = lineW, label = null, bOff = 0) => {
        addBox3D(box(nx0, ny0, nx1, ny1), z0, z1, pRgb, pStroke, pLineW, item.id, label, bias + bOff);
      };
      const tint = (f) => [Math.min(255, Math.round(rgb[0] * f)), Math.min(255, Math.round(rgb[1] * f)), Math.min(255, Math.round(rgb[2] * f))];
      const darkTrim = [52, 54, 64];
      const woodWarm = [146, 108, 72];

      switch (item.type) {
        case 'divider': {
          const geom = getDividerGeometry(item);
          geom.segments.forEach((seg, idx) => {
            addBox3D(seg.poly, 0, zH, rgb, stroke, lineW, item.id, idx === 1 ? item.name : null, bias);
            // Subtle upper & lower frame plinth lines
            addBox3D(seg.poly, Math.max(0, zH - 3), zH + 0.5, tint(1.12), stroke, lineW * 0.85, item.id, null, bias + 1);
          });
          // Vertical hinge rods at interior joints 1..3
          for (let j = 1; j <= 3; j++) {
            const jp = geom.nodes[j];
            const hr = 1.6;
            const hingePoly = [
              { x: jp.x - hr, y: jp.y - hr },
              { x: jp.x + hr, y: jp.y - hr },
              { x: jp.x + hr, y: jp.y + hr },
              { x: jp.x - hr, y: jp.y + hr }
            ];
            addBox3D(hingePoly, 0, zH + 1, [200, 169, 110], stroke, 0.9, item.id, null, bias + 1.5);
          }
          break;
        }
        case 'bed': {
          const frameZ = Math.max(8, Math.round(zH * 0.44));
          const headX = Math.min(-0.36, -0.5 + 10 / Math.max(40, item.w));
          part(-0.5, -0.5, 0.5, 0.5, 0, frameZ, tint(0.78), stroke, lineW, null, 0);
          part(-0.48, -0.48, 0.49, 0.48, frameZ, zH, tint(1.06), stroke, lineW, null, 1);
          // Duvet blanket covering foot 60% of the bed
          part(-0.1, -0.49, 0.495, 0.49, zH * 0.65, zH + 2, tint(0.9), stroke, lineW * 0.9, item.name, 2);
          // Tall headboard
          part(-0.5, -0.5, headX, 0.5, 0, zH + 38, darkTrim, stroke, lineW, null, 2.5);
          // Two pillows
          const pX1 = headX + Math.min(0.22, 32 / Math.max(40, item.w));
          if (item.h >= 105) {
            part(headX + 0.02, -0.42, pX1, -0.04, zH, zH + 9, [215, 222, 232], stroke, 0.85, null, 3);
            part(headX + 0.02, 0.04, pX1, 0.42, zH, zH + 9, [215, 222, 232], stroke, 0.85, null, 3);
          } else {
            part(headX + 0.02, -0.34, pX1, 0.34, zH, zH + 9, [215, 222, 232], stroke, 0.85, null, 3);
          }
          break;
        }
        case 'desk': {
          const topZ = Math.max(4, zH - 4);
          // 4 slim corner legs
          part(-0.47, -0.45, -0.40, -0.37, 0, topZ, darkTrim, stroke, lineW * 0.85, null, 0);
          part(0.40, -0.45, 0.47, -0.37, 0, topZ, darkTrim, stroke, lineW * 0.85, null, 0);
          part(-0.47, 0.37, -0.40, 0.45, 0, topZ, darkTrim, stroke, lineW * 0.85, null, 0);
          part(0.40, 0.37, 0.47, 0.45, 0, topZ, darkTrim, stroke, lineW * 0.85, null, 0);
          // Rear cross-brace
          part(-0.42, -0.43, 0.42, -0.38, Math.round(topZ * 0.65), topZ, darkTrim, stroke, 0.8, null, 0.5);
          // Tabletop slab
          part(-0.5, -0.5, 0.5, 0.5, topZ, zH, tint(1.04), stroke, lineW, item.name, 2);
          // Subtle desk mat / keyboard silhouette
          part(-0.24, -0.14, 0.24, 0.26, zH, zH + 1.2, darkTrim, stroke, 0.7, null, 3);
          break;
        }
        case 'chair': {
          const seatZ = Math.min(zH - 12, Math.max(20, Math.round(zH * 0.52)));
          const seatBot = Math.max(12, seatZ - 6);
          // 4 legs
          part(-0.44, -0.44, -0.34, -0.34, 0, seatBot, darkTrim, stroke, lineW * 0.8, null, 0);
          part(0.34, -0.44, 0.44, -0.34, 0, seatBot, darkTrim, stroke, lineW * 0.8, null, 0);
          part(-0.44, 0.34, -0.34, 0.44, 0, seatBot, darkTrim, stroke, lineW * 0.8, null, 0);
          part(0.34, 0.34, 0.44, 0.44, 0, seatBot, darkTrim, stroke, lineW * 0.8, null, 0);
          // Seat cushion
          part(-0.46, -0.44, 0.46, 0.46, seatBot, seatZ, rgb, stroke, lineW, item.name, 1.5);
          // Backrest
          part(-0.44, -0.48, 0.44, -0.32, seatZ, zH, tint(1.08), stroke, lineW, null, 2.5);
          // Armrests if wide enough
          if (item.w >= 46 && zH >= 65) {
            const armTop = Math.round(seatZ + (zH - seatZ) * 0.45);
            part(-0.50, -0.38, -0.38, 0.36, seatZ, armTop, tint(0.9), stroke, 0.85, null, 2);
            part(0.38, -0.38, 0.50, 0.36, seatZ, armTop, tint(0.9), stroke, 0.85, null, 2);
          }
          break;
        }
        case 'sofa': {
          if (zH <= 52) {
            // Puff / Ottoman
            addBox3D(makeCirclePoly(item, 0.48, 0.48, 8), 0, Math.round(zH * 0.35), darkTrim, stroke, lineW * 0.9, item.id, null, bias);
            addBox3D(makeCirclePoly(item, 0.49, 0.49, 8), Math.round(zH * 0.35), zH, tint(1.05), stroke, lineW, item.id, item.name, bias + 1.5);
          } else {
            const baseZ = Math.max(6, Math.round(zH * 0.24));
            const seatZ = Math.round(zH * 0.52);
            const armZ = Math.round(zH * 0.72);
            part(-0.5, -0.5, 0.5, 0.5, 0, baseZ, darkTrim, stroke, lineW, null, 0);
            // Left & right seat cushions
            part(-0.38, -0.32, -0.01, 0.48, baseZ, seatZ, tint(1.06), stroke, lineW * 0.9, null, 1);
            part(0.01, -0.32, 0.38, 0.48, baseZ, seatZ, tint(1.06), stroke, lineW * 0.9, item.name, 1);
            // Armrests
            part(-0.5, -0.48, -0.37, 0.48, baseZ, armZ, tint(0.92), stroke, lineW, null, 2);
            part(0.37, -0.48, 0.5, 0.48, baseZ, armZ, tint(0.92), stroke, lineW, null, 2);
            // Backrest
            part(-0.48, -0.5, 0.48, -0.28, baseZ, zH, tint(0.98), stroke, lineW, null, 2.5);
          }
          break;
        }
        case 'tv': {
          part(-0.5, -0.5, 0.5, 0.5, 0, zH, rgb, stroke, lineW, item.name, 0);
          // Front console shelf niche on +y face
          part(-0.44, 0.46, 0.44, 0.51, Math.round(zH * 0.35), Math.round(zH * 0.78), darkTrim, stroke, 0.75, null, 1);
          // Central TV neck stand
          part(-0.08, -0.10, 0.08, 0.14, zH, zH + 8, darkTrim, stroke, 0.9, null, 1.5);
          // Wide TV panel screen
          const tvThickness = Math.min(0.14, Math.max(0.04, 3 / Math.max(12, item.h)));
          part(-0.44, -tvThickness, 0.44, tvThickness, zH + 6, zH + 56, [24, 36, 54], '#6b93b8', 1.2, null, 2.5);
          break;
        }
        case 'wardrobe': {
          const topCap = Math.max(8, zH - 5);
          part(-0.5, -0.5, 0.5, 0.46, 0, topCap, rgb, stroke, lineW, null, 0);
          // Top cornice
          part(-0.51, -0.51, 0.51, 0.51, topCap, zH, tint(1.08), stroke, lineW, item.name, 1.5);
          // Front double doors + metallic vertical handles on +y
          part(-0.48, 0.46, -0.015, 0.50, 4, topCap - 2, tint(0.92), stroke, 0.9, null, 1);
          part(0.015, 0.46, 0.48, 0.50, 4, topCap - 2, tint(0.92), stroke, 0.9, null, 1);
          part(-0.06, 0.49, -0.025, 0.52, Math.round(zH * 0.38), Math.round(zH * 0.62), [210, 214, 224], stroke, 0.7, null, 2);
          part(0.025, 0.49, 0.06, 0.52, Math.round(zH * 0.38), Math.round(zH * 0.62), [210, 214, 224], stroke, 0.7, null, 2);
          break;
        }
        case 'nightstand': {
          const topZ = Math.max(8, zH - 4);
          part(-0.48, -0.48, 0.48, 0.46, 0, topZ, rgb, stroke, lineW, null, 0);
          part(-0.51, -0.5, 0.51, 0.5, topZ, zH, tint(1.1), stroke, lineW, item.name, 2);
          // 2 drawer fronts on +y
          part(-0.42, 0.45, 0.42, 0.5, Math.round(topZ * 0.14), Math.round(topZ * 0.50), tint(0.88), stroke, 0.85, null, 1);
          part(-0.42, 0.45, 0.42, 0.5, Math.round(topZ * 0.54), Math.round(topZ * 0.90), tint(0.88), stroke, 0.85, null, 1.2);
          break;
        }
        case 'shelf': {
          // Vertical side uprights + open horizontal shelves
          part(-0.5, -0.48, -0.40, 0.48, 0, zH, tint(0.88), stroke, lineW, null, 0);
          part(0.40, -0.48, 0.5, 0.48, 0, zH, tint(0.88), stroke, lineW, null, 0);
          part(-0.44, -0.5, 0.44, -0.42, 0, zH, tint(0.68), stroke, 0.8, null, 0);
          const tiers = zH >= 150 ? 5 : zH >= 90 ? 4 : 3;
          for (let ti = 0; ti < tiers; ti++) {
            const tz = Math.round((ti / (tiers - 1)) * Math.max(4, zH - 4));
            const isTop = ti === tiers - 1;
            part(-0.5, -0.48, 0.5, 0.5, tz, tz + 4, tint(isTop ? 1.06 : 0.96), stroke, lineW * 0.9, isTop ? item.name : null, isTop ? 2 : 0.8 + ti * 0.15);
            if (!isTop && ti >= 1) {
              // Subtle book/storage block accent on shelf
              part(-0.34, -0.25, -0.10, 0.32, tz + 4, Math.min(zH - 4, tz + Math.round((zH - 4) / (tiers - 1) * 0.68)), woodWarm, stroke, 0.7, null, 1.0 + ti * 0.15);
            }
          }
          break;
        }
        case 'pc': {
          const baseZ = Math.round(zH * 0.48);
          part(-0.5, -0.5, 0.5, 0.5, 0, baseZ, rgb, stroke, lineW, null, 0);
          // Tower on top
          part(-0.34, -0.38, 0.34, 0.38, baseZ, zH, [24, 28, 32], '#6e9887', lineW, item.name, 1.5);
          // Front/side RGB LED strip accent
          part(0.32, -0.34, 0.36, 0.34, baseZ + 4, zH - 4, [110, 152, 135], '#6e9887', 0.9, null, 2.2);
          break;
        }
        case 'easel': {
          const ledgeZ = Math.max(18, Math.round(zH * 0.35));
          const topZ = Math.max(ledgeZ + 20, Math.round(zH * 0.96));
          // 3 tripod legs
          part(-0.44, 0.24, -0.32, 0.42, 0, ledgeZ, woodWarm, stroke, 0.9, null, 0);
          part(0.32, 0.24, 0.44, 0.42, 0, ledgeZ, woodWarm, stroke, 0.9, null, 0);
          part(-0.07, -0.46, 0.07, -0.28, 0, topZ, woodWarm, stroke, 0.9, null, 0);
          // Central mast + horizontal ledge
          part(-0.07, -0.06, 0.07, 0.10, Math.round(ledgeZ * 0.5), zH, woodWarm, stroke, lineW, null, 1);
          part(-0.46, 0.08, 0.46, 0.34, ledgeZ - 4, ledgeZ + 2, rgb, stroke, lineW, null, 1.5);
          // Canvas artwork panel
          part(-0.42, 0.06, 0.42, 0.18, ledgeZ + 2, Math.round(zH * 0.88), [235, 228, 212], stroke, lineW, item.name, 2.2);
          break;
        }
        case 'mirror': {
          part(-0.5, -0.5, 0.5, 0.5, 0, zH, darkTrim, stroke, lineW, item.name, 0);
          // Reflective inner glass panel on +y face
          part(-0.42, -0.2, 0.42, 0.56, 6, Math.max(10, zH - 6), [155, 178, 198], '#9bb8d3', 1.1, null, 1.5);
          break;
        }
        case 'lamp': {
          const stemTop = Math.max(20, zH - 26);
          // Octagonal weighted floor base
          addBox3D(makeCirclePoly(item, 0.36, 0.36, 8), 0, 4, darkTrim, stroke, lineW * 0.9, item.id, null, bias);
          // Slim vertical stem
          part(-0.08, -0.08, 0.08, 0.08, 4, stemTop, [205, 165, 92], stroke, 0.85, null, 1);
          // Glowing lampshade
          addBox3D(makeCirclePoly(item, 0.48, 0.48, 8), stemTop, zH, [248, 210, 120], '#fbbf24', lineW, item.id, item.name, bias + 2);
          break;
        }
        case 'plant': {
          const potH = Math.max(8, Math.round(zH * 0.36));
          // Octagonal terracotta/slate pot
          addBox3D(makeCirclePoly(item, 0.34, 0.34, 8), 0, potH, [168, 96, 68], stroke, lineW * 0.9, item.id, null, bias);
          // Lower & upper octagonal foliage crown
          addBox3D(makeCirclePoly(item, 0.48, 0.48, 8), Math.max(4, potH - 4), Math.round(zH * 0.76), [28, 150, 96], stroke, lineW, item.id, null, bias + 1);
          addBox3D(makeCirclePoly(item, 0.34, 0.34, 8), Math.round(zH * 0.72), zH, [46, 184, 120], stroke, lineW, item.id, item.name, bias + 2);
          break;
        }
        case 'appliance': {
          const topCap = Math.max(8, zH - 4);
          part(-0.5, -0.5, 0.5, 0.5, 0, topCap, rgb, stroke, lineW, null, 0);
          part(-0.5, -0.5, 0.5, 0.5, topCap, zH, tint(1.14), stroke, lineW, item.name, 1.5);
          // Front door/vent panel accent on +y
          part(-0.42, 0.47, 0.42, 0.52, Math.round(zH * 0.14), Math.round(zH * 0.86), [78, 84, 96], stroke, 0.85, null, 1.2);
          break;
        }
        case 'rug': {
          const matH = Math.min(3, zH);
          const rugBias = Math.min(bias, -4500);
          addBox3D(box(-0.5, -0.5, 0.5, 0.5), 0, matH, rgb, stroke, lineW, item.id, item.name, rugBias);
          addBox3D(box(-0.43, -0.43, 0.43, 0.43), matH, matH + 0.4, tint(1.16), stroke, 0.7, item.id, null, rugBias + 1);
          break;
        }
        default: {
          // Box / generic furniture with subtle top cap chamfer
          if (zH > 8) {
            part(-0.5, -0.5, 0.5, 0.5, 0, zH - 3, rgb, stroke, lineW, null, 0);
            part(-0.5, -0.5, 0.5, 0.5, zH - 3, zH, tint(1.08), stroke, lineW, item.name, 1.5);
          } else {
            const polys = getItemPolygons(item);
            polys.forEach((poly, idx) => {
              addBox3D(poly, 0, zH, rgb, stroke, lineW, item.id, idx === 0 ? item.name : null, bias);
            });
          }
          break;
        }
      }
    };

    // 2. Cutaway Back vs Front Walls
    const camX = Math.sin(t.yawRad);
    const camY = Math.cos(t.yawRad);
    const wallSpecs = [
      { id: 'top',    a: { x: 0, y: 0 }, b: { x: W, y: 0 }, isBack: camY > 0 },
      { id: 'bottom', a: { x: 0, y: H }, b: { x: W, y: H }, isBack: camY <= 0 },
      { id: 'left',   a: { x: 0, y: 0 }, b: { x: 0, y: H }, isBack: camX > 0 },
      { id: 'right',  a: { x: W, y: 0 }, b: { x: W, y: H }, isBack: camX <= 0 }
    ];

    for (const w of wallSpecs) {
      const hWall = w.isBack ? WALL_Z : 10;
      const pts = [
        { x: w.a.x, y: w.a.y, z: 0 },
        { x: w.b.x, y: w.b.y, z: 0 },
        { x: w.b.x, y: w.b.y, z: hWall },
        { x: w.a.x, y: w.a.y, z: hWall }
      ];
      pushQuad(
        pts,
        w.isBack ? 'rgba(30, 30, 38, 0.65)' : 'rgba(63, 63, 70, 0.35)',
        w.isBack ? 'rgba(113, 113, 122, 0.45)' : 'rgba(113, 113, 122, 0.6)',
        1,
        w.isBack ? -3000 : 1200,
        null
      );
    }

    // Windows in 3D
    for (const win of state.room.windows) {
      const off = Number(win.offset) || 0;
      const wLen = Number(win.width) || 100;
      const spec = wallSpecs.find(s => s.id === win.wall);
      const isBack = !spec || spec.isBack;
      const z0 = isBack ? 95 : 2;
      const z1 = isBack ? 205 : 10;
      let wa, wb;
      if (win.wall === 'top' || win.wall === 'bottom') {
        const y = win.wall === 'top' ? 0 : H;
        wa = { x: off, y };
        wb = { x: off + wLen, y };
      } else {
        const x = win.wall === 'left' ? 0 : W;
        wa = { x, y: off };
        wb = { x, y: off + wLen };
      }
      pushQuad(
        [{ x: wa.x, y: wa.y, z: z0 }, { x: wb.x, y: wb.y, z: z0 }, { x: wb.x, y: wb.y, z: z1 }, { x: wa.x, y: wa.y, z: z1 }],
        'rgba(107, 147, 184, 0.24)',
        '#6b93b8',
        1.5,
        isBack ? -2800 : 1250
      );
    }

    // Door Leaves in 3D
    for (const door of state.room.doors) {
      const g = getDoorGeometry(door, state.room);
      pushQuad(
        [
          { x: g.hx, y: g.hy, z: 0 },
          { x: g.openEnd.x, y: g.openEnd.y, z: 0 },
          { x: g.openEnd.x, y: g.openEnd.y, z: 205 },
          { x: g.hx, y: g.hy, z: 205 }
        ],
        'rgba(200, 169, 110, 0.16)',
        '#c8a96e',
        1.4,
        0
      );
    }

    // 3. Furniture 3D Prisms (Procedural Archetypes)
    const { bad: collisions } = computeCollisions();
    for (const item of state.items) {
      if (!item.visible) continue;
      const isSel = item.id === state.selectedId;
      const isBad = collisions.has(item.id);
      const baseRgb = RGB_3D_PALETTE[item.color] || RGB_3D_PALETTE.zinc;
      const rgb = isBad
        ? [196, 78, 86]
        : isSel
        ? [Math.min(255, baseRgb[0] + 28), Math.min(255, baseRgb[1] + 24), Math.min(255, baseRgb[2] + 18)]
        : baseRgb;
      const stroke = isBad ? '#d96b6b' : isSel ? '#c8a96e' : 'rgba(237, 234, 228, 0.34)';
      const lineW = isSel || isBad ? 1.5 : 0.9;
      const zH = Math.max(1, Number(item.zHeight) || 75);
      const bias = item.ignoreCollision && zH <= 4 ? -4500 : 0;

      renderFurnitureItem3D(item, rgb, stroke, lineW, zH, bias);
    }

    // Painter's Sort & Draw All Faces
    faces.sort((a, b) => a.depth - b.depth);
    for (const f of faces) {
      const pts = f.pts;
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i].x, pts[i].y);
      targetCtx.closePath();
      targetCtx.fillStyle = f.fill;
      targetCtx.fill();
      targetCtx.strokeStyle = f.stroke;
      targetCtx.lineWidth = f.lineWidth;
      targetCtx.stroke();

      if (f.itemId) {
        state.hitRegions3D.push({ itemId: f.itemId, pts });
      }
      if (f.label && pts.length >= 4) {
        const lx = pts.reduce((a, q) => a + q.x, 0) / pts.length;
        const ly = pts.reduce((a, q) => a + q.y, 0) / pts.length;
        const span = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (span >= 30) {
          targetCtx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
          targetCtx.fillStyle = '#edeae4';
          targetCtx.textAlign = 'center';
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText(f.label, lx, ly);
        }
      }
    }

    // 4. 3D Outlets & Cables overlay
    for (const out of state.room.outlets) {
      const oc = getOutletCoords(out);
      const op = p3(oc.x, oc.y, 35);
      targetCtx.fillStyle = '#c8a96e';
      targetCtx.fillRect(op.x - 3.5, op.y - 3.5, 7, 7);
      targetCtx.font = '600 9px "JetBrains Mono", Consolas, monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(out.name || out.id, op.x, op.y - 8);
    }

    for (const cable of state.cables) {
      if (!cable.visible) continue;
      const stats = computeCableStats(cable);
      if (!stats) continue;
      const pA = p3(stats.a.x, stats.a.y, 18);
      const pB = p3(stats.b.x, stats.b.y, 18);
      const col = stats.status === 'ok' ? '#6e9887' : stats.status === 'warn' ? '#c8a96e' : '#d96b6b';
      targetCtx.beginPath();
      targetCtx.moveTo(pA.x, pA.y);
      if (cable.routingMode === 'wall') {
        const mid = p3(stats.b.x, stats.a.y, 12);
        targetCtx.lineTo(mid.x, mid.y);
      }
      targetCtx.lineTo(pB.x, pB.y);
      targetCtx.setLineDash([5, 4]);
      targetCtx.strokeStyle = col;
      targetCtx.lineWidth = 1.8;
      targetCtx.stroke();
      targetCtx.setLineDash([]);
    }

    // 5. Selected Divider 3D Draggable Hinge Nodes (matches 2D fold-node articulation)
    const selItem3D = state.items.find(it => it.id === state.selectedId);
    if (selItem3D && selItem3D.visible && selItem3D.type === 'divider') {
      const geom = getDividerGeometry(selItem3D);
      const zH = Math.max(1, Number(selItem3D.zHeight) || 180);
      geom.nodes.forEach((pt, idx) => {
        const pBot = p3(pt.x, pt.y, 0);
        const pMid = p3(pt.x, pt.y, zH * 0.5);
        const pTop = p3(pt.x, pt.y, zH);
        const isDraggingThis = interaction.mode === 'fold-node' && interaction.itemId === selItem3D.id && interaction.nodeIndex === idx;

        targetCtx.beginPath();
        targetCtx.moveTo(pBot.x, pBot.y);
        targetCtx.lineTo(pTop.x, pTop.y);
        targetCtx.setLineDash([4, 3]);
        targetCtx.strokeStyle = isDraggingThis ? '#edeae4' : 'rgba(200, 169, 110, 0.72)';
        targetCtx.lineWidth = isDraggingThis ? 2 : 1.4;
        targetCtx.stroke();
        targetCtx.setLineDash([]);

        const handles3d = [
          { pt: pTop, r: isDraggingThis ? 8 : 7, planeZ: zH },
          { pt: pMid, r: isDraggingThis ? 6.5 : 5.2, planeZ: zH * 0.5 },
          { pt: pBot, r: isDraggingThis ? 6.5 : 5.8, planeZ: 0 }
        ];
        for (const h of handles3d) {
          targetCtx.beginPath();
          targetCtx.arc(h.pt.x, h.pt.y, h.r, 0, Math.PI * 2);
          targetCtx.fillStyle = isDraggingThis ? '#c8a96e' : '#edeae4';
          targetCtx.fill();
          targetCtx.strokeStyle = isDraggingThis ? '#edeae4' : '#c8a96e';
          targetCtx.lineWidth = 2;
          targetCtx.stroke();

          targetCtx.beginPath();
          targetCtx.arc(h.pt.x, h.pt.y, 2, 0, Math.PI * 2);
          targetCtx.fillStyle = '#0d0e10';
          targetCtx.fill();

          state.handleHits3D.push({
            id: `node_${idx}`,
            type: 'fold-node',
            nodeIndex: idx,
            x: h.pt.x,
            y: h.pt.y,
            planeZ: h.planeZ,
            itemId: selItem3D.id
          });
        }

        if (idx >= 1 && idx <= 3) {
          const ang = Math.round(geom.folds[idx - 1]);
          if (Math.abs(ang) >= 2 || isDraggingThis) {
            targetCtx.font = '600 9.5px "JetBrains Mono", Consolas, monospace';
            targetCtx.fillStyle = '#c8a96e';
            targetCtx.textAlign = 'center';
            targetCtx.fillText(`${ang > 0 ? '+' : ''}${ang}°`, pTop.x, pTop.y - 12);
          }
        }
      });
    }

    targetCtx.restore();
  }

  function draw() {
    positionHUD();
    const rect = viewport.getBoundingClientRect();
    updateTransform(rect.width, rect.height);
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawSceneToContext(ctx, rect.width, rect.height, view, 'dark');
  }

  function drawFurnitureItem(targetCtx, item, mapScreen, s, isSel, isBad, isLight) {
    const pal = getPaletteColor(item.color);

    if (item.type === 'divider') {
      const geom = getDividerGeometry(item);
      targetCtx.save();
      targetCtx.fillStyle = isBad
        ? 'rgba(217, 107, 107, 0.24)'
        : isSel
        ? 'rgba(200, 169, 110, 0.18)'
        : isLight
        ? 'rgba(15, 23, 42, 0.08)'
        : pal.fill;
      targetCtx.strokeStyle = isBad ? '#d96b6b' : isSel ? '#edeae4' : isLight ? '#334155' : pal.stroke;
      targetCtx.lineWidth = isSel || isBad ? 1.8 : 1.3;

      for (const seg of geom.segments) {
        const pts = seg.poly.map(pt => mapScreen(pt.x, pt.y));
        targetCtx.beginPath();
        targetCtx.moveTo(pts[0].x, pts[0].y);
        targetCtx.lineTo(pts[1].x, pts[1].y);
        targetCtx.lineTo(pts[2].x, pts[2].y);
        targetCtx.lineTo(pts[3].x, pts[3].y);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
      }

      // Interior hinge joints
      for (let i = 1; i <= 3; i++) {
        const jp = mapScreen(geom.nodes[i].x, geom.nodes[i].y);
        targetCtx.beginPath();
        targetCtx.arc(jp.x, jp.y, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = isBad ? '#d96b6b' : isSel ? '#c8a96e' : (isLight ? '#334155' : '#9a9891');
        targetCtx.fill();
      }

      const center = mapScreen(item.x, item.y);
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
      targetCtx.fillStyle = isBad ? '#fecdd3' : isLight ? '#0f172a' : (isSel ? '#ffffff' : pal.text);
      targetCtx.fillText(item.name, center.x, center.y - 14);
      targetCtx.font = '500 8.5px "JetBrains Mono", Consolas, monospace';
      targetCtx.fillStyle = isBad ? '#fb7185' : isLight ? '#475569' : '#a1a1aa';
      targetCtx.fillText(`${Math.round(item.w)}×${Math.round(item.h)}×${Math.round(item.zHeight || 180)}`, center.x, center.y + 13);
      targetCtx.restore();
      return;
    }

    const center = mapScreen(item.x, item.y);
    const wPx = item.w * s;
    const hPx = item.h * s;

    targetCtx.save();
    targetCtx.translate(center.x, center.y);
    targetCtx.rotate(degToRad(item.rot || 0));

    if (item.ignoreCollision) targetCtx.setLineDash([4, 3]);

    if (isBad) {
      targetCtx.fillStyle = 'rgba(217, 107, 107, 0.24)';
      targetCtx.strokeStyle = '#d96b6b';
    } else if (isSel) {
      targetCtx.fillStyle = 'rgba(200, 169, 110, 0.16)';
      targetCtx.strokeStyle = '#edeae4';
    } else if (isLight) {
      targetCtx.fillStyle = 'rgba(15, 23, 42, 0.06)';
      targetCtx.strokeStyle = '#334155';
    } else {
      targetCtx.fillStyle = pal.fill;
      targetCtx.strokeStyle = pal.stroke;
    }

    targetCtx.lineWidth = isSel || isBad ? 1.8 : 1.2;
    if (item.type === 'plant' || item.type === 'lamp') {
      targetCtx.beginPath();
      targetCtx.ellipse(0, 0, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    } else {
      targetCtx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
      targetCtx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
    }
    targetCtx.setLineDash([]);

    // CAD Archetype Architectural Details
    targetCtx.strokeStyle = isBad ? '#fb7185' : isLight ? '#475569' : (isSel ? '#e4e4e7' : pal.stroke);
    targetCtx.lineWidth = 1;

    switch (item.type) {
      case 'bed': {
        const hb = Math.max(5, 10 * s);
        targetCtx.fillStyle = isBad ? 'rgba(244,63,94,0.3)' : (isLight ? '#cbd5e1' : '#3f3f46');
        targetCtx.fillRect(-wPx / 2, -hPx / 2, hb, hPx);
        targetCtx.strokeRect(-wPx / 2, -hPx / 2, hb, hPx);
        const pw = Math.max(8, 28 * s);
        const ph = hPx * 0.36;
        targetCtx.strokeRect(-wPx / 2 + hb + 4, -hPx * 0.42, pw, ph);
        targetCtx.strokeRect(-wPx / 2 + hb + 4, hPx * 0.06, pw, ph);
        break;
      }
      case 'tv': {
        const tvW = 0.92 * wPx;
        targetCtx.strokeStyle = '#6b93b8';
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(-tvW / 2, hPx / 2 - 2);
        targetCtx.lineTo(tvW / 2, hPx / 2 - 2);
        targetCtx.stroke();
        targetCtx.fillStyle = '#6b93b8';
        targetCtx.beginPath();
        targetCtx.moveTo(0, hPx / 2 + 5);
        targetCtx.lineTo(-4, hPx / 2 + 1);
        targetCtx.lineTo(4, hPx / 2 + 1);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'divider': {
        const segs = Math.max(2, Math.round(item.w / 45));
        for (let i = 1; i < segs; i++) {
          const sx = -wPx / 2 + (wPx * i) / segs;
          targetCtx.beginPath();
          targetCtx.moveTo(sx, -hPx / 2);
          targetCtx.lineTo(sx, hPx / 2);
          targetCtx.stroke();
        }
        break;
      }
      case 'wardrobe': {
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx / 2 + 3, hPx / 2 - 2.5);
        targetCtx.lineTo(wPx / 2 - 3, hPx / 2 - 2.5);
        targetCtx.moveTo(0, hPx / 2 - 6);
        targetCtx.lineTo(0, hPx / 2 + 2);
        targetCtx.stroke();
        break;
      }
      case 'desk': {
        const rChair = Math.max(5, 14 * s);
        targetCtx.beginPath();
        targetCtx.arc(0, hPx / 2, rChair, 0, Math.PI);
        targetCtx.stroke();
        break;
      }
      case 'chair': {
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx * 0.42, -hPx * 0.38);
        targetCtx.lineTo(wPx * 0.42, -hPx * 0.38);
        targetCtx.stroke();
        break;
      }
      case 'sofa': {
        if ((item.zHeight || 78) > 52) {
          targetCtx.strokeRect(-wPx * 0.48, -hPx * 0.46, wPx * 0.96, hPx * 0.22);
          targetCtx.strokeRect(-wPx * 0.48, -hPx * 0.24, wPx * 0.14, hPx * 0.7);
          targetCtx.strokeRect(wPx * 0.34, -hPx * 0.24, wPx * 0.14, hPx * 0.7);
        } else {
          targetCtx.beginPath();
          targetCtx.ellipse(0, 0, wPx * 0.34, hPx * 0.34, 0, 0, Math.PI * 2);
          targetCtx.stroke();
        }
        break;
      }
      case 'nightstand':
      case 'appliance': {
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx * 0.38, hPx / 2 - 3);
        targetCtx.lineTo(wPx * 0.38, hPx / 2 - 3);
        targetCtx.stroke();
        break;
      }
      case 'shelf': {
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx * 0.42, -hPx * 0.25);
        targetCtx.lineTo(-wPx * 0.42, hPx * 0.25);
        targetCtx.moveTo(wPx * 0.42, -hPx * 0.25);
        targetCtx.lineTo(wPx * 0.42, hPx * 0.25);
        targetCtx.stroke();
        break;
      }
      case 'mirror': {
        targetCtx.strokeStyle = '#9bb8d3';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx * 0.42, hPx * 0.3);
        targetCtx.lineTo(wPx * 0.42, hPx * 0.3);
        targetCtx.stroke();
        break;
      }
      case 'lamp': {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, Math.max(3, Math.min(wPx, hPx) * 0.16), 0, Math.PI * 2);
        targetCtx.stroke();
        break;
      }
      case 'easel': {
        targetCtx.beginPath();
        targetCtx.moveTo(-wPx / 2 + 4, 0);
        targetCtx.lineTo(wPx / 2 - 4, 0);
        targetCtx.stroke();
        break;
      }
      case 'pc': {
        targetCtx.strokeRect(-wPx * 0.35, -hPx * 0.3, wPx * 0.7, hPx * 0.6);
        break;
      }
      default:
        break;
    }

    // Adaptive Label Orientation + Dimensions (L × P × A)
    // Oblong rotated items align text along their long axis (kept readable, never upside-down)
    const rotNorm = (((item.rot || 0) % 360) + 360) % 360;
    const isOblong = wPx >= hPx * 1.45 && wPx >= 52;
    if (isOblong) {
      if (rotNorm > 90 && rotNorm <= 270) {
        targetCtx.rotate(Math.PI);
      }
    } else {
      targetCtx.rotate(-degToRad(item.rot || 0));
    }
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    const spanW = isOblong ? wPx : (Math.abs(Math.sin(degToRad(rotNorm))) > 0.707 ? hPx : wPx);
    const isCompact = spanW < 56 || Math.min(wPx, hPx) < 34;
    const labelY = item.type === 'divider' ? -13 : (isCompact ? -5 : -6);
    const subY = item.type === 'divider' ? 12 : (isCompact ? 6 : 7);

    targetCtx.font = isCompact ? '600 9px -apple-system, BlinkMacSystemFont, sans-serif' : '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
    targetCtx.fillStyle = isBad ? '#fecdd3' : isLight ? '#0f172a' : (isSel ? '#ffffff' : pal.text);
    targetCtx.fillText(item.name, 0, labelY);

    targetCtx.font = isCompact ? '500 8px "JetBrains Mono", Consolas, monospace' : '500 8.5px "JetBrains Mono", Consolas, monospace';
    targetCtx.fillStyle = isBad ? '#fb7185' : isLight ? '#475569' : '#a1a1aa';
    const dimText = item.zHeight
      ? `${Math.round(item.w)}×${Math.round(item.h)}×${Math.round(item.zHeight)}`
      : `${Math.round(item.w)}×${Math.round(item.h)}`;
    targetCtx.fillText(dimText, 0, subY);

    targetCtx.restore();
  }

  function drawSelectionHandles(targetCtx, item) {
    if (item.type === 'divider') {
      const box = getAABB(item);
      const tl = toScreen(box.minX, box.minY);
      const br = toScreen(box.maxX, box.maxY);
      const topMid = { x: (tl.x + br.x) * 0.5, y: tl.y };
      const rotPt = { x: topMid.x, y: topMid.y - 26 };
      const geom = getDividerGeometry(item);

      targetCtx.save();
      targetCtx.setLineDash([4, 4]);
      targetCtx.strokeStyle = 'rgba(200, 169, 110, 0.35)';
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(tl.x - 4, tl.y - 4, (br.x - tl.x) + 8, (br.y - tl.y) + 8);
      targetCtx.setLineDash([]);

      targetCtx.beginPath();
      targetCtx.moveTo(topMid.x, topMid.y - 4);
      targetCtx.lineTo(rotPt.x, rotPt.y);
      targetCtx.strokeStyle = '#c8a96e';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(rotPt.x, rotPt.y, 7, 0, Math.PI * 2);
      targetCtx.fillStyle = '#c8a96e';
      targetCtx.fill();
      targetCtx.strokeStyle = '#0d0e10';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();

      // 5 draggable hinge nodes along the 4-panel divider
      geom.nodes.forEach((pt, idx) => {
        const sp = toScreen(pt.x, pt.y);
        targetCtx.beginPath();
        targetCtx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
        targetCtx.fillStyle = '#edeae4';
        targetCtx.fill();
        targetCtx.strokeStyle = '#c8a96e';
        targetCtx.lineWidth = 2;
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
        targetCtx.fillStyle = '#0d0e10';
        targetCtx.fill();

        if (idx >= 1 && idx <= 3) {
          const ang = Math.round(geom.folds[idx - 1]);
          if (Math.abs(ang) >= 2) {
            targetCtx.font = '600 9px "JetBrains Mono", Consolas, monospace';
            targetCtx.fillStyle = '#c8a96e';
            targetCtx.textAlign = 'center';
            targetCtx.fillText(`${ang > 0 ? '+' : ''}${ang}°`, sp.x, sp.y - 12);
          }
        }
      });

      targetCtx.restore();
      return;
    }

    const center = toScreen(item.x, item.y);
    const rad = degToRad(item.rot || 0);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = (item.w * view.scale) / 2;
    const hh = (item.h * view.scale) / 2;

    const toS = (lx, ly) => ({
      x: center.x + lx * cos - ly * sin,
      y: center.y + lx * sin + ly * cos
    });

    const topMid = toS(0, -hh);
    const rotPt = toS(0, -hh - 26);

    targetCtx.save();
    // Stem to rotation handle
    targetCtx.beginPath();
    targetCtx.moveTo(topMid.x, topMid.y);
    targetCtx.lineTo(rotPt.x, rotPt.y);
    targetCtx.strokeStyle = '#c8a96e';
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();

    // Rotation circle
    targetCtx.beginPath();
    targetCtx.arc(rotPt.x, rotPt.y, 7, 0, Math.PI * 2);
    targetCtx.fillStyle = '#c8a96e';
    targetCtx.fill();
    targetCtx.strokeStyle = '#0d0e10';
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();

    // Resize squares if unlocked
    if (!item.lockedDims) {
      const handles = getHandleScreenPositions(item).filter(h => h.id !== 'rot');
      for (const h of handles) {
        const size = h.id.length === 2 ? 7 : 8;
        targetCtx.fillStyle = '#edeae4';
        targetCtx.strokeStyle = '#0d0e10';
        targetCtx.lineWidth = 1.5;
        targetCtx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
        targetCtx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
      }
    }

    // Live protractor ring while actively rotating
    if (interaction.mode === 'rotate') {
      targetCtx.beginPath();
      targetCtx.arc(center.x, center.y, Math.max(40, Math.hypot(hw, hh) + 12), 0, Math.PI * 2);
      targetCtx.setLineDash([3, 4]);
      targetCtx.strokeStyle = 'rgba(200, 169, 110, 0.55)';
      targetCtx.stroke();
    }

    targetCtx.restore();
  }

  function drawClearanceGuides(targetCtx, item, mapScreen) {
    const cInfo = computeCenteringInfo(item);
    const { clr, centeredX, centeredY } = cInfo;
    const dirs = [
      { key: 'N', d: clr.N },
      { key: 'S', d: clr.S },
      { key: 'W', d: clr.W },
      { key: 'E', d: clr.E }
    ];

    targetCtx.save();
    targetCtx.font = '600 9px "JetBrains Mono", Consolas, monospace';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    const drawPill = (tx, ty, txt, bg, border, fg) => {
      const tw = targetCtx.measureText(txt).width + 8;
      targetCtx.fillStyle = bg;
      targetCtx.fillRect(tx - tw / 2, ty - 7, tw, 14);
      if (border) {
        targetCtx.strokeStyle = border;
        targetCtx.lineWidth = 1;
        targetCtx.strokeRect(tx - tw / 2, ty - 7, tw, 14);
      }
      targetCtx.fillStyle = fg;
      targetCtx.fillText(txt, tx, ty);
      return tw;
    };

    for (const { key, d } of dirs) {
      if (d.dist < 2) continue;
      const p1 = mapScreen(d.from.x, d.from.y);
      const p2 = mapScreen(d.to.x, d.to.y);
      const isCenteredDir =
        ((key === 'W' || key === 'E') && centeredX && centeredX.kind !== 'item') ||
        ((key === 'N' || key === 'S') && centeredY && centeredY.kind !== 'item');

      targetCtx.beginPath();
      targetCtx.moveTo(p1.x, p1.y);
      targetCtx.lineTo(p2.x, p2.y);
      targetCtx.setLineDash([3, 3]);
      targetCtx.strokeStyle = isCenteredDir ? '#10b981' : '#71717a';
      targetCtx.lineWidth = isCenteredDir ? 1.4 : 1;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const txt = `${Math.round(d.dist)}cm`;
      if (isCenteredDir) {
        drawPill(mx, my, txt, '#064e3b', '#10b981', '#6ee7b7');
      } else {
        drawPill(mx, my, txt, '#0d0e10', null, '#9a9891');
      }
    }

    const rTop = mapScreen(0, 0).y;
    const rBot = mapScreen(0, state.room.h).y;
    const rLeft = mapScreen(0, 0).x;
    const rRight = mapScreen(state.room.w, 0).x;
    const cPt = mapScreen(cInfo.cx, cInfo.cy);

    if (centeredX) {
      const px = mapScreen(centeredX.axisX, 0).x;
      targetCtx.beginPath();
      targetCtx.moveTo(px, rTop - 10);
      targetCtx.lineTo(px, rBot + 10);
      targetCtx.setLineDash([6, 4]);
      targetCtx.strokeStyle = '#10b981';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      const lbl = centeredX.kind === 'item'
        ? `CENTRO X · ${centeredX.otherName}`
        : `CENTRADO X · ${centeredX.leftCm}↔${centeredX.rightCm}cm`;
      const pillY = cInfo.box.minY < 26 ? rBot - 14 : rTop + 14;
      drawPill(px, pillY, lbl, '#064e3b', '#10b981', '#6ee7b7');
    }

    if (centeredY) {
      const py = mapScreen(0, centeredY.axisY).y;
      targetCtx.beginPath();
      targetCtx.moveTo(rLeft - 10, py);
      targetCtx.lineTo(rRight + 10, py);
      targetCtx.setLineDash([6, 4]);
      targetCtx.strokeStyle = '#10b981';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      const lbl = centeredY.kind === 'item'
        ? `CENTRO Y · ${centeredY.otherName}`
        : `CENTRADO Y · ${centeredY.topCm}↕${centeredY.botCm}cm`;
      const estW = targetCtx.measureText(lbl).width + 8;
      const pillX = cInfo.box.minX < 100 ? rRight - 10 - estW / 2 : rLeft + 10 + estW / 2;
      drawPill(pillX, py, lbl, '#064e3b', '#10b981', '#6ee7b7');
    }

    if (centeredX || centeredY) {
      targetCtx.beginPath();
      targetCtx.arc(cPt.x, cPt.y, 4, 0, Math.PI * 2);
      targetCtx.fillStyle = '#10b981';
      targetCtx.fill();
      targetCtx.strokeStyle = '#0d0e10';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();
    }

    targetCtx.restore();
  }

  function drawCableLine(targetCtx, cable, stats, mapScreen, isLight) {
    const p1 = mapScreen(stats.a.x, stats.a.y);
    const p2 = mapScreen(stats.b.x, stats.b.y);
    const isCableMode = state.viewMode === 'cables' && !isLight;
    const color = stats.status === 'ok' ? (isCableMode ? '#34d399' : '#10b981') : stats.status === 'warn' ? '#f59e0b' : '#fb7185';

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(p1.x, p1.y);
    if (cable.routingMode === 'wall') {
      targetCtx.lineTo(p2.x, p1.y);
      targetCtx.lineTo(p2.x, p2.y);
    } else {
      const slackRatio = Math.max(0, Math.min(1, 1 - stats.meters / stats.maxM));
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2 + slackRatio * 18;
      targetCtx.quadraticCurveTo(mx, my, p2.x, p2.y);
    }
    targetCtx.setLineDash(isCableMode ? [8, 6] : [5, 4]);
    if (isCableMode && !isReducedMotion()) {
      targetCtx.lineDashOffset = -(performance.now() * 0.03) % 28;
    }
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = isCableMode ? 2.6 : 1.7;
    targetCtx.stroke();
    targetCtx.setLineDash([]);
    targetCtx.lineDashOffset = 0;

    const endR = isCableMode ? 4 : 2.5;
    targetCtx.fillStyle = color;
    targetCtx.fillRect(p1.x - endR, p1.y - endR, endR * 2, endR * 2);
    targetCtx.fillRect(p2.x - endR, p2.y - endR, endR * 2, endR * 2);

    const lx = (p1.x + p2.x) / 2;
    const ly = (p1.y + p2.y) / 2;
    const shortName = cable.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || cable.name;
    const tag = stats.status === 'ok'
      ? `${shortName} · ${stats.meters.toFixed(2)}m`
      : stats.status === 'warn'
      ? `${shortName} · ${stats.meters.toFixed(2)}m (Tenso)`
      : `${shortName} · ${stats.meters.toFixed(2)}m (> ${stats.maxM}m)`;
    targetCtx.font = '600 9.5px "JetBrains Mono", Consolas, monospace';
    const tw = targetCtx.measureText(tag).width + 10;

    targetCtx.fillStyle = isLight ? '#ffffff' : '#0d0e10';
    targetCtx.fillRect(lx - tw / 2, ly - 8, tw, 16);
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(lx - tw / 2, ly - 8, tw, 16);

    targetCtx.fillStyle = color;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillText(tag, lx, ly);
    targetCtx.restore();
  }

  function drawMeasureOverlay(targetCtx, mapScreen) {
    const pts = state.measurePts;
    const p1 = mapScreen(pts[0].x, pts[0].y);
    targetCtx.save();
    targetCtx.fillStyle = '#c8a96e';
    targetCtx.fillRect(p1.x - 3.5, p1.y - 3.5, 7, 7);

    if (pts.length === 2) {
      const p2 = mapScreen(pts[1].x, pts[1].y);
      targetCtx.fillRect(p2.x - 3.5, p2.y - 3.5, 7, 7);
      targetCtx.beginPath();
      targetCtx.moveTo(p1.x, p1.y);
      targetCtx.lineTo(p2.x, p2.y);
      targetCtx.strokeStyle = '#c8a96e';
      targetCtx.lineWidth = 1.8;
      targetCtx.stroke();

      const distCm = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const label = `${distCm.toFixed(1)} cm (${(distCm / 100).toFixed(2)} m)`;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      targetCtx.font = '600 10px "JetBrains Mono", Consolas, monospace';
      const tw = targetCtx.measureText(label).width + 10;
      targetCtx.fillStyle = '#0d0e10';
      targetCtx.fillRect(mx - tw / 2, my - 9, tw, 18);
      targetCtx.strokeRect(mx - tw / 2, my - 9, tw, 18);
      targetCtx.fillStyle = '#c8a96e';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillText(label, mx, my);
    }
    targetCtx.restore();
  }

  // =========================================================================
  // 8. CONTEXTUAL FLOATING HUD POSITIONING
  // =========================================================================
  function positionHUD() {
    const sel = state.items.find(i => i.id === state.selectedId && i.visible);
    if (!sel || state.measureMode) {
      hudEl.classList.add('hidden');
      return;
    }

    hudEl.classList.remove('hidden');
    document.getElementById('hud-name').textContent = sel.name;
    document.getElementById('hud-dims').textContent = `${Math.round(sel.w)}×${Math.round(sel.h)}×${Math.round(sel.zHeight || 75)} cm • ${Math.round(sel.rot)}°`;
    document.getElementById('hud-lock').setAttribute('aria-pressed', sel.lockedDims ? 'true' : 'false');
    const hudHideBtn = document.getElementById('hud-hide');
    if (hudHideBtn) hudHideBtn.innerHTML = sel.visible ? ICON_EYE : ICON_EYE_OFF;
  }

  // =========================================================================
  // 9. POINTER INTERACTION (MOUSE + MULTI-TOUCH PARITY)
  // =========================================================================
  function hitTestHandles(sx, sy) {
    const sel = state.items.find(i => i.id === state.selectedId && i.visible);
    if (!sel) return null;
    const handles = getHandleScreenPositions(sel);
    const hitRadius = 15;
    for (const h of handles) {
      if (Math.hypot(sx - h.x, sy - h.y) <= hitRadius) return h;
    }
    return null;
  }

  function distPointToSegment(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - a.x, py - a.y);
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function hitTestItem(wx, wy) {
    const ordered = [...state.items].sort((a, b) => {
      if (a.id === state.selectedId) return 1;
      if (b.id === state.selectedId) return -1;
      if (a.ignoreCollision !== b.ignoreCollision) return a.ignoreCollision ? -1 : 1;
      return 0;
    });
    const pt = { x: wx, y: wy };
    for (let i = ordered.length - 1; i >= 0; i--) {
      const item = ordered[i];
      if (!item.visible) continue;
      const polys = getItemPolygons(item);
      if (polys.some(poly => pointInPolygon(pt, poly))) return item;
      if (item.type === 'divider') {
        const g = getDividerGeometry(item);
        const padCm = Math.max(6 / (view.scale || 1), item.h * 0.5 + 3);
        if (g.segments.some(seg => distPointToSegment(wx, wy, seg.p0, seg.p1) <= padCm)) {
          return item;
        }
      }
    }
    return null;
  }

  function bindCanvasPointers() {
    canvas.addEventListener('pointerdown', (e) => {
      cancelActiveAnim();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      interaction.pointers.set(e.pointerId, { sx, sy });
      canvas.setPointerCapture(e.pointerId);

      // 2-finger pinch-to-zoom + pan
      if (interaction.pointers.size === 2) {
        const pts = [...interaction.pointers.values()];
        interaction.mode = 'pinch';
        interaction.pinchStartDist = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy) || 1;
        interaction.pinchStartZoom = state.viewMode === '3d' ? state.cam3d.zoom : state.zoom;
        interaction.pinchStartMid = { x: (pts[0].sx + pts[1].sx) / 2, y: (pts[0].sy + pts[1].sy) / 2 };
        interaction.pinchStartPan = state.viewMode === '3d'
          ? { x: state.cam3d.panX, y: state.cam3d.panY }
          : { x: state.panX, y: state.panY };
        interaction.beforeSnapshot = null;
        return;
      }

      if (state.viewMode === '3d') {
        if (e.button === 1 || e.altKey || e.shiftKey) {
          interaction.mode = 'pan3d';
          interaction.emptyClickCandidate = false;
          interaction.startScreen = { sx, sy };
          interaction.startPan = { x: state.cam3d.panX, y: state.cam3d.panY };
          return;
        }
        const hHit3d = hitTestHandles3D(sx, sy);
        if (hHit3d) {
          const sel = state.items.find(i => i.id === (hHit3d.itemId || state.selectedId));
          if (sel) {
            interaction.beforeSnapshot = snapshotProjectData();
            interaction.mode = 'fold-node';
            interaction.itemId = sel.id;
            interaction.handle = hHit3d.id;
            interaction.nodeIndex = hHit3d.nodeIndex;
            interaction.drag3dPlaneZ = Number(hHit3d.planeZ) || 0;
            interaction.startWorld = unproject3DPlane(sx, sy, rect.width, rect.height, interaction.drag3dPlaneZ);
            interaction.startItem = deepClone(sel);
            interaction.startDividerNodes = getDividerGeometry(sel).nodes;
            interaction.emptyClickCandidate = false;
            canvas.style.cursor = 'grabbing';
            draw();
            return;
          }
        }
        const hit3d = hitTest3D(sx, sy);
        if (hit3d) {
          state.selectedId = hit3d.id;
          interaction.beforeSnapshot = snapshotProjectData();
          interaction.mode = 'drag3d';
          interaction.itemId = hit3d.id;
          interaction.drag3dPlaneZ = 0;
          interaction.startWorld = unproject3DFloor(sx, sy, rect.width, rect.height);
          interaction.startItem = deepClone(hit3d);
          interaction.emptyClickCandidate = false;
          syncUI();
        } else {
          interaction.mode = 'orbit3d';
          interaction.emptyClickCandidate = true;
          interaction.startScreen = { sx, sy };
          interaction.startCam3d = { ...state.cam3d };
        }
        return;
      }

      const w = toWorld(sx, sy);

      // Measure tool mode
      if (state.measureMode) {
        const mx = Math.round(w.x);
        const my = Math.round(w.y);
        if (state.measurePts.length >= 2) state.measurePts = [{ x: mx, y: my }];
        else state.measurePts.push({ x: mx, y: my });
        draw();
        return;
      }

      if (e.button === 1 || e.altKey) {
        interaction.mode = 'pan';
        interaction.emptyClickCandidate = false;
        interaction.startScreen = { sx, sy };
        interaction.startPan = { x: state.panX, y: state.panY };
        return;
      }

      // Check direct handles on currently selected object first
      const handleHit = hitTestHandles(sx, sy);
      if (handleHit) {
        const sel = state.items.find(i => i.id === state.selectedId);
        if (sel) {
          interaction.beforeSnapshot = snapshotProjectData();
          interaction.itemId = sel.id;
          interaction.handle = handleHit.id;
          interaction.startWorld = w;
          interaction.startItem = deepClone(sel);
          if (handleHit.type === 'fold-node') {
            interaction.mode = 'fold-node';
            interaction.nodeIndex = handleHit.nodeIndex;
            interaction.startDividerNodes = getDividerGeometry(sel).nodes;
          } else {
            interaction.mode = handleHit.id === 'rot' ? 'rotate' : 'resize';
          }
          draw();
          return;
        }
      }

      // Check furniture hit
      const hit = hitTestItem(w.x, w.y);
      if (hit) {
        state.selectedId = hit.id;
        interaction.beforeSnapshot = snapshotProjectData();
        interaction.mode = 'drag';
        interaction.itemId = hit.id;
        interaction.startWorld = w;
        interaction.startItem = deepClone(hit);
        syncUI();
      } else {
        // Pan canvas if dragging empty background, or deselect if simple click
        interaction.mode = 'pan';
        interaction.emptyClickCandidate = true;
        interaction.startScreen = { sx, sy };
        interaction.startPan = { x: state.panX, y: state.panY };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (interaction.pointers.has(e.pointerId)) {
        interaction.pointers.set(e.pointerId, { sx, sy });
      }

      const activePlaneZ = state.viewMode === '3d' && interaction.mode === 'fold-node'
        ? (interaction.drag3dPlaneZ || 0)
        : 0;
      const w = state.viewMode === '3d'
        ? unproject3DPlane(sx, sy, rect.width, rect.height, activePlaneZ)
        : toWorld(sx, sy);
      document.getElementById('cursor-coords').textContent = `X: ${Math.round(w.x)} cm | Y: ${Math.round(w.y)} cm`;

      if (interaction.mode === 'pinch' && interaction.pointers.size === 2) {
        const pts = [...interaction.pointers.values()];
        const dist = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy) || 1;
        const mid = { x: (pts[0].sx + pts[1].sx) / 2, y: (pts[0].sy + pts[1].sy) / 2 };
        if (state.viewMode === '3d') {
          state.cam3d.zoom = Math.max(0.45, Math.min(3.5, Number((interaction.pinchStartZoom * (dist / interaction.pinchStartDist)).toFixed(2))));
          state.cam3d.panX = interaction.pinchStartPan.x + (mid.x - interaction.pinchStartMid.x);
          state.cam3d.panY = interaction.pinchStartPan.y + (mid.y - interaction.pinchStartMid.y);
          setZoomLabel(state.cam3d.zoom);
        } else {
          state.zoom = Math.max(0.4, Math.min(4.5, Number((interaction.pinchStartZoom * (dist / interaction.pinchStartDist)).toFixed(2))));
          state.panX = interaction.pinchStartPan.x + (mid.x - interaction.pinchStartMid.x);
          state.panY = interaction.pinchStartPan.y + (mid.y - interaction.pinchStartMid.y);
          setZoomLabel(state.zoom);
        }
        draw();
        positionHUD();
        return;
      }

      if (interaction.mode === 'orbit3d') {
        const dxScreen = sx - interaction.startScreen.sx;
        const dyScreen = sy - interaction.startScreen.sy;
        if (interaction.emptyClickCandidate && Math.hypot(dxScreen, dyScreen) > 4) {
          interaction.emptyClickCandidate = false;
        }
        if (!interaction.emptyClickCandidate) {
          state.cam3d.yaw = interaction.startCam3d.yaw + dxScreen * 0.45;
          state.cam3d.pitch = Math.max(14, Math.min(82, interaction.startCam3d.pitch + dyScreen * 0.35));
          draw();
        }
        return;
      }

      if (interaction.mode === 'pan3d') {
        state.cam3d.panX = interaction.startPan.x + (sx - interaction.startScreen.sx);
        state.cam3d.panY = interaction.startPan.y + (sy - interaction.startScreen.sy);
        draw();
        return;
      }

      if (interaction.mode === 'pan') {
        const dxScreen = sx - interaction.startScreen.sx;
        const dyScreen = sy - interaction.startScreen.sy;
        if (interaction.emptyClickCandidate && Math.hypot(dxScreen, dyScreen) > 4) {
          interaction.emptyClickCandidate = false;
        }
        if (!interaction.emptyClickCandidate) {
          state.panX = interaction.startPan.x + dxScreen;
          state.panY = interaction.startPan.y + dyScreen;
          draw();
          positionHUD();
        }
        return;
      }

      if (!interaction.mode || !interaction.itemId) {
        if (state.viewMode === '3d') {
          if (hitTestHandles3D(sx, sy)) canvas.style.cursor = 'pointer';
          else if (hitTest3D(sx, sy)) canvas.style.cursor = 'move';
          else canvas.style.cursor = 'grab';
          return;
        }
        const hHit = hitTestHandles(sx, sy);
        if (hHit) canvas.style.cursor = hHit.cursor;
        else if (hitTestItem(w.x, w.y)) canvas.style.cursor = 'move';
        else canvas.style.cursor = state.measureMode ? 'crosshair' : 'default';
        return;
      }

      const item = state.items.find(i => i.id === interaction.itemId);
      if (!item) return;

      if (interaction.mode === 'drag' || interaction.mode === 'drag3d') {
        item.x = interaction.startItem.x + (w.x - interaction.startWorld.x);
        item.y = interaction.startItem.y + (w.y - interaction.startWorld.y);
        applySnapping(item);
        syncUI();
      } else if (interaction.mode === 'fold-node') {
        const startNodes = interaction.startDividerNodes;
        const idx = interaction.nodeIndex;
        const step = e.altKey ? 1 : 15;
        const anchorIdx = idx === 0 ? 1 : idx - 1;
        const anchorPt = startNodes[anchorIdx];
        if (!Array.isArray(item.foldAngles) || item.foldAngles.length !== 3) item.foldAngles = [0, 0, 0];

        if (idx === 0) {
          const ang = (Math.atan2(anchorPt.y - w.y, anchorPt.x - w.x) * 180) / Math.PI;
          const snapped = normalizeAngle(Math.round(ang / step) * step);
          const sFolds = sanitizeFoldAngles(interaction.startItem.foldAngles);
          const oldGlobal1 = (interaction.startItem.rot || 0) + sFolds[0];
          item.rot = snapped;
          item.foldAngles[0] = Math.max(-135, Math.min(135, normalizeSignedAngle(oldGlobal1 - snapped)));
          const cur = getDividerGeometry(item);
          item.x = Math.round((item.x + anchorPt.x - cur.nodes[1].x) * 10) / 10;
          item.y = Math.round((item.y + anchorPt.y - cur.nodes[1].y) * 10) / 10;
        } else if (idx === 1) {
          const ang = (Math.atan2(w.y - anchorPt.y, w.x - anchorPt.x) * 180) / Math.PI;
          item.rot = normalizeAngle(Math.round(ang / step) * step);
          const cur = getDividerGeometry(item);
          item.x = Math.round((item.x + anchorPt.x - cur.nodes[0].x) * 10) / 10;
          item.y = Math.round((item.y + anchorPt.y - cur.nodes[0].y) * 10) / 10;
        } else {
          const ang = (Math.atan2(w.y - anchorPt.y, w.x - anchorPt.x) * 180) / Math.PI;
          const snapped = Math.round(ang / step) * step;
          let incoming = item.rot || 0;
          for (let k = 0; k < idx - 2; k++) incoming += (item.foldAngles[k] || 0);
          item.foldAngles[idx - 2] = Math.max(-135, Math.min(135, normalizeSignedAngle(snapped - incoming)));
          const cur = getDividerGeometry(item);
          item.x = Math.round((item.x + startNodes[0].x - cur.nodes[0].x) * 10) / 10;
          item.y = Math.round((item.y + startNodes[0].y - cur.nodes[0].y) * 10) / 10;
        }
        syncUI();
      } else if (interaction.mode === 'rotate') {
        const angle = (Math.atan2(w.y - item.y, w.x - item.x) * 180) / Math.PI + 90;
        const step = e.altKey ? 1 : (e.shiftKey ? 45 : 15);
        item.rot = normalizeAngle(Math.round(angle / step) * step);
        syncUI();
      } else if (interaction.mode === 'resize') {
        const dx = w.x - interaction.startWorld.x;
        const dy = w.y - interaction.startWorld.y;
        applyAnchoredResize(item, interaction.startItem, interaction.handle, dx, dy, e.shiftKey);
        syncUI();
      }
    });

    const endPointer = (e) => {
      interaction.pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (interaction.pointers.size === 0 && interaction.mode) {
        const wasEmptyClick = (interaction.mode === 'pan' || interaction.mode === 'orbit3d') && interaction.emptyClickCandidate;
        if (interaction.beforeSnapshot && interaction.itemId) {
          const item = state.items.find(i => i.id === interaction.itemId);
          const s = interaction.startItem;
          const foldChanged = JSON.stringify(item && item.foldAngles) !== JSON.stringify(s && s.foldAngles);
          if (item && s && (item.x !== s.x || item.y !== s.y || item.w !== s.w || item.h !== s.h || item.rot !== s.rot || foldChanged)) {
            pushUndoSnapshot(interaction.beforeSnapshot);
            saveState();
          }
        }
        interaction.mode = null;
        interaction.itemId = null;
        interaction.nodeIndex = -1;
        interaction.drag3dPlaneZ = 0;
        interaction.startDividerNodes = null;
        interaction.beforeSnapshot = null;
        interaction.emptyClickCandidate = false;
        state.snapGuides = [];
        if (wasEmptyClick && state.selectedId !== null) {
          state.selectedId = null;
          syncUI();
        } else {
          draw();
        }
      }
    };

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (state.viewMode === '3d') {
        const hit = hitTest3D(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) openItemDialog(hit.id);
        return;
      }
      const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = hitTestItem(w.x, w.y);
      if (hit) openItemDialog(hit.id);
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.12 : -0.12);
    }, { passive: false });
  }

  // =========================================================================
  // 10. ACTIONS: ROTATE, WALL SNAP, DUPLICATE, DELETE, QUICK ADD, PHOTO
  // =========================================================================
  function getSelectedItem() {
    return state.items.find(i => i.id === state.selectedId) || null;
  }

  function mutateSelected(fn, label) {
    const sel = getSelectedItem();
    if (!sel) return;
    pushUndoSnapshot();
    fn(sel);
    saveState();
    syncUI();
    if (label) showToast(label);
  }

  function rotateSelected(deltaDeg) {
    const sel = getSelectedItem();
    if (!sel) return;
    pushUndoSnapshot();
    const startRot = sel.rot || 0;
    const targetRot = normalizeAngle(startRot + deltaDeg);
    animateTransition(200, (t) => {
      sel.rot = normalizeAngle(startRot + deltaDeg * t);
    }, () => {
      sel.rot = targetRot;
      saveState();
      syncUI();
    });
  }

  function setSelectedRotation(deg) {
    const sel = getSelectedItem();
    if (!sel) return;
    pushUndoSnapshot();
    const startRot = sel.rot || 0;
    const targetRot = normalizeAngle(deg);
    const delta = shortAngleDelta(startRot, targetRot);
    animateTransition(200, (t) => {
      sel.rot = normalizeAngle(startRot + delta * t);
    }, () => {
      sel.rot = targetRot;
      saveState();
      syncUI();
    });
  }

  function setDividerFoldPreset(presetKey) {
    const sel = getSelectedItem();
    if (!sel || sel.type !== 'divider') return;
    const targetFolds = DIVIDER_FOLD_PRESETS[presetKey];
    if (!targetFolds) return;
    pushUndoSnapshot();
    const startFolds = sanitizeFoldAngles(sel.foldAngles);
    animateTransition(240, (t) => {
      sel.foldAngles = startFolds.map((a, idx) => Math.round((a + (targetFolds[idx] - a) * t) * 10) / 10);
    }, () => {
      sel.foldAngles = [...targetFolds];
      saveState();
      syncUI();
    });
  }

  function snapSelectedToNearestWall() {
    const sel = getSelectedItem();
    if (!sel) return;
    pushUndoSnapshot();
    const startX = sel.x;
    const startY = sel.y;
    const temp = deepClone(sel);
    const box = getAABB(temp);
    const dW = box.minX;
    const dE = state.room.w - box.maxX;
    const dN = box.minY;
    const dS = state.room.h - box.maxY;
    const minD = Math.min(dW, dE, dN, dS);
    if (minD === dW) temp.x -= dW;
    else if (minD === dE) temp.x += dE;
    else if (minD === dN) temp.y -= dN;
    else temp.y += dS;
    roundItemCornerToCm(temp);

    animateTransition(200, (t) => {
      sel.x = startX + (temp.x - startX) * t;
      sel.y = startY + (temp.y - startY) * t;
    }, () => {
      sel.x = temp.x;
      sel.y = temp.y;
      saveState();
      syncUI();
      showToast('Encostado à parede');
    });
  }

  function centerSelectedItem(vertical = false) {
    const sel = getSelectedItem();
    if (!sel) return;
    pushUndoSnapshot();
    const startX = sel.x;
    const startY = sel.y;
    const temp = deepClone(sel);
    const cInfo = computeCenteringInfo(temp);
    if (vertical) {
      const useRoom = Math.abs(cInfo.box.minY - cInfo.gapTargetMinY) <= 0.6 && cInfo.gapTargetMinY !== cInfo.roomTargetMinY;
      const targetMinY = useRoom ? cInfo.roomTargetMinY : cInfo.gapTargetMinY;
      temp.y += targetMinY - cInfo.box.minY;
    } else {
      const useRoom = Math.abs(cInfo.box.minX - cInfo.gapTargetMinX) <= 0.6 && cInfo.gapTargetMinX !== cInfo.roomTargetMinX;
      const targetMinX = useRoom ? cInfo.roomTargetMinX : cInfo.gapTargetMinX;
      temp.x += targetMinX - cInfo.box.minX;
    }
    roundItemCornerToCm(temp);

    const after = computeCenteringInfo(temp);
    const info = vertical ? after.centeredY : after.centeredX;
    let feedback = 'Centrado';
    if (info && info.kind !== 'item') {
      const d1 = vertical ? info.topCm : info.leftCm;
      const d2 = vertical ? info.botCm : info.rightCm;
      const arrow = vertical ? '↕' : '↔';
      feedback = `Centrado ${vertical ? 'vertical' : 'horizontal'} (${d1}${arrow}${d2} cm)`;
    }

    animateTransition(220, (t) => {
      sel.x = startX + (temp.x - startX) * t;
      sel.y = startY + (temp.y - startY) * t;
    }, () => {
      sel.x = temp.x;
      sel.y = temp.y;
      saveState();
      syncUI();
      showToast(feedback);
    });
  }

  function toggleSelectedLock() {
    mutateSelected(sel => {
      sel.lockedDims = !sel.lockedDims;
    }, 'Cadeado de medidas atualizado');
  }

  function toggleVisibility(id, forceVal) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    pushUndoSnapshot();
    item.visible = typeof forceVal === 'boolean' ? forceVal : !item.visible;
    saveState();
    syncUI();
  }

  function duplicateItem(id) {
    const orig = state.items.find(i => i.id === id);
    if (!orig) return;
    pushUndoSnapshot();
    const copy = deepClone(orig);
    copy.id = uid('item');
    copy.name = `${orig.name} (cópia)`;
    copy.x = Math.min(state.room.w - 15, orig.x + 15);
    copy.y = Math.min(state.room.h - 15, orig.y + 15);
    copy.visible = true;
    state.items.push(copy);
    state.selectedId = copy.id;
    saveState();
    syncUI();
    showToast(`Duplicado: ${orig.name}`);
  }

  async function deleteItem(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    pushUndoSnapshot();
    state.items = state.items.filter(i => i.id !== id);
    state.cables = state.cables.filter(c => c.fromId !== id && c.toId !== id);
    if (state.selectedId === id) {
      state.selectedId = state.items[0] ? state.items[0].id : null;
    }
    saveState();
    syncUI();
    showToast(`Removido: ${item.name} (Ctrl+Z para desfazer)`);
  }

  function compressImageToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 320;
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * ratio));
          c.height = Math.max(1, Math.round(img.height * ratio));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleQuickAdd() {
    const input = document.getElementById('quick-add-input');
    const parsed = window.parseQuickAddText(input.value);
    if (!parsed) {
      showToast('Escreve um nome e medidas (ex: Mesa 80x50x75)');
      input.focus();
      return;
    }

    pushUndoSnapshot();
    const newItem = {
      id: uid('item'),
      name: parsed.name,
      type: parsed.type,
      w: parsed.w,
      h: parsed.h,
      zHeight: parsed.zHeight,
      x: Math.round(state.room.w / 2),
      y: Math.round(state.room.h / 2),
      rot: 0,
      foldAngles: parsed.type === 'divider' ? [0, 0, 0] : undefined,
      color: parsed.color,
      ignoreCollision: parsed.ignoreCollision,
      lockedDims: false,
      visible: true,
      photoDataUrl: state.quickPhotoDataUrl || null
    };
    state.items.push(newItem);
    state.selectedId = newItem.id;
    input.value = '';
    clearQuickPhoto();
    document.getElementById('quick-add-preview').classList.add('hidden');
    saveState();
    syncUI();
    showToast(`Adicionado: ${newItem.name} (${newItem.w}×${newItem.h}×${newItem.zHeight} cm)`);
  }

  function clearQuickPhoto() {
    state.quickPhotoDataUrl = null;
    document.getElementById('quick-add-photo').value = '';
    document.getElementById('quick-photo-chip').classList.add('hidden');
  }

  // =========================================================================
  // 11. LAYOUTS MANAGEMENT
  // =========================================================================
  function shortAngleDelta(fromDeg, toDeg) {
    return ((toDeg - fromDeg + 540) % 360) - 180;
  }

  function switchLayout(layoutId) {
    const layout = state.layouts.find(l => l.id === layoutId);
    if (!layout) return;
    pushUndoSnapshot();
    state.activeLayoutId = layout.id;

    const animPlans = [];
    for (const item of state.items) {
      const p = layout.placements[item.id];
      if (!p) continue;

      const start = {
        x: item.x,
        y: item.y,
        rot: item.rot,
        w: item.w,
        h: item.h,
        foldAngles: item.type === 'divider' ? sanitizeFoldAngles(item.foldAngles) : [0, 0, 0]
      };

      const temp = deepClone(item);
      if (typeof p.w === 'number') temp.w = p.w;
      if (typeof p.h === 'number') temp.h = p.h;
      if (typeof p.zHeight === 'number') item.zHeight = p.zHeight;
      temp.rot = Number(p.rot ?? 0);
      item.visible = p.visible !== undefined ? Boolean(p.visible) : true;
      if (item.type === 'divider') {
        temp.foldAngles = sanitizeFoldAngles(p.foldAngles);
      }
      if (typeof p.cx === 'number' && typeof p.cy === 'number') {
        temp.x = p.cx;
        temp.y = p.cy;
      } else if (typeof p.minX === 'number' && typeof p.minY === 'number') {
        placeFromAABB(temp, p.minX, p.minY);
      }

      animPlans.push({
        item,
        start,
        target: {
          x: temp.x,
          y: temp.y,
          rot: temp.rot,
          dRot: shortAngleDelta(start.rot, temp.rot),
          w: temp.w,
          h: temp.h,
          foldAngles: temp.foldAngles || [0, 0, 0]
        }
      });
    }

    syncUI();
    showToast(`Layout: ${layout.name}`);

    animateTransition(260, (t) => {
      for (const plan of animPlans) {
        const { item, start, target } = plan;
        item.x = start.x + (target.x - start.x) * t;
        item.y = start.y + (target.y - start.y) * t;
        item.rot = normalizeAngle(start.rot + target.dRot * t);
        item.w = start.w + (target.w - start.w) * t;
        item.h = start.h + (target.h - start.h) * t;
        if (item.type === 'divider') {
          item.foldAngles = start.foldAngles.map((a, idx) => a + (target.foldAngles[idx] - a) * t);
        }
      }
    }, () => {
      for (const plan of animPlans) {
        const { item, target } = plan;
        item.x = Math.round(target.x * 10) / 10;
        item.y = Math.round(target.y * 10) / 10;
        item.rot = target.rot;
        item.w = target.w;
        item.h = target.h;
        if (item.type === 'divider') {
          item.foldAngles = [...target.foldAngles];
        }
      }
      saveState();
      syncUI();
    });
  }

  function saveCurrentAsLayout(name) {
    const placements = {};
    for (const item of state.items) {
      const box = getAABB(item);
      const entry = {
        minX: Number(box.minX.toFixed(1)),
        minY: Number(box.minY.toFixed(1)),
        cx: item.x,
        cy: item.y,
        rot: item.rot,
        w: item.w,
        h: item.h,
        zHeight: item.zHeight,
        visible: item.visible
      };
      if (item.type === 'divider') {
        entry.foldAngles = sanitizeFoldAngles(item.foldAngles);
      }
      placements[item.id] = entry;
    }
    const newLayout = {
      id: uid('layout'),
      name: name.trim(),
      builtIn: false,
      placements
    };
    state.layouts.push(newLayout);
    state.activeLayoutId = newLayout.id;
    saveState();
    syncUI();
    showToast(`Layout guardado: ${newLayout.name}`);
  }

  function deleteActiveCustomLayout() {
    const layout = state.layouts.find(l => l.id === state.activeLayoutId);
    if (!layout || layout.builtIn) return;
    pushUndoSnapshot();
    state.layouts = state.layouts.filter(l => l.id !== layout.id);
    state.activeLayoutId = state.layouts[0].id;
    saveState();
    syncUI();
    showToast(`Layout apagado: ${layout.name}`);
  }

  // =========================================================================
  // 12. MODALS (<dialog> + Top-Layer Transitions + Light Dismiss + Validation)
  // =========================================================================
  const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function canTransitionDisplay() {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    return CSS.supports('transition-behavior', 'allow-discrete') &&
      CSS.supports('selector(:popover-open)');
  }

  function supportsTopLayerExit() {
    if (!canTransitionDisplay()) return false;
    const probe = document.createElement('style');
    probe.textContent = '@starting-style { x-probe { opacity: 0; } }';
    document.head.appendChild(probe);
    const supported = Boolean(probe.sheet && probe.sheet.cssRules && probe.sheet.cssRules.length);
    probe.remove();
    return supported;
  }

  const HAS_TOP_LAYER_EXIT = supportsTopLayerExit();

  function closeTopLayer(element) {
    if (!element) return;
    if (element instanceof HTMLDialogElement) {
      if (!element.open || element.hasAttribute('data-closing')) return;
      if (reducedMotionQuery.matches || HAS_TOP_LAYER_EXIT) {
        element.close();
        return;
      }
      element.setAttribute('data-closing', '');
      void getComputedStyle(element).opacity;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        element.removeEventListener('transitionend', done);
        if (element.open) element.close();
        element.removeAttribute('data-closing');
      };
      element.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 250);
    } else if (typeof element.hidePopover === 'function') {
      element.hidePopover();
    }
  }

  function openDialogSafe(id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    dlg.removeAttribute('data-closing');
    if (!dlg.open) dlg.showModal();
  }

  function closeDialogSafe(id) {
    const dlg = document.getElementById(id);
    if (dlg && dlg.open) closeTopLayer(dlg);
  }

  function openConfirmDialog(title, msg) {
    return new Promise((resolve) => {
      const dlg = document.getElementById('confirm-dialog');
      document.getElementById('confirm-dialog-title').textContent = title;
      document.getElementById('confirm-dialog-msg').textContent = msg;
      dlg.returnValue = '';
      const onClose = () => {
        const res = dlg.returnValue === 'confirm';
        dlg.returnValue = '';
        dlg.removeEventListener('close', onClose);
        resolve(res);
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    });
  }

  function openItemDialog(itemId = null) {
    state.editingItemId = itemId;
    state.pendingModalPhoto = null;
    const item = itemId ? state.items.find(i => i.id === itemId) : null;

    document.getElementById('item-dialog-title').textContent = item ? `Editar: ${item.name}` : 'Novo Móvel / Objeto';
    document.getElementById('dlg-item-name').value = item ? item.name : '';
    document.getElementById('dlg-item-w').value = item ? Math.round(item.w) : 80;
    document.getElementById('dlg-item-h').value = item ? Math.round(item.h) : 50;
    document.getElementById('dlg-item-z').value = item ? Math.round(item.zHeight || 75) : 75;
    document.getElementById('dlg-item-type').value = item ? item.type : 'box';
    document.getElementById('dlg-item-ignore-col').checked = item ? Boolean(item.ignoreCollision) : false;
    document.getElementById('dlg-item-locked').checked = item ? Boolean(item.lockedDims) : false;
    document.getElementById('dlg-item-photo').value = '';

    const selectedColor = item ? item.color : 'zinc';
    renderColorSwatches(selectedColor);
    openDialogSafe('item-dialog');
  }

  function renderColorSwatches(activeKey) {
    const container = document.getElementById('dlg-color-swatches');
    container.innerHTML = '';
    for (const [key, pal] of Object.entries(window.COLOR_PALETTE)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn';
      btn.dataset.color = key;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', pal.label);
      btn.setAttribute('aria-checked', key === activeKey ? 'true' : 'false');
      btn.style.backgroundColor = pal.stroke;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.swatch-btn').forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
      });
      container.appendChild(btn);
    }
  }

  function openCableDialog(cableId = null) {
    state.editingCableId = cableId;
    const cable = cableId ? state.cables.find(c => c.id === cableId) : null;

    document.getElementById('cable-dialog-title').textContent = cable ? `Editar Cabo: ${cable.name}` : 'Novo Cabo / Ligação';
    document.getElementById('dlg-cable-name').value = cable ? cable.name : 'Cabo Novo';
    document.getElementById('dlg-cable-max').value = cable ? cable.maxMeters : 3.0;
    document.getElementById('dlg-cable-mode').value = cable ? (cable.routingMode || 'direct') : 'direct';

    const optsHtml = [
      '<optgroup label="Móveis">',
      ...state.items.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`),
      '</optgroup>',
      '<optgroup label="Tomadas da Parede">',
      ...state.room.outlets.map(o => `<option value="${escapeHtml(o.id)}">Tomada ${escapeHtml(o.name || o.id)}</option>`),
      '</optgroup>'
    ].join('');

    const selFrom = document.getElementById('dlg-cable-from');
    const selTo = document.getElementById('dlg-cable-to');
    selFrom.innerHTML = optsHtml;
    selTo.innerHTML = optsHtml;
    if (cable) {
      selFrom.value = cable.fromId;
      selTo.value = cable.toId;
    } else if (state.items.length > 0 && state.room.outlets.length > 0) {
      selFrom.value = state.selectedId || state.items[0].id;
      selTo.value = state.room.outlets[0].id;
    }
    openDialogSafe('cable-dialog');
  }

  function openJsonDialog() {
    const payload = snapshotProjectData();
    document.getElementById('json-textarea').value = JSON.stringify(payload, null, 2);
    document.getElementById('json-feedback').textContent = '';
    openDialogSafe('json-dialog');
  }

  function applyImportedJson(rawText) {
    const fb = document.getElementById('json-feedback');
    try {
      const parsed = JSON.parse(rawText);
      if (!parsed || typeof parsed !== 'object') throw new Error('JSON não é um objeto válido.');

      pushUndoSnapshot();

      // Support both full V2 schema and simple V1 array/items export
      if (parsed.room && typeof parsed.room.w === 'number' && typeof parsed.room.h === 'number') {
        state.room = {
          name: String(parsed.room.name || 'Quarto').slice(0, 60),
          w: Math.max(100, Math.min(2000, Number(parsed.room.w))),
          h: Math.max(100, Math.min(2000, Number(parsed.room.h))),
          wallThickness: Number(parsed.room.wallThickness) || 14,
          doors: Array.isArray(parsed.room.doors) ? parsed.room.doors : state.room.doors,
          windows: Array.isArray(parsed.room.windows) ? parsed.room.windows : state.room.windows,
          outlets: Array.isArray(parsed.room.outlets) ? parsed.room.outlets : state.room.outlets
        };
      }

      if (Array.isArray(parsed.cables)) {
        state.cables = parsed.cables.map(c => ({
          id: String(c.id || uid('cable')),
          name: String(c.name || 'Cabo').slice(0, 50),
          fromId: String(c.fromId || ''),
          toId: String(c.toId || ''),
          maxMeters: Math.max(0.3, Math.min(50, Number(c.maxMeters) || 3.0)),
          warnMeters: Number(c.warnMeters) || (Number(c.maxMeters) || 3.0) * 0.85,
          routingMode: c.routingMode === 'wall' ? 'wall' : 'direct',
          visible: c.visible !== false
        }));
      }

      if (Array.isArray(parsed.layouts) && parsed.layouts.length > 0) {
        state.layouts = parsed.layouts;
        state.activeLayoutId = (parsed.activeLayoutId && state.layouts.some(l => l.id === parsed.activeLayoutId))
          ? parsed.activeLayoutId
          : state.layouts[0].id;
      }

      const rawItems = Array.isArray(parsed.items) ? parsed.items : (Array.isArray(parsed.furniture) ? parsed.furniture : null);
      if (rawItems) {
        state.items = rawItems.map(it => {
          const itemType = String(it.type || 'box');
          return {
            id: String(it.id || uid('item')),
            name: String(it.name || it.nome || 'Móvel').slice(0, 60),
            type: itemType,
            w: Math.max(4, Math.min(600, Number(it.w ?? it.width ?? 60))),
            h: Math.max(4, Math.min(600, Number(it.h ?? it.depth ?? 45))),
            zHeight: Math.max(1, Math.min(350, Number(it.zHeight ?? 75))),
            x: Number(it.cx ?? it.x ?? 60),
            y: Number(it.cy ?? it.y ?? 60),
            rot: Number(it.rot ?? it.rotation ?? 0),
            foldAngles: itemType === 'divider' ? sanitizeFoldAngles(it.foldAngles) : undefined,
            color: window.COLOR_PALETTE[it.color] ? it.color : 'zinc',
            ignoreCollision: Boolean(it.ignoreCollision),
            lockedDims: Boolean(it.lockedDims),
            visible: it.visible !== false,
            adjustable: Boolean(it.adjustable),
            photoDataUrl: typeof it.photoDataUrl === 'string' && it.photoDataUrl.startsWith('data:image/') ? it.photoDataUrl : null
          };
        });
      } else if (Array.isArray(parsed.catalog)) {
        const lay = state.layouts.find(l => l.id === state.activeLayoutId) || state.layouts[0] || { placements: {} };
        state.items = buildItemsFromLayout(parsed.catalog, lay);
      }

      if (state.items.length > 0 && !state.items.some(i => i.id === state.selectedId)) {
        state.selectedId = state.items[0].id;
      }

      saveState();
      syncUI();
      closeDialogSafe('json-dialog');
      showToast('Configuração JSON carregada!');
    } catch (err) {
      fb.textContent = `Erro ao ler JSON: ${err.message}`;
    }
  }

  function exportPNG() {
    const scale = 2; // 2x Retina sharp export
    const pad = 64;
    const wPx = Math.round((state.room.w + pad * 2) * scale);
    const hPx = Math.round((state.room.h + pad * 2 + 40) * scale);

    const off = document.createElement('canvas');
    off.width = wPx;
    off.height = hPx;
    const octx = off.getContext('2d');
    octx.scale(scale, scale);

    const exportView = { scale: 1, ox: pad, oy: pad };
    drawSceneToContext(octx, wPx / scale, hPx / scale, exportView, 'dark');

    // Architectural stamp footer
    octx.fillStyle = '#9a9891';
    octx.font = '600 10px "JetBrains Mono", Consolas, monospace';
    octx.textAlign = 'left';
    octx.fillText(`SimpleCAD • ${state.room.name || 'Planta'} • ${state.room.w}×${state.room.h} cm`, pad, state.room.h + pad + 44);

    const slug = (state.room.name || 'planta').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const link = document.createElement('a');
    link.download = `simplecad-${slug}-${state.room.w}x${state.room.h}.png`;
    link.href = off.toDataURL('image/png');
    link.click();
    showToast('Imagem PNG guardada!');
  }

  // =========================================================================
  // 13. UI SYNC & RENDERING SIDEBAR PANELS
  // =========================================================================
  function switchTab(tabName) {
    state.activeTab = tabName;
    const tabs = ['furniture', 'cables', 'room'];
    for (const t of tabs) {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pnl = document.getElementById(`panel-${t}`);
      const active = t === tabName;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      pnl.classList.toggle('hidden', !active);
    }
  }

  const ICON_EYE = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICON_EYE_OFF = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const ICON_EDIT = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  const ICON_DUP = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const ICON_TRASH = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  const ARCHETYPE_ICONS = {
    bed: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 11v9"/><path d="M22 11v9"/><path d="M2 16h20"/><path d="M2 11h20"/><path d="M7 11V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4"/><path d="M12 11V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4"/></svg>',
    nightstand: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="14" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="10" y1="7.5" x2="14" y2="7.5"/><line x1="10" y1="14.5" x2="14" y2="14.5"/><path d="M6 18v2"/><path d="M18 18v2"/></svg>',
    wardrobe: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="17" rx="2"/><line x1="12" y1="3" x2="12" y2="20"/><line x1="9" y1="10" x2="9" y2="13"/><line x1="15" y1="10" x2="15" y2="13"/><path d="M6 20v2"/><path d="M18 20v2"/></svg>',
    desk: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v3H3z"/><path d="M5 10v10"/><path d="M19 10v10"/><path d="M15 10v6h4"/></svg>',
    chair: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>',
    sofa: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/></svg>',
    tv: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/></svg>',
    pc: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M15 14h.01"/><path d="M9 6h6"/><path d="M9 10h6"/></svg>',
    shelf: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>',
    divider: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5l4.5-1.5v15L3 20z"/><path d="M7.5 3.5l4.5 1.5v15l-4.5-1.5z"/><path d="M12 5l4.5-1.5v15L12 20z"/><path d="M16.5 3.5L21 5v15l-4.5-1.5z"/></svg>',
    easel: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3"/><rect x="6" y="6" width="12" height="9" rx="1"/><path d="M5 15h14"/><path d="M8 15l-2 6"/><path d="M16 15l2 6"/><path d="M12 15v5"/></svg>',
    mirror: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M10 8l4-3"/><path d="M10 12l4-3"/></svg>',
    lamp: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l2 5H7z"/><path d="M12 8v13"/><path d="M8 21h8"/></svg>',
    plant: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z"/></svg>',
    appliance: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="15" y1="12" x2="15" y2="15"/><path d="M15 6h.01"/></svg>',
    rug: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1.5"/><rect x="7.5" y="9.5" width="9" height="5" rx="0.5"/><path d="M2 8h2M2 12h2M2 16h2M20 8h2M20 12h2M20 16h2"/></svg>',
    box: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
  };

  function syncSliderValue(slider) {
    if (!slider) return;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const val = Number(slider.value || min);
    slider.style.setProperty('--attr-min', String(min));
    slider.style.setProperty('--attr-max', String(max));
    slider.style.setProperty('--control-value', String(val));
    slider.setAttribute('aria-valuetext', `${Math.round(val)} centímetros`);
  }

  function syncUI() {
    document.getElementById('room-size-badge').textContent = `${state.room.w}×${state.room.h} cm`;
    document.title = state.room.name ? `SimpleCAD — ${state.room.name}` : `SimpleCAD — ${state.room.w}×${state.room.h} cm`;

    // Populate Layouts Dropdown
    const laySel = document.getElementById('layout-select');
    laySel.innerHTML = state.layouts.map(l =>
      `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`
    ).join('');
    laySel.value = state.activeLayoutId;
    const activeLay = state.layouts.find(l => l.id === state.activeLayoutId);
    document.getElementById('btn-delete-layout').classList.toggle('hidden', !activeLay || activeLay.builtIn);

    // View mode segmented buttons & 3D hint
    const v2d = document.getElementById('btn-view-2d');
    const vCab = document.getElementById('btn-view-cables');
    const v3d = document.getElementById('btn-view-3d');
    if (v2d) v2d.setAttribute('aria-pressed', state.viewMode === '2d' ? 'true' : 'false');
    if (vCab) vCab.setAttribute('aria-pressed', state.viewMode === 'cables' ? 'true' : 'false');
    if (v3d) v3d.setAttribute('aria-pressed', state.viewMode === '3d' ? 'true' : 'false');
    const hint3d = document.getElementById('view-3d-hint');
    if (hint3d) hint3d.classList.toggle('hidden', state.viewMode !== '3d');

    const curZoom = state.viewMode === '3d' ? state.cam3d.zoom : state.zoom;
    setZoomLabel(curZoom);

    // Toolbar toggles
    const gridBtn = document.getElementById('btn-grid');
    gridBtn.setAttribute('aria-pressed', state.gridStep > 0 ? 'true' : 'false');
    gridBtn.title = state.gridStep === 0 ? 'Grelha: OFF (clica para 5cm)' : `Grelha: ${state.gridStep}cm (clica para alternar 5cm / 1cm / OFF)`;
    const snapBtn = document.getElementById('btn-snap');
    snapBtn.setAttribute('aria-pressed', state.wallSnap ? 'true' : 'false');

    const measBtn = document.getElementById('btn-measure');
    measBtn.setAttribute('aria-pressed', state.measureMode ? 'true' : 'false');

    // Primary Cable Top Pill
    const firstCable = state.cables.find(c => c.visible);
    const pill = document.getElementById('hdmi-readout');
    const pillTxt = document.getElementById('hdmi-readout-text');
    pill.classList.remove('is-ok', 'is-warn', 'is-bad');
    if (firstCable) {
      const stats = computeCableStats(firstCable);
      if (stats) {
        pillTxt.textContent = `${firstCable.name.replace(/\s*\(.*?\)/, '')}: ${stats.meters.toFixed(2)} / ${stats.maxM.toFixed(1)}m`;
        pill.classList.add(`is-${stats.status}`);
      } else {
        pillTxt.textContent = `${firstCable.name}: N/A`;
      }
    } else {
      pillTxt.textContent = 'Cabos: --';
    }

    // Collisions (only rendered/visible when problems exist)
    const { bad: collisions, messages: colMsgs } = computeCollisions();
    const colStrip = document.getElementById('collision-strip');
    const colBadge = document.getElementById('collision-badge');
    const colList = document.getElementById('collision-list');
    colStrip.classList.toggle('hidden', colMsgs.length === 0);
    if (colMsgs.length > 0) {
      colBadge.textContent = `${colMsgs.length}`;
      colBadge.className = 'badge-bad';
      colList.innerHTML = colMsgs.map(m => `<div class="col-msg-bad">${escapeHtml(m)}</div>`).join('');
    } else {
      colList.innerHTML = '';
    }

    // Bottom readout conditional status
    const statusSep = document.getElementById('status-sep');
    const statusMsg = document.getElementById('status-msg');
    if (state.measureMode) {
      statusSep.classList.remove('hidden');
      statusMsg.classList.remove('hidden');
      statusMsg.textContent = 'Régua: 2 pontos · Esc para sair';
    } else if (colMsgs.length > 0) {
      statusSep.classList.remove('hidden');
      statusMsg.classList.remove('hidden');
      statusMsg.textContent = `${colMsgs.length} conflito${colMsgs.length > 1 ? 's' : ''}`;
    } else {
      statusSep.classList.add('hidden');
      statusMsg.classList.add('hidden');
      statusMsg.textContent = '';
    }

    // Selected Item Inspector (only visible when an item is selected)
    const sel = getSelectedItem();
    const inspSection = document.getElementById('inspector-section');
    if (!sel) {
      inspSection.classList.add('hidden');
    } else {
      inspSection.classList.remove('hidden');
      const box = getAABB(sel);
      document.getElementById('sel-title').textContent = sel.name;
      document.getElementById('sel-dims').textContent = `${Math.round(sel.w)}×${Math.round(sel.h)}×${Math.round(sel.zHeight || 75)} cm`;
      document.getElementById('inp-w').value = Math.round(sel.w);
      document.getElementById('inp-h').value = Math.round(sel.h);
      document.getElementById('inp-z').value = Math.round(sel.zHeight || 75);
      document.getElementById('inp-x').value = Number(box.minX.toFixed(1));
      document.getElementById('inp-y').value = Number(box.minY.toFixed(1));
      document.getElementById('sel-rot').textContent = `${Math.round(sel.rot)}°`;
      document.getElementById('chk-lock-dims').checked = Boolean(sel.lockedDims);
      document.getElementById('chk-ignore-col').checked = Boolean(sel.ignoreCollision);

      const clr = computeClearances(sel);
      document.getElementById('clr-n').textContent = `${Math.round(clr.N.dist)}cm`;
      document.getElementById('clr-s').textContent = `${Math.round(clr.S.dist)}cm`;
      document.getElementById('clr-w').textContent = `${Math.round(clr.W.dist)}cm`;
      document.getElementById('clr-e').textContent = `${Math.round(clr.E.dist)}cm`;

      const divBox = document.getElementById('divider-box');
      if (sel.type === 'divider') {
        divBox.classList.remove('hidden');
        document.getElementById('divider-val').textContent = `${Math.round(sel.w)} cm`;
        const divSlider = document.getElementById('divider-range');
        divSlider.value = sel.w;
        syncSliderValue(divSlider);
        const curFolds = sanitizeFoldAngles(sel.foldAngles);
        document.querySelectorAll('#divider-fold-presets button[data-fold]').forEach(btn => {
          const preset = DIVIDER_FOLD_PRESETS[btn.dataset.fold];
          const match = preset && preset.every((v, idx) => Math.abs(v - curFolds[idx]) < 2);
          btn.classList.toggle('is-active', match);
          btn.setAttribute('aria-pressed', match ? 'true' : 'false');
        });
      } else {
        divBox.classList.add('hidden');
      }

      const photoBox = document.getElementById('sel-photo-box');
      if (sel.photoDataUrl) {
        photoBox.classList.remove('hidden');
        document.getElementById('sel-photo-img').src = sel.photoDataUrl;
      } else {
        photoBox.classList.add('hidden');
      }
    }

    // Furniture List
    document.getElementById('item-count').textContent = `${state.items.length} itens`;
    const itemList = document.getElementById('item-list');
    itemList.innerHTML = '';
    for (const item of state.items) {
      const isSel = item.id === state.selectedId;
      const isBad = collisions.has(item.id);
      const pal = getPaletteColor(item.color);

      const row = document.createElement('div');
      row.className = `item-row${isSel ? ' is-selected' : ''}${isBad ? ' is-bad' : ''}${!item.visible ? ' is-hidden' : ''}`;

      const selBtn = document.createElement('button');
      selBtn.type = 'button';
      selBtn.className = 'item-select-btn';
      const typeIcon = ARCHETYPE_ICONS[item.type] || ARCHETYPE_ICONS.box;
      selBtn.innerHTML = `
        <span class="item-icon-badge" style="--item-accent:${pal.stroke}">
          ${typeIcon}
          <span class="item-dot" style="background:${pal.stroke}"></span>
        </span>
        <span class="item-meta">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-sub tabular">${Math.round(item.w)}×${Math.round(item.h)}×${Math.round(item.zHeight || 75)} cm${item.ignoreCollision ? ' · Livre' : ''}</span>
        </span>
      `;
      selBtn.addEventListener('click', () => {
        state.selectedId = item.id;
        syncUI();
      });

      const acts = document.createElement('div');
      acts.className = 'row-actions';

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'icon-act';
      eyeBtn.title = item.visible ? 'Esconder' : 'Mostrar';
      eyeBtn.setAttribute('aria-label', `${item.visible ? 'Esconder' : 'Mostrar'} ${item.name}`);
      eyeBtn.innerHTML = item.visible ? ICON_EYE : ICON_EYE_OFF;
      eyeBtn.addEventListener('click', () => toggleVisibility(item.id));

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'icon-act';
      editBtn.title = 'Editar';
      editBtn.setAttribute('aria-label', `Editar ${item.name}`);
      editBtn.innerHTML = ICON_EDIT;
      editBtn.addEventListener('click', () => openItemDialog(item.id));

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'icon-act';
      dupBtn.title = 'Duplicar';
      dupBtn.setAttribute('aria-label', `Duplicar ${item.name}`);
      dupBtn.innerHTML = ICON_DUP;
      dupBtn.addEventListener('click', () => duplicateItem(item.id));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-act';
      delBtn.title = 'Apagar';
      delBtn.setAttribute('aria-label', `Apagar ${item.name}`);
      delBtn.innerHTML = ICON_TRASH;
      delBtn.addEventListener('click', () => deleteItem(item.id));

      acts.append(eyeBtn, editBtn, dupBtn, delBtn);
      row.append(selBtn, acts);
      itemList.appendChild(row);
    }

    renderCablesList();
    renderRoomControls();
    updateHistoryButtons();
    draw();
    positionHUD();
  }

  function renderCablesList() {
    const list = document.getElementById('cable-list');
    list.innerHTML = '';
    if (state.cables.length === 0) {
      list.innerHTML = '<p class="helper-copy">Sem cabos configurados.</p>';
      return;
    }

    for (const c of state.cables) {
      const stats = computeCableStats(c);
      const card = document.createElement('div');
      card.className = 'cable-card';

      const pct = stats ? Math.min(100, (stats.meters / stats.maxM) * 100) : 0;
      const color = !stats ? '#71717a' : stats.status === 'ok' ? '#10b981' : stats.status === 'warn' ? '#f59e0b' : '#fb7185';
      const statusText = !stats ? 'Desligado' : stats.status === 'ok' ? 'OK' : stats.status === 'warn' ? 'Tenso' : 'Excede limite';

      card.innerHTML = `
        <div class="cable-card-top">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="tabular" style="color:${color};font-weight:700">${stats ? stats.meters.toFixed(2) + ' m' : '--'} / ${Number(c.maxMeters).toFixed(1)} m · ${statusText}</span>
        </div>
        <div class="cable-route">${stats ? `${escapeHtml(stats.a.name)} ↔ ${escapeHtml(stats.b.name)}` : 'Objeto escondido ou removido'}</div>
        <div class="cable-meter-bar"><div class="cable-meter-fill" style="width:${pct}%;background:${color}"></div></div>
      `;

      const foot = document.createElement('div');
      foot.className = 'row-actions';
      foot.style.justifyContent = 'space-between';

      const modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.className = 'icon-act';
      modeBtn.setAttribute('aria-label', `Alternar caminho do cabo ${c.name}`);
      modeBtn.title = c.routingMode === 'wall' ? 'Caminho: Rodapé (clica para Direto)' : 'Caminho: Direto (clica para Rodapé)';
      modeBtn.innerHTML = c.routingMode === 'wall' ? ICON_ROUTE_WALL : ICON_ROUTE_DIRECT;
      modeBtn.addEventListener('click', () => {
        pushUndoSnapshot();
        c.routingMode = c.routingMode === 'wall' ? 'direct' : 'wall';
        saveState();
        syncUI();
      });

      const rightActs = document.createElement('div');
      rightActs.className = 'row-actions';

      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = 'icon-act';
      visBtn.title = c.visible ? 'Esconder' : 'Mostrar';
      visBtn.setAttribute('aria-label', `${c.visible ? 'Esconder' : 'Mostrar'} ${c.name}`);
      visBtn.innerHTML = c.visible ? ICON_EYE : ICON_EYE_OFF;
      visBtn.addEventListener('click', () => {
        pushUndoSnapshot();
        c.visible = !c.visible;
        saveState();
        syncUI();
      });

      const edBtn = document.createElement('button');
      edBtn.type = 'button';
      edBtn.className = 'icon-act';
      edBtn.title = 'Editar';
      edBtn.setAttribute('aria-label', `Editar ${c.name}`);
      edBtn.innerHTML = ICON_EDIT;
      edBtn.addEventListener('click', () => openCableDialog(c.id));

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'icon-act';
      rmBtn.title = 'Apagar';
      rmBtn.setAttribute('aria-label', `Apagar ${c.name}`);
      rmBtn.innerHTML = ICON_TRASH;
      rmBtn.addEventListener('click', () => {
        pushUndoSnapshot();
        state.cables = state.cables.filter(x => x.id !== c.id);
        saveState();
        syncUI();
      });

      rightActs.append(visBtn, edBtn, rmBtn);
      foot.append(modeBtn, rightActs);
      card.appendChild(foot);
      list.appendChild(card);
    }
  }

  function renderRoomControls() {
    document.getElementById('room-w').value = state.room.w;
    document.getElementById('room-h').value = state.room.h;

    const wallOpts = (cur) => [
      ['top', 'Cima'], ['bottom', 'Baixo'], ['left', 'Esq'], ['right', 'Dir']
    ].map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${l}</option>`).join('');

    // Doors
    const dList = document.getElementById('doors-list');
    dList.innerHTML = '';
    for (const d of state.room.doors) {
      const box = document.createElement('div');
      box.className = 'struct-row';
      box.innerHTML = `
        <div>
          <strong>${escapeHtml(d.name || 'Porta')} (${d.width}cm)</strong>
          <div class="struct-controls">
            <label class="struct-field">
              <span class="struct-field-lbl">Parede</span>
              <select data-field="wall">${wallOpts(d.wall)}</select>
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Posição (cm)</span>
              <input type="number" data-field="offset" value="${d.offset}" title="Posição cm" />
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Largura (cm)</span>
              <input type="number" data-field="width" value="${d.width}" min="40" max="200" title="Largura cm" />
            </label>
          </div>
        </div>
        <button type="button" class="icon-act" aria-label="Remover porta" title="Remover porta">${ICON_TRASH}</button>
      `;
      box.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', () => {
          pushUndoSnapshot();
          const f = el.dataset.field;
          d[f] = f === 'wall' ? el.value : Math.max(0, Number(el.value) || 0);
          saveState();
          syncUI();
        });
      });
      box.querySelector('button').addEventListener('click', () => {
        pushUndoSnapshot();
        state.room.doors = state.room.doors.filter(x => x.id !== d.id);
        saveState();
        syncUI();
      });
      dList.appendChild(box);
    }

    // Windows
    const wList = document.getElementById('windows-list');
    wList.innerHTML = '';
    for (const w of state.room.windows) {
      const box = document.createElement('div');
      box.className = 'struct-row';
      box.innerHTML = `
        <div>
          <strong>${escapeHtml(w.name || 'Janela')} (${w.width}cm)</strong>
          <div class="struct-controls">
            <label class="struct-field">
              <span class="struct-field-lbl">Parede</span>
              <select data-field="wall">${wallOpts(w.wall)}</select>
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Início (cm)</span>
              <input type="number" data-field="offset" value="${w.offset}" title="Início cm" />
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Largura (cm)</span>
              <input type="number" data-field="width" value="${w.width}" min="20" max="400" title="Largura cm" />
            </label>
          </div>
        </div>
        <button type="button" class="icon-act" aria-label="Remover janela" title="Remover janela">${ICON_TRASH}</button>
      `;
      box.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', () => {
          pushUndoSnapshot();
          const f = el.dataset.field;
          w[f] = f === 'wall' ? el.value : Math.max(0, Number(el.value) || 0);
          saveState();
          syncUI();
        });
      });
      box.querySelector('button').addEventListener('click', () => {
        pushUndoSnapshot();
        state.room.windows = state.room.windows.filter(x => x.id !== w.id);
        saveState();
        syncUI();
      });
      wList.appendChild(box);
    }

    // Outlets
    const oList = document.getElementById('outlets-list');
    oList.innerHTML = '';
    for (const o of state.room.outlets) {
      const box = document.createElement('div');
      box.className = 'struct-row';
      box.innerHTML = `
        <div>
          <strong>Tomada ${escapeHtml(o.name || o.id)}</strong>
          <div class="struct-controls">
            <label class="struct-field">
              <span class="struct-field-lbl">Parede</span>
              <select data-field="wall">${wallOpts(o.wall)}</select>
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Posição (cm)</span>
              <input type="number" data-field="pos" value="${o.pos}" title="Posição cm" />
            </label>
            <label class="struct-field">
              <span class="struct-field-lbl">Etiqueta</span>
              <input type="text" data-field="name" value="${escapeHtml(o.name || o.id)}" maxlength="12" title="Nome" />
            </label>
          </div>
        </div>
        <button type="button" class="icon-act" aria-label="Remover tomada" title="Remover tomada">${ICON_TRASH}</button>
      `;
      box.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', () => {
          pushUndoSnapshot();
          const f = el.dataset.field;
          o[f] = f === 'pos' ? Math.max(0, Number(el.value) || 0) : el.value;
          saveState();
          syncUI();
        });
      });
      box.querySelector('button').addEventListener('click', () => {
        pushUndoSnapshot();
        state.room.outlets = state.room.outlets.filter(x => x.id !== o.id);
        state.cables = state.cables.filter(c => c.fromId !== o.id && c.toId !== o.id);
        saveState();
        syncUI();
      });
      oList.appendChild(box);
    }
  }

  // =========================================================================
  // 14. EVENT BINDINGS, FALLBACKS & BOOTSTRAP
  // =========================================================================
  function installProgressiveFallbacks() {
    // 1. Animated top-layer Escape & light-dismiss handling for <dialog>
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeTopLayer(dialog);
      });
    }

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) closeTopLayer(dialog); });
      }
    }

    // 2. Roving tabindex fallback for toolbar focusgroup
    const bar = document.getElementById('main-toolbar');
    if (bar && !('focusGroup' in HTMLElement.prototype)) {
      const items = [...bar.querySelectorAll('button, select')];
      items.forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
      bar.addEventListener('focusin', ({ target }) => {
        if (items.includes(target)) items.forEach((b) => (b.tabIndex = b === target ? 0 : -1));
      });
      bar.addEventListener('keydown', (e) => {
        const idx = items.indexOf(document.activeElement);
        if (idx === -1) return;
        let next = null;
        if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        if (next !== null) {
          e.preventDefault();
          items[next].focus();
        }
      });
    }
  }

  function bindAllEvents() {
    window.addEventListener('resize', onResize);
    bindCanvasPointers();

    // Populate modal archetype dropdown
    const typeSel = document.getElementById('dlg-item-type');
    typeSel.innerHTML = window.ARCHETYPES.map(a => `<option value="${a.type}">${escapeHtml(a.label)}</option>`).join('');
    typeSel.addEventListener('change', () => {
      if (!state.editingItemId) {
        const arch = window.ARCHETYPES.find(a => a.type === typeSel.value);
        if (arch) {
          document.getElementById('dlg-item-w').value = arch.defaultW;
          document.getElementById('dlg-item-h').value = arch.defaultH;
          document.getElementById('dlg-item-z').value = arch.defaultZ;
          document.getElementById('dlg-item-ignore-col').checked = arch.ignoreCollision;
          renderColorSwatches(arch.color);
        }
      }
    });

    // Toolbar & View Switcher
    const v2d = document.getElementById('btn-view-2d');
    const vCab = document.getElementById('btn-view-cables');
    const v3d = document.getElementById('btn-view-3d');
    if (v2d) v2d.addEventListener('click', () => setViewMode('2d'));
    if (vCab) vCab.addEventListener('click', () => setViewMode('cables'));
    if (v3d) v3d.addEventListener('click', () => setViewMode('3d'));

    const topAddBtn = document.getElementById('btn-top-add-item');
    if (topAddBtn) topAddBtn.addEventListener('click', () => openItemDialog(null));

    document.getElementById('layout-select').addEventListener('change', (e) => switchLayout(e.target.value));
    document.getElementById('btn-save-layout').addEventListener('click', () => {
      document.getElementById('dlg-layout-name').value = '';
      openDialogSafe('layout-dialog');
    });
    document.getElementById('btn-delete-layout').addEventListener('click', async () => {
      if (await openConfirmDialog('Apagar Layout', 'Tens a certeza que queres apagar este layout personalizado?')) {
        deleteActiveCustomLayout();
      }
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    document.getElementById('btn-grid').addEventListener('click', () => {
      state.gridStep = state.gridStep === 5 ? 1 : state.gridStep === 1 ? 0 : 5;
      saveState();
      syncUI();
    });
    document.getElementById('btn-snap').addEventListener('click', () => {
      state.wallSnap = !state.wallSnap;
      saveState();
      syncUI();
    });
    document.getElementById('btn-measure').addEventListener('click', () => {
      state.measureMode = !state.measureMode;
      state.measurePts = [];
      syncUI();
    });

    document.getElementById('btn-open-json').addEventListener('click', openJsonDialog);
    document.getElementById('btn-export-png').addEventListener('click', exportPNG);

    // Zoom
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoomBy(-0.15));
    document.getElementById('zoom-label').addEventListener('click', resetCamera);
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoomBy(0.15));

    // Floating Object HUD
    document.getElementById('hud-rot-ccw').addEventListener('click', () => rotateSelected(-90));
    document.getElementById('hud-rot-cw').addEventListener('click', () => rotateSelected(90));
    document.getElementById('hud-rot-45').addEventListener('click', () => rotateSelected(45));
    document.getElementById('hud-wall-snap').addEventListener('click', snapSelectedToNearestWall);
    document.getElementById('hud-center').addEventListener('click', (e) => centerSelectedItem(Boolean(e.shiftKey)));
    document.getElementById('hud-lock').addEventListener('click', toggleSelectedLock);
    document.getElementById('hud-edit').addEventListener('click', () => { if (state.selectedId) openItemDialog(state.selectedId); });
    document.getElementById('hud-dup').addEventListener('click', () => { if (state.selectedId) duplicateItem(state.selectedId); });
    document.getElementById('hud-hide').addEventListener('click', () => { if (state.selectedId) toggleVisibility(state.selectedId); });
    document.getElementById('hud-del').addEventListener('click', () => { if (state.selectedId) deleteItem(state.selectedId); });

    // Mobile Bottom Sheet
    const sidebar = document.getElementById('sidebar');
    const toggleSheet = (force) => {
      const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');
      sidebar.classList.toggle('is-open', open);
      document.getElementById('btn-mobile-sheet').setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    document.getElementById('btn-sheet-toggle').addEventListener('click', () => toggleSheet());
    document.getElementById('btn-mobile-sheet').addEventListener('click', () => toggleSheet());
    document.getElementById('btn-mobile-add').addEventListener('click', () => {
      switchTab('furniture');
      toggleSheet(true);
      document.getElementById('quick-add-input').focus();
    });

    // Tabs
    document.getElementById('tab-btn-furniture').addEventListener('click', () => switchTab('furniture'));
    document.getElementById('tab-btn-cables').addEventListener('click', () => switchTab('cables'));
    document.getElementById('tab-btn-room').addEventListener('click', () => switchTab('room'));

    // Quick Add (100% local & free)
    const quickInput = document.getElementById('quick-add-input');
    const quickPreview = document.getElementById('quick-add-preview');
    quickInput.addEventListener('input', () => {
      const res = window.parseQuickAddText(quickInput.value);
      if (res && res.hasParsedDims) {
        quickPreview.textContent = `${res.name} · ${res.w}×${res.h}×${res.zHeight} cm`;
        quickPreview.classList.remove('hidden');
      } else {
        quickPreview.classList.add('hidden');
      }
    });
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAdd();
      }
    });
    document.getElementById('btn-quick-add').addEventListener('click', handleQuickAdd);

    document.querySelectorAll('#quick-chips button[data-quick]').forEach(btn => {
      btn.addEventListener('click', () => {
        quickInput.value = btn.dataset.quick;
        handleQuickAdd();
      });
    });
    const quickCableBtn = document.querySelector('#quick-chips button[data-quick-action="cable"]');
    if (quickCableBtn) {
      quickCableBtn.addEventListener('click', () => openCableDialog(null));
    }

    document.getElementById('quick-add-photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImageToDataURL(file);
        state.quickPhotoDataUrl = dataUrl;
        document.getElementById('quick-photo-thumb').src = dataUrl;
        document.getElementById('quick-photo-chip').classList.remove('hidden');
        showToast('Foto anexada ao novo móvel');
      } catch (_) {
        showToast('Não foi possível ler a imagem.');
      }
    });
    document.getElementById('btn-clear-quick-photo').addEventListener('click', clearQuickPhoto);

    // Inspector inputs
    document.getElementById('btn-open-new-item').addEventListener('click', () => openItemDialog(null));
    document.getElementById('btn-edit-selected').addEventListener('click', () => {
      if (state.selectedId) openItemDialog(state.selectedId);
    });

    ['inp-w', 'inp-h', 'inp-z'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        mutateSelected(sel => {
          sel.w = Math.max(4, Math.min(600, Number(document.getElementById('inp-w').value) || sel.w));
          sel.h = Math.max(4, Math.min(600, Number(document.getElementById('inp-h').value) || sel.h));
          sel.zHeight = Math.max(1, Math.min(350, Number(document.getElementById('inp-z').value) || sel.zHeight));
        });
      });
    });

    ['inp-x', 'inp-y'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        mutateSelected(sel => {
          const box = getAABB(sel);
          const vx = parseFloat(document.getElementById('inp-x').value);
          const vy = parseFloat(document.getElementById('inp-y').value);
          if (!Number.isNaN(vx)) sel.x = Number((sel.x + (vx - box.minX)).toFixed(1));
          if (!Number.isNaN(vy)) sel.y = Number((sel.y + (vy - box.minY)).toFixed(1));
        });
      });
    });

    document.querySelectorAll('#rot-buttons button[data-rot]').forEach(btn => {
      btn.addEventListener('click', () => setSelectedRotation(Number(btn.dataset.rot)));
    });
    document.getElementById('btn-rot-step').addEventListener('click', () => rotateSelected(45));
    document.getElementById('chk-lock-dims').addEventListener('change', (e) => {
      mutateSelected(sel => { sel.lockedDims = e.target.checked; });
    });
    document.getElementById('chk-ignore-col').addEventListener('change', (e) => {
      mutateSelected(sel => { sel.ignoreCollision = e.target.checked; });
    });
    document.querySelectorAll('#divider-fold-presets button[data-fold]').forEach(btn => {
      btn.addEventListener('click', () => setDividerFoldPreset(btn.dataset.fold));
    });
    const dividerSlider = document.getElementById('divider-range');
    syncSliderValue(dividerSlider);
    dividerSlider.addEventListener('input', (e) => {
      syncSliderValue(e.target);
      const sel = getSelectedItem();
      if (sel && sel.type === 'divider') {
        sel.w = Number(e.target.value);
        syncUI();
      }
    });
    dividerSlider.addEventListener('change', () => saveState());
    document.getElementById('btn-remove-sel-photo').addEventListener('click', () => {
      mutateSelected(sel => { sel.photoDataUrl = null; }, 'Foto removida');
    });

    // Cables & Room controls
    document.getElementById('btn-new-cable').addEventListener('click', () => openCableDialog(null));
    ['room-w', 'room-h'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        pushUndoSnapshot();
        state.room.w = Math.max(100, Math.min(1500, Number(document.getElementById('room-w').value) || 360));
        state.room.h = Math.max(100, Math.min(1500, Number(document.getElementById('room-h').value) || 420));
        saveState();
        syncUI();
      });
    });

    document.getElementById('btn-add-door').addEventListener('click', () => {
      pushUndoSnapshot();
      state.room.doors.push({ id: uid('door'), name: 'Porta', wall: 'bottom', offset: 20, width: 90, hinge: 'left', swing: 'inward' });
      saveState();
      syncUI();
    });
    document.getElementById('btn-add-window').addEventListener('click', () => {
      pushUndoSnapshot();
      state.room.windows.push({ id: uid('win'), name: 'Janela', wall: 'top', offset: 20, width: 100 });
      saveState();
      syncUI();
    });
    document.getElementById('btn-add-outlet').addEventListener('click', () => {
      pushUndoSnapshot();
      const idx = state.room.outlets.length + 1;
      state.room.outlets.push({ id: uid('T'), name: `T${idx}`, wall: 'left', pos: 100 });
      saveState();
      syncUI();
    });

    const resetFactoryHandler = async () => {
      if (await openConfirmDialog('Repor Projeto Demo', 'Isto vai restaurar o Estúdio Demo padrão (360×420 cm), tomadas e os layouts iniciais. Continuar?')) {
        pushUndoSnapshot();
        closeDialogSafe('json-dialog');
        applyDefaultProject(false);
        showToast('Projeto demo restaurado!');
      }
    };
    document.getElementById('btn-reset-factory').addEventListener('click', resetFactoryHandler);
    document.getElementById('btn-modal-reset-factory').addEventListener('click', resetFactoryHandler);

    // Dialog close buttons
    document.querySelectorAll('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => closeDialogSafe(btn.dataset.closeDialog));
    });

    // Item Modal Submit
    document.getElementById('dlg-item-photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.pendingModalPhoto = await compressImageToDataURL(file);
      } catch (_) {}
    });

    document.getElementById('item-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('dlg-item-name').value.trim() || 'Móvel';
      const w = Math.max(4, Math.min(600, Number(document.getElementById('dlg-item-w').value) || 60));
      const h = Math.max(4, Math.min(600, Number(document.getElementById('dlg-item-h').value) || 45));
      const zHeight = Math.max(1, Math.min(350, Number(document.getElementById('dlg-item-z').value) || 75));
      const type = document.getElementById('dlg-item-type').value;
      const ignoreCollision = document.getElementById('dlg-item-ignore-col').checked;
      const lockedDims = document.getElementById('dlg-item-locked').checked;
      const activeSwatch = document.querySelector('#dlg-color-swatches .swatch-btn[aria-checked="true"]');
      const color = activeSwatch ? activeSwatch.dataset.color : 'zinc';

      pushUndoSnapshot();
      if (state.editingItemId) {
        const target = state.items.find(i => i.id === state.editingItemId);
        if (target) {
          target.name = name;
          target.w = w;
          target.h = h;
          target.zHeight = zHeight;
          target.type = type;
          target.foldAngles = type === 'divider' ? sanitizeFoldAngles(target.foldAngles) : undefined;
          target.color = color;
          target.ignoreCollision = ignoreCollision;
          target.lockedDims = lockedDims;
          if (state.pendingModalPhoto) target.photoDataUrl = state.pendingModalPhoto;
        }
      } else {
        const created = {
          id: uid('item'),
          name, type, w, h, zHeight,
          x: Math.round(state.room.w / 2),
          y: Math.round(state.room.h / 2),
          rot: 0,
          foldAngles: type === 'divider' ? [0, 0, 0] : undefined,
          color, ignoreCollision, lockedDims,
          visible: true,
          photoDataUrl: state.pendingModalPhoto || null
        };
        state.items.push(created);
        state.selectedId = created.id;
      }
      saveState();
      syncUI();
      closeDialogSafe('item-dialog');
      showToast(`Guardado: ${name}`);
    });

    // Cable Modal Submit
    document.getElementById('cable-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('dlg-cable-name').value.trim() || 'Cabo';
      const fromId = document.getElementById('dlg-cable-from').value;
      const toId = document.getElementById('dlg-cable-to').value;
      const maxMeters = Math.max(0.5, Math.min(30, Number(document.getElementById('dlg-cable-max').value) || 3.0));
      const routingMode = document.getElementById('dlg-cable-mode').value;

      pushUndoSnapshot();
      if (state.editingCableId) {
        const c = state.cables.find(x => x.id === state.editingCableId);
        if (c) {
          c.name = name; c.fromId = fromId; c.toId = toId;
          c.maxMeters = maxMeters; c.warnMeters = Number((maxMeters * 0.85).toFixed(2));
          c.routingMode = routingMode;
        }
      } else {
        state.cables.push({
          id: uid('cable'), name, fromId, toId, maxMeters,
          warnMeters: Number((maxMeters * 0.85).toFixed(2)),
          routingMode, visible: true
        });
      }
      saveState();
      syncUI();
      closeDialogSafe('cable-dialog');
      showToast(`Cabo guardado: ${name}`);
    });

    // Layout Modal Submit
    document.getElementById('layout-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('dlg-layout-name').value.trim();
      if (!name) return;
      saveCurrentAsLayout(name);
      closeDialogSafe('layout-dialog');
    });

    // JSON Modal Controls
    document.getElementById('btn-download-json').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(snapshotProjectData(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (state.room.name || 'planta').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      a.download = `simplecad-${slug}-${state.room.w}x${state.room.h}.json`;
      a.click();
      URL.revokeObjectURL(url);
      document.getElementById('json-feedback').textContent = 'Ficheiro .json descarregado!';
    });

    document.getElementById('inp-upload-json').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => applyImportedJson(reader.result);
      reader.readAsText(file);
    });

    document.getElementById('btn-copy-json').addEventListener('click', async () => {
      const txt = document.getElementById('json-textarea').value;
      const fb = document.getElementById('json-feedback');
      try {
        await navigator.clipboard.writeText(txt);
        fb.textContent = 'JSON copiado para a área de transferência.';
      } catch (_) {
        fb.textContent = 'Não foi possível copiar automaticamente — seleciona e copia manualmente.';
      }
    });

    document.getElementById('btn-apply-json').addEventListener('click', () => {
      applyImportedJson(document.getElementById('json-textarea').value);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (state.selectedId) duplicateItem(state.selectedId);
        return;
      }

      if (e.key === 'Escape') {
        if (state.measureMode) {
          state.measureMode = false;
          state.measurePts = [];
          syncUI();
        } else if (state.selectedId !== null) {
          state.selectedId = null;
          syncUI();
        }
        return;
      }
      if (e.key === '1') { setViewMode('2d'); return; }
      if (e.key === '2') { setViewMode('cables'); return; }
      if (e.key === '3') { setViewMode('3d'); return; }
      if (e.key === 'n' || e.key === 'N') { openItemDialog(null); return; }
      if (e.key === 'm' || e.key === 'M') {
        state.measureMode = !state.measureMode; state.measurePts = []; syncUI(); return;
      }
      if (e.key === 'r' || e.key === 'R') { rotateSelected(e.shiftKey ? 45 : 90); return; }
      if (e.key === 'w' || e.key === 'W') { snapSelectedToNearestWall(); return; }
      if (e.key === 'c' || e.key === 'C') { centerSelectedItem(Boolean(e.shiftKey)); return; }
      if (e.key === 'l' || e.key === 'L') { toggleSelectedLock(); return; }
      if (e.key === 'h' || e.key === 'H') { if (state.selectedId) toggleVisibility(state.selectedId); return; }
      if (e.key === 'e' || e.key === 'E') { if (state.selectedId) openItemDialog(state.selectedId); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedId) { e.preventDefault(); deleteItem(state.selectedId); }
        return;
      }

      const sel = getSelectedItem();
      if (!sel) return;
      const step = e.shiftKey ? 5 : 1;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        pushUndoSnapshot();
        if (e.key === 'ArrowLeft') sel.x -= step;
        if (e.key === 'ArrowRight') sel.x += step;
        if (e.key === 'ArrowUp') sel.y -= step;
        if (e.key === 'ArrowDown') sel.y += step;
        roundItemCornerToCm(sel);
        saveState();
        syncUI();
      }
    });
  }

  function init() {
    installProgressiveFallbacks();
    if (!loadSavedState()) {
      applyDefaultProject(false);
    }
    bindAllEvents();
    onResize();
    syncUI();
  }

  window.addEventListener('load', init);
})();
