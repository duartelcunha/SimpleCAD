/**
 * SimpleCAD Synthetic Algorithm Benchmark Suite
 * Separate implementations with a mock canvas; app.js is not executed.
 * No pixels are rasterized and no browser or native frame rates are measured.
 * Evaluates:
 * - Scenario B1: Mock 2D drawing calls & vector path generation
 * - Scenario B2: Continuous pointer interaction & SAT collision throughput (Unindexed O(N^2) vs Spatial Hash O(k))
 * - Scenario B3: 3D axonometric projection, procedural face generation, and Painter's depth sorting
 * - Scenario B4: Separate JSON serialization/deserialization simulation
 * Standalone execution: node benchmarks/cad-benchmark.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// =============================================================================
// 1. MOCK CANVAS 2D CONTEXT (NO RASTERIZATION)
// =============================================================================

class MockCanvasContext2D {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1.0;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.currentPath = [];
    this.pathOps = 0;
    this.fillOps = 0;
    this.strokeOps = 0;
    this.stateStack = [];
  }

  save() {
    this.stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline
    });
  }

  restore() {
    if (this.stateStack.length > 0) {
      const s = this.stateStack.pop();
      this.fillStyle = s.fillStyle;
      this.strokeStyle = s.strokeStyle;
      this.lineWidth = s.lineWidth;
      this.font = s.font;
      this.textAlign = s.textAlign;
      this.textBaseline = s.textBaseline;
    }
  }

  fillRect(x, y, w, h) {
    this.fillOps++;
    this.pathOps += 4;
  }

  strokeRect(x, y, w, h) {
    this.strokeOps++;
    this.pathOps += 4;
  }

  beginPath() {
    this.currentPath = [];
    this.pathOps++;
  }

  closePath() {
    this.pathOps++;
  }

  moveTo(x, y) {
    this.currentPath.push({ op: 'M', x, y });
    this.pathOps++;
  }

  lineTo(x, y) {
    this.currentPath.push({ op: 'L', x, y });
    this.pathOps++;
  }

  rect(x, y, w, h) {
    this.currentPath.push({ op: 'R', x, y, w, h });
    this.pathOps += 4;
  }

  roundRect(x, y, w, h, r = 0) {
    this.currentPath.push({ op: 'RR', x, y, w, h, r });
    this.pathOps += 8;
  }

  arc(x, y, r, a0, a1, ccw = false) {
    this.currentPath.push({ op: 'A', x, y, r, a0, a1, ccw });
    this.pathOps += 16;
  }

  fill(rule) {
    this.fillOps++;
    let dummy = 0;
    for (let i = 0; i < this.currentPath.length; i++) {
      dummy += (this.currentPath[i].x || 0) * (this.currentPath[i].y || 0);
    }
    return dummy;
  }

  stroke() {
    this.strokeOps++;
    let dummy = 0;
    for (let i = 0; i < this.currentPath.length; i++) {
      dummy += (this.currentPath[i].x || 0) + (this.currentPath[i].y || 0);
    }
    return dummy;
  }

  fillText(text, x, y) {
    this.fillOps++;
    this.pathOps += String(text).length;
  }

  strokeText(text, x, y) {
    this.strokeOps++;
    this.pathOps += String(text).length;
  }

  resetOps() {
    this.pathOps = 0;
    this.fillOps = 0;
    this.strokeOps = 0;
    this.currentPath = [];
  }
}

// =============================================================================
// 2. GEOMETRY & SAT ENGINE IMPLEMENTATION
// =============================================================================

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function getDividerGeometry(item) {
  const segW = item.w / 4;
  const th = Math.max(3, item.h || 4);
  const folds = Array.isArray(item.foldAngles) && item.foldAngles.length === 3
    ? item.foldAngles
    : [16, -20, 16];

  const baseRad = degToRad(item.rot || 0);
  const angs = [
    baseRad,
    baseRad + degToRad(folds[0]),
    baseRad + degToRad(folds[0] + folds[1]),
    baseRad + degToRad(folds[0] + folds[1] + folds[2])
  ];

  let curX = 0, curY = 0;
  const localNodes = [{ x: 0, y: 0 }];
  for (let s = 0; s < 4; s++) {
    curX += Math.cos(angs[s]) * segW;
    curY += Math.sin(angs[s]) * segW;
    localNodes.push({ x: curX, y: curY });
  }

  const cxLocal = curX / 2;
  const cyLocal = curY / 2;
  const nodes = localNodes.map(n => ({
    x: item.x + (n.x - cxLocal),
    y: item.y + (n.y - cyLocal)
  }));

  const segments = [];
  for (let s = 0; s < 4; s++) {
    const a = nodes[s];
    const b = nodes[s + 1];
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const offX = (nx / len) * (th / 2);
    const offY = (ny / len) * (th / 2);
    const poly = [
      { x: a.x + offX, y: a.y + offY },
      { x: b.x + offX, y: b.y + offY },
      { x: b.x - offX, y: b.y - offY },
      { x: a.x - offX, y: a.y - offY }
    ];
    segments.push({ poly, a, b });
  }

  return { nodes, segments };
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

function getItemPolygons(item) {
  if (item && item.type === 'divider') {
    return getDividerGeometry(item).segments.map(s => s.poly);
  }
  return [getCorners(item)];
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

function polygonsOverlap(polyA, polyB) {
  const eps = 0.25; // 2.5mm tolerance
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

function hitsDoorSwing(itemPoly, door, room) {
  const W = room.w;
  const H = room.h;
  const r = Number(door.width) || 90;
  const off = Number(door.offset) || 0;
  const hinge = door.hinge === 'right' ? 'right' : 'left';
  const wall = door.wall || 'bottom';

  let hx, hy, aStart, aEnd;
  if (wall === 'bottom') {
    hy = H;
    hx = hinge === 'left' ? off : off + r;
    aStart = hinge === 'left' ? -Math.PI / 2 : Math.PI;
    aEnd   = hinge === 'left' ? 0 : -Math.PI / 2;
  } else if (wall === 'top') {
    hy = 0;
    hx = hinge === 'left' ? off : off + r;
    aStart = hinge === 'left' ? 0 : Math.PI / 2;
    aEnd   = hinge === 'left' ? Math.PI / 2 : Math.PI;
  } else if (wall === 'left') {
    hx = 0;
    hy = hinge === 'left' ? off : off + r;
    aStart = hinge === 'left' ? -Math.PI / 2 : 0;
    aEnd   = hinge === 'left' ? 0 : Math.PI / 2;
  } else {
    hx = W;
    hy = hinge === 'left' ? off : off + r;
    aStart = hinge === 'left' ? Math.PI : Math.PI / 2;
    aEnd   = hinge === 'left' ? Math.PI * 1.5 : Math.PI;
  }

  const steps = 6;
  const sectorPoly = [{ x: hx, y: hy }];
  let a0 = aStart, a1 = aEnd;
  if (a1 < a0) a1 += Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    sectorPoly.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r });
  }
  return polygonsOverlap(itemPoly, sectorPoly);
}

// Naive O(N^2) Pairwise Collision Pass
function computeCollisionsNaive(items, room) {
  const bad = new Set();
  const vis = items.filter(i => i.visible);

  for (let i = 0; i < vis.length; i++) {
    const a = vis[i];
    const polysA = getItemPolygons(a);
    const boxA = getAABB(a);

    if (boxA.minX < -0.4 || boxA.maxX > room.w + 0.4 || boxA.minY < -0.4 || boxA.maxY > room.h + 0.4) {
      bad.add(a.id);
    }

    if (a.ignoreCollision) continue;

    for (const door of room.doors || []) {
      if (polysA.some(polyA => hitsDoorSwing(polyA, door, room))) {
        bad.add(a.id);
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
      }
    }
  }
  return bad;
}

// =============================================================================
// 3. BROADPHASE SPATIAL HASH GRID IMPLEMENTATION
// =============================================================================

class SpatialHashGrid {
  constructor(cellSize = 150) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.cells = new Map();
    this.itemBounds = new Map();
  }

  getKey(cx, cy) {
    return `${cx}:${cy}`;
  }

  insert(item, minX, minY, maxX, maxY) {
    const bounds = { minX, minY, maxX, maxY };
    this.itemBounds.set(item.id, bounds);

    const cMinX = Math.floor(minX * this.invCellSize);
    const cMaxX = Math.floor(maxX * this.invCellSize);
    const cMinY = Math.floor(minY * this.invCellSize);
    const cMaxY = Math.floor(maxY * this.invCellSize);

    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cy = cMinY; cy <= cMaxY; cy++) {
        const key = this.getKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = new Set();
          this.cells.set(key, bucket);
        }
        bucket.add(item);
      }
    }
  }

  remove(itemId) {
    const bounds = this.itemBounds.get(itemId);
    if (!bounds) return;

    const cMinX = Math.floor(bounds.minX * this.invCellSize);
    const cMaxX = Math.floor(bounds.maxX * this.invCellSize);
    const cMinY = Math.floor(bounds.minY * this.invCellSize);
    const cMaxY = Math.floor(bounds.maxY * this.invCellSize);

    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cy = cMinY; cy <= cMaxY; cy++) {
        const key = this.getKey(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket) {
          for (const item of bucket) {
            if (item.id === itemId) {
              bucket.delete(item);
              break;
            }
          }
          if (bucket.size === 0) {
            this.cells.delete(key);
          }
        }
      }
    }
    this.itemBounds.delete(itemId);
  }

  update(item, minX, minY, maxX, maxY) {
    this.remove(item.id);
    this.insert(item, minX, minY, maxX, maxY);
  }

  getCandidates(item) {
    const candidates = new Set();
    const bounds = this.itemBounds.get(item.id);
    if (!bounds) return candidates;

    const cMinX = Math.floor(bounds.minX * this.invCellSize);
    const cMaxX = Math.floor(bounds.maxX * this.invCellSize);
    const cMinY = Math.floor(bounds.minY * this.invCellSize);
    const cMaxY = Math.floor(bounds.maxY * this.invCellSize);

    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cy = cMinY; cy <= cMaxY; cy++) {
        const bucket = this.cells.get(this.getKey(cx, cy));
        if (bucket) {
          for (const other of bucket) {
            if (other.id !== item.id) {
              candidates.add(other);
            }
          }
        }
      }
    }
    return candidates;
  }
}

// Spatial-Indexed Collision Query for Single Moving Item
function computeItemCollisionsSpatial(draggedItem, grid, room) {
  const hits = [];
  const boxA = getAABB(draggedItem);

  if (boxA.minX < -0.4 || boxA.maxX > room.w + 0.4 || boxA.minY < -0.4 || boxA.maxY > room.h + 0.4) {
    hits.push('boundary');
  }

  if (draggedItem.ignoreCollision) return hits;

  const polysA = getItemPolygons(draggedItem);
  for (const door of room.doors || []) {
    if (polysA.some(polyA => hitsDoorSwing(polyA, door, room))) {
      hits.push(door.id);
      break;
    }
  }

  const neighbors = grid.getCandidates(draggedItem);
  for (const b of neighbors) {
    if (b.ignoreCollision) continue;
    const boxB = grid.itemBounds.get(b.id);
    // Fast AABB check first
    if (boxB && (boxA.maxX < boxB.minX || boxA.minX > boxB.maxX || boxA.maxY < boxB.minY || boxA.minY > boxB.maxY)) {
      continue;
    }

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
    if (hit) hits.push(b.id);
  }
  return hits;
}

// =============================================================================
// 4. 2D SCENE RASTERIZATION ENGINE (SIMULATION OF SimpleCAD 2D RENDERER)
// =============================================================================

function render2DScene(ctx, project, viewport = { width: 1920, height: 1080, scale: 2.2, ox: 150, oy: 100 }) {
  const { width, height, scale: s, ox, oy } = viewport;
  const room = project.room;
  const rw = room.w * s;
  const rh = room.h * s;
  const wt = (room.wallThickness || 14) * s;

  // 1. Clear background
  ctx.fillStyle = '#0a0b0d';
  ctx.fillRect(0, 0, width, height);

  // 2. Wall Cavity Poché
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox - wt, oy - wt, rw + 2 * wt, rh + 2 * wt);
  ctx.rect(ox, oy, rw, rh);
  ctx.fillStyle = '#181a22';
  ctx.fill();
  // 45 deg hatching
  ctx.strokeStyle = '#262933';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const hatchStep = 18;
  for (let x = -wt; x < rw + wt; x += hatchStep) {
    ctx.moveTo(ox + x, oy - wt);
    ctx.lineTo(ox + x + wt, oy);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Room Floor Surface Finish
  ctx.fillStyle = '#121316';
  ctx.fillRect(ox, oy, rw, rh);

  // Modular floor grid (10cm minor, 50cm major)
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= room.w; x += 50) {
    const px = Math.round(ox + x * s) + 0.5;
    ctx.strokeStyle = '#262933';
    ctx.beginPath();
    ctx.moveTo(px, oy);
    ctx.lineTo(px, oy + rh);
    ctx.stroke();
  }
  for (let y = 0; y <= room.h; y += 50) {
    const py = Math.round(oy + y * s) + 0.5;
    ctx.strokeStyle = '#262933';
    ctx.beginPath();
    ctx.moveTo(ox, py);
    ctx.lineTo(ox + rw, py);
    ctx.stroke();
  }

  // 4. Doors & Swings
  for (const door of room.doors || []) {
    ctx.strokeStyle = '#c8a96e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const dOff = (Number(door.offset) || 0) * s;
    const dW = (Number(door.width) || 90) * s;
    ctx.moveTo(ox + dOff, oy + rh);
    ctx.lineTo(ox + dOff + dW, oy + rh);
    ctx.stroke();
    // Swing arc
    ctx.beginPath();
    ctx.arc(ox + dOff, oy + rh, dW, -Math.PI / 2, 0);
    ctx.stroke();
  }

  // 5. Windows
  for (const win of room.windows || []) {
    ctx.strokeStyle = '#5a8cb2';
    ctx.lineWidth = 2.0;
    const wOff = (Number(win.offset) || 0) * s;
    const wW = (Number(win.width) || 120) * s;
    ctx.strokeRect(ox + wOff, oy - wt, wW, wt);
  }

  // 6. Outlets
  for (const out of room.outlets || []) {
    ctx.fillStyle = '#c8a96e';
    ctx.fillRect(ox + out.x * s - 4, oy + out.y * s - 4, 8, 8);
    ctx.font = '9px monospace';
    ctx.fillText(out.name, ox + out.x * s + 6, oy + out.y * s + 3);
  }

  // 7. Cables
  ctx.lineWidth = 1.5;
  for (const c of project.cables || []) {
    ctx.strokeStyle = c.color || '#4ecdc4';
    ctx.beginPath();
    ctx.moveTo(ox + 100 * s, oy + 100 * s);
    ctx.lineTo(ox + 200 * s, oy + 200 * s);
    ctx.stroke();
  }

  // 8. Furniture Items (Drop shadows, contours, archetypes, labels)
  const items = project.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.visible) continue;

    const ix = ox + item.x * s;
    const iy = oy + item.y * s;
    const iw = item.w * s;
    const ih = item.h * s;

    // Contact drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(ix - iw / 2 + 3, iy - ih / 2 + 3, iw, ih);

    // Body
    ctx.fillStyle = item.ignoreCollision ? 'rgba(158, 140, 122, 0.2)' : '#1e2028';
    ctx.fillRect(ix - iw / 2, iy - ih / 2, iw, ih);

    // Silhouettes & Line Weight Tier 3
    ctx.strokeStyle = '#d99b26';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(ix - iw / 2, iy - ih / 2, iw, ih);

    // Archetype Details
    if (item.type === 'bed') {
      ctx.fillStyle = '#2a2d38';
      ctx.fillRect(ix - iw / 2 + 2, iy - ih / 2 + 2, iw - 4, ih * 0.25);
    } else if (item.type === 'desk') {
      ctx.fillStyle = '#242732';
      ctx.fillRect(ix - iw * 0.2, iy - ih * 0.2, iw * 0.4, ih * 0.4);
    } else if (item.type === 'chair') {
      ctx.beginPath();
      ctx.arc(ix, iy, iw * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label
    if (iw > 30) {
      ctx.fillStyle = '#EAE7DF';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.name || item.id, ix, iy);
    }
  }
}

// =============================================================================
// 5. 3D AXONOMETRIC ENGINE (SIMULATION OF SimpleCAD 3D ENGINE)
// =============================================================================

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

function render3DOrbitFrame(ctx, project, yawDeg = 45, pitchDeg = 35) {
  const t = {
    yawRad: degToRad(yawDeg),
    pitchRad: degToRad(pitchDeg),
    cx: project.room.w / 2,
    cy: project.room.h / 2,
    scale: 1.2,
    sxMid: ctx.width / 2,
    syMid: ctx.height / 2
  };

  ctx.fillStyle = '#0a0b0d';
  ctx.fillRect(0, 0, ctx.width, ctx.height);

  const W = project.room.w;
  const H = project.room.h;
  const p3 = (x, y, z) => project3D(x, y, z, t);

  // 1. Floor Base
  const fl = [p3(0, 0, 0), p3(W, 0, 0), p3(W, H, 0), p3(0, H, 0)];
  ctx.beginPath();
  ctx.moveTo(fl[0].x, fl[0].y);
  for (let i = 1; i < fl.length; i++) ctx.lineTo(fl[i].x, fl[i].y);
  ctx.closePath();
  ctx.fillStyle = '#121316';
  ctx.fill();
  ctx.strokeStyle = '#262933';
  ctx.stroke();

  // Floor grid
  for (let x = 100; x < W; x += 100) {
    const a = p3(x, 0, 0);
    const b = p3(x, H, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // 2. Gather 3D Faces for Painter's Depth Sort
  const faces = [];
  const pushQuad = (pts3, fill, stroke, bias = 0) => {
    const proj = pts3.map(v => p3(v.x, v.y, v.z));
    const depth = proj.reduce((acc, q) => acc + q.depth, 0) / proj.length + bias;
    faces.push({ pts: proj, fill, stroke, depth });
  };

  // Perimeter Walls (4 walls)
  const WALL_Z = 240;
  const camX = Math.sin(t.yawRad);
  const camY = Math.cos(t.yawRad);
  const wallSpecs = [
    { a: { x: 0, y: 0 }, b: { x: W, y: 0 }, isBack: camY > 0 },
    { a: { x: 0, y: H }, b: { x: W, y: H }, isBack: camY <= 0 },
    { a: { x: 0, y: 0 }, b: { x: 0, y: H }, isBack: camX > 0 },
    { a: { x: W, y: 0 }, b: { x: W, y: H }, isBack: camX <= 0 }
  ];
  for (const w of wallSpecs) {
    const h = w.isBack ? WALL_Z : 20;
    pushQuad([
      { x: w.a.x, y: w.a.y, z: 0 },
      { x: w.b.x, y: w.b.y, z: 0 },
      { x: w.b.x, y: w.b.y, z: h },
      { x: w.a.x, y: w.a.y, z: h }
    ], w.isBack ? '#1a1c24' : '#2a2c36', '#3a3d4a', w.isBack ? -3000 : 1000);
  }

  // Furniture 3D Prisms (6 faces per bounding box)
  const items = project.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.visible) continue;
    const hw = item.w / 2;
    const hh = item.h / 2;
    const zH = item.zHeight || 75;
    const rad = degToRad(item.rot || 0);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners2D = [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh }
    ].map(p => ({
      x: item.x + p.x * cos - p.y * sin,
      y: item.y + p.x * sin + p.y * cos
    }));

    const bot = corners2D.map(p => ({ x: p.x, y: p.y, z: 0 }));
    const top = corners2D.map(p => ({ x: p.x, y: p.y, z: zH }));

    // 4 vertical side quads
    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      pushQuad([bot[c], bot[next], top[next], top[c]], '#252834', '#383c4e', 0);
    }
    // 1 top quad
    pushQuad(top, '#33384a', '#d99b26', 1);
  }

  // 3. Painter's Sort & Rasterization
  faces.sort((a, b) => a.depth - b.depth);

  for (let f = 0; f < faces.length; f++) {
    const face = faces[f];
    const pts = face.pts;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.strokeStyle = face.stroke;
    ctx.stroke();
  }

  return faces.length;
}

// =============================================================================
// 6. STATISTICAL AGGREGATION & REPORTING
// =============================================================================

function computeStats(samples) {
  if (!samples.length) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, stddev: 0, fps: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  // Legacy field name retained for existing result consumers: synthetic iterations/s,
  // capped at 2000, not a measured display frame rate.
  const fps = avg > 0 ? Math.min(1000 / avg, 2000) : 2000;
  return {
    avg: Number(avg.toFixed(3)),
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    p50: Number(p50.toFixed(3)),
    p95: Number(p95.toFixed(3)),
    p99: Number(p99.toFixed(3)),
    stddev: Number(stddev.toFixed(3)),
    fps: Number(fps.toFixed(1))
  };
}

// =============================================================================
// 7. BENCHMARK SUITE RUNNER ACROSS ALL THREE PROJECT SCALES
// =============================================================================

function runBenchmarkSuite() {
  console.log('==============================================================================');
  console.log('   SIMPLECAD SYNTHETIC ALGORITHM BENCHMARK');
  console.log('   Mock canvas and separate algorithms; app.js is not executed.');
  console.log('   Results do not measure browser FPS, native performance, or app SLAs.');
  console.log('==============================================================================\n');

  const projDir = path.resolve(__dirname, '..', 'projects');
  const smallPath = path.join(projDir, 'project-small-studio.json');
  const mediumPath = path.join(projDir, 'project-medium-apartment.json');
  const largePath = path.join(projDir, 'project-large-floorplate.json');

  if (!fs.existsSync(smallPath) || !fs.existsSync(mediumPath) || !fs.existsSync(largePath)) {
    console.error('Test project files not found. Run "node benchmarks/generate-projects.js" first.');
    process.exit(1);
  }

  const smallProject = JSON.parse(fs.readFileSync(smallPath, 'utf8'));
  const mediumProject = JSON.parse(fs.readFileSync(mediumPath, 'utf8'));
  const largeProject = JSON.parse(fs.readFileSync(largePath, 'utf8'));

  console.log(`Loaded Payloads:`);
  console.log(`- Small Studio:      ${smallProject.room.w}×${smallProject.room.h}cm, ${smallProject.items.length} items, ${smallProject.cables.length} cables`);
  console.log(`- Medium Apartment:  ${mediumProject.room.w}×${mediumProject.room.h}cm, ${mediumProject.items.length} items, ${mediumProject.cables.length} cables`);
  console.log(`- Large Floorplate:  ${largeProject.room.w}×${largeProject.room.h}cm, ${largeProject.items.length} items, ${largeProject.cables.length} cables\n`);

  const results = {
    suite: 'SimpleCAD Performance Benchmark',
    version: '3.0.0',
    scope: {
      kind: 'synthetic-algorithm-benchmark',
      appCodeExecuted: false,
      realRasterization: false,
      fpsFieldMeaning: 'Legacy field: synthetic iterations per second capped at 2000; not browser FPS',
      complianceMeaning: 'Synthetic workload budgets only; slaPassed is retained for schema compatibility'
    },
    timestamp: new Date().toISOString(),
    hardware: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    scenarios: {}
  };

  const ctx2D = new MockCanvasContext2D(1920, 1080);
  const ctx3D = new MockCanvasContext2D(1920, 1080);

  // Helper for benchmarking a project scale across B1-B4
  function benchmarkProject(scaleKey, project) {
    console.log(`>>> Benchmarking ${scaleKey.toUpperCase()} (${project.room.w}×${project.room.h} cm, ${project.items.length} items)...`);

    // --- B1: 2D Render (100 iterations) ---
    const b1Samples = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      render2DScene(ctx2D, project);
      const t1 = performance.now();
      b1Samples.push(t1 - t0);
    }
    const b1Stats = computeStats(b1Samples);

    // --- B2: SAT Collision (500 steps) ---
    const grid = new SpatialHashGrid(150);
    for (const it of project.items) {
      const b = getAABB(it);
      grid.insert(it, b.minX, b.minY, b.maxX, b.maxY);
    }

    const draggedItem = { ...project.items[0] };
    const b2SpatialSamples = [];
    for (let s = 0; s < 500; s++) {
      draggedItem.x = 50 + (s % (project.room.w - 100));
      draggedItem.y = 50 + (s % (project.room.h - 100));
      const b = getAABB(draggedItem);
      const t0 = performance.now();
      grid.update(draggedItem, b.minX, b.minY, b.maxX, b.maxY);
      computeItemCollisionsSpatial(draggedItem, grid, project.room);
      const t1 = performance.now();
      b2SpatialSamples.push(t1 - t0);
    }
    const b2SpatialStats = computeStats(b2SpatialSamples);

    // Naive O(N^2) comparison pass
    const naiveSteps = project.items.length > 200 ? 50 : 200;
    const b2NaiveSamples = [];
    for (let s = 0; s < naiveSteps; s++) {
      draggedItem.x = 50 + (s % (project.room.w - 100));
      draggedItem.y = 50 + (s % (project.room.h - 100));
      const t0 = performance.now();
      computeCollisionsNaive(project.items, project.room);
      const t1 = performance.now();
      b2NaiveSamples.push(t1 - t0);
    }
    const b2NaiveStats = computeStats(b2NaiveSamples);
    const speedup = Number((b2NaiveStats.avg / Math.max(0.001, b2SpatialStats.avg)).toFixed(1));

    // --- B3: 3D Orbit (360 frames) ---
    const b3Samples = [];
    let facesCount = 0;
    for (let deg = 0; deg < 360; deg++) {
      const pitch = 30 + 10 * Math.sin(degToRad(deg * 2));
      const t0 = performance.now();
      facesCount = render3DOrbitFrame(ctx3D, project, deg, pitch);
      const t1 = performance.now();
      b3Samples.push(t1 - t0);
    }
    const b3Stats = computeStats(b3Samples);

    // --- B4: Serialization (50 iterations) ---
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    const serSamples = [];
    const deserSamples = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const snap = {
        version: 2,
        app: 'SimpleCAD',
        room: JSON.parse(JSON.stringify(project.room)),
        cables: JSON.parse(JSON.stringify(project.cables)),
        items: JSON.parse(JSON.stringify(project.items)),
        layouts: JSON.parse(JSON.stringify(project.layouts || [])),
        activeLayoutId: project.activeLayoutId
      };
      const str = JSON.stringify(snap);
      const t1 = performance.now();
      const parsed = JSON.parse(str);
      const _st = {
        room: parsed.room,
        cables: parsed.cables,
        items: parsed.items
      };
      const t2 = performance.now();
      serSamples.push(t1 - t0);
      deserSamples.push(t2 - t1);
    }
    const memAfter = process.memoryUsage().heapUsed;
    const heapDeltaMb = Number(((memAfter - memBefore) / (1024 * 1024)).toFixed(2));
    const serStats = computeStats(serSamples);
    const deserStats = computeStats(deserSamples);

    console.log(`    B1 (Mock 2D Calls): Avg: ${b1Stats.avg}ms | P95: ${b1Stats.p95}ms | Synthetic iterations/s: ${b1Stats.fps}`);
    console.log(`    B2 (SAT Collision): Spatial: ${b2SpatialStats.avg}ms | Naive: ${b2NaiveStats.avg}ms | Speedup: ${speedup}x`);
    console.log(`    B3 (Mock 3D Calls): Avg: ${b3Stats.avg}ms | P95: ${b3Stats.p95}ms | Faces Sorted: ${facesCount} | Synthetic iterations/s: ${b3Stats.fps}`);
    console.log(`    B4 (JSON Simulation): Serialize: ${serStats.avg}ms | Parse: ${deserStats.avg}ms | Heap Delta: ${heapDeltaMb}MB\n`);

    return {
      b1_2d_render: b1Stats,
      b2_collision: {
        spatial_hash: b2SpatialStats,
        naive_O_N2: b2NaiveStats,
        speedup_factor: `${speedup}x`
      },
      b3_3d_orbit: {
        ...b3Stats,
        faces_sorted: facesCount
      },
      b4_serialization: {
        export_ms: serStats,
        import_ms: deserStats,
        heap_delta_mb: heapDeltaMb
      }
    };
  }

  results.scenarios.small_studio = benchmarkProject('small_studio', smallProject);
  results.scenarios.medium_apartment = benchmarkProject('medium_apartment', mediumProject);
  results.scenarios.large_floorplate = benchmarkProject('large_floorplate', largeProject);

  // ===========================================================================
  // 8. SYNTHETIC BUDGET EVALUATION (targets from docs/PERFORMANCE_STRATEGY.md §4.1)
  // ===========================================================================

  const sm = results.scenarios.small_studio;
  const med = results.scenarios.medium_apartment;
  const lg = results.scenarios.large_floorplate;

  const slaBudgets = [
    // Small Studio
    { scale: 'Small', metric: 'Mock 2D Iteration (Avg)', target: '<= 2.5 ms', actual: `${sm.b1_2d_render.avg} ms`, pass: sm.b1_2d_render.avg <= 2.5 },
    { scale: 'Small', metric: 'Mock 2D Iterations/s', target: '>= 120/s', actual: `${sm.b1_2d_render.fps}/s`, pass: sm.b1_2d_render.fps >= 120 },
    { scale: 'Small', metric: '3D Orbit Time (Avg)', target: '<= 5.0 ms', actual: `${sm.b3_3d_orbit.avg} ms`, pass: sm.b3_3d_orbit.avg <= 5.0 },
    { scale: 'Small', metric: 'SAT Collision (Spatial)', target: '<= 0.05 ms', actual: `${sm.b2_collision.spatial_hash.avg} ms`, pass: sm.b2_collision.spatial_hash.avg <= 0.05 },
    { scale: 'Small', metric: 'JSON Serialization', target: '<= 1.5 ms', actual: `${sm.b4_serialization.export_ms.avg} ms`, pass: sm.b4_serialization.export_ms.avg <= 1.5 },
    { scale: 'Small', metric: 'JSON Deserialization', target: '<= 3.0 ms', actual: `${sm.b4_serialization.import_ms.avg} ms`, pass: sm.b4_serialization.import_ms.avg <= 3.0 },

    // Medium Apartment
    { scale: 'Medium', metric: 'Mock 2D Iteration (Avg)', target: '<= 6.0 ms', actual: `${med.b1_2d_render.avg} ms`, pass: med.b1_2d_render.avg <= 6.0 },
    { scale: 'Medium', metric: 'Mock 2D Iterations/s', target: '>= 60/s', actual: `${med.b1_2d_render.fps}/s`, pass: med.b1_2d_render.fps >= 60 },
    { scale: 'Medium', metric: '3D Orbit Time (Avg)', target: '<= 10.0 ms', actual: `${med.b3_3d_orbit.avg} ms`, pass: med.b3_3d_orbit.avg <= 10.0 },
    { scale: 'Medium', metric: 'SAT Collision (Spatial)', target: '<= 0.4 ms', actual: `${med.b2_collision.spatial_hash.avg} ms`, pass: med.b2_collision.spatial_hash.avg <= 0.4 },
    { scale: 'Medium', metric: 'JSON Serialization', target: '<= 5.0 ms', actual: `${med.b4_serialization.export_ms.avg} ms`, pass: med.b4_serialization.export_ms.avg <= 5.0 },
    { scale: 'Medium', metric: 'JSON Deserialization', target: '<= 10.0 ms', actual: `${med.b4_serialization.import_ms.avg} ms`, pass: med.b4_serialization.import_ms.avg <= 10.0 },

    // Large Commercial Floorplate
    { scale: 'Large', metric: 'Mock 2D Iteration (Avg)', target: '<= 12.0 ms', actual: `${lg.b1_2d_render.avg} ms`, pass: lg.b1_2d_render.avg <= 12.0 },
    { scale: 'Large', metric: 'Mock 2D Iterations/s', target: '>= 60/s', actual: `${lg.b1_2d_render.fps}/s`, pass: lg.b1_2d_render.fps >= 60 },
    { scale: 'Large', metric: '3D Orbit Time (Avg)', target: '<= 16.0 ms', actual: `${lg.b3_3d_orbit.avg} ms`, pass: lg.b3_3d_orbit.avg <= 16.0 },
    { scale: 'Large', metric: 'SAT Collision (Spatial)', target: '<= 1.2 ms', actual: `${lg.b2_collision.spatial_hash.avg} ms`, pass: lg.b2_collision.spatial_hash.avg <= 1.2 },
    { scale: 'Large', metric: 'JSON Serialization', target: '<= 25.0 ms', actual: `${lg.b4_serialization.export_ms.avg} ms`, pass: lg.b4_serialization.export_ms.avg <= 25.0 },
    { scale: 'Large', metric: 'JSON Deserialization', target: '<= 45.0 ms', actual: `${lg.b4_serialization.import_ms.avg} ms`, pass: lg.b4_serialization.import_ms.avg <= 45.0 }
  ];

  console.log('==============================================================================');
  console.log('                 SYNTHETIC WORKLOAD BUDGET EVALUATION TABLE                   ');
  console.log('==============================================================================');
  console.log(
    'Scale'.padEnd(10) +
    'Performance Metric'.padEnd(28) +
    'Synthetic Target'.padEnd(16) +
    'Measured Actual'.padEnd(18) +
    'Status'
  );
  console.log('-'.repeat(80));

  let allPassed = true;
  for (const row of slaBudgets) {
    if (!row.pass) allPassed = false;
    const badge = row.pass ? '[ PASS ]' : '[ FAIL ]';
    console.log(
      row.scale.padEnd(10) +
      row.metric.padEnd(28) +
      row.target.padEnd(16) +
      row.actual.padEnd(18) +
      badge
    );
  }
  console.log('==============================================================================');

  results.compliance = {
    scope: 'synthetic workload only; not app SLA compliance',
    slaPassed: allPassed,
    budgetChecks: slaBudgets
  };

  // Write machine-readable JSON output
  const outJsonPath = path.resolve(__dirname, 'benchmark-results.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✓ Structured JSON telemetry written to: ${outJsonPath}`);

  if (allPassed) {
    console.log('All 18 synthetic workload budgets passed. This does not establish app performance.\n');
  } else {
    console.warn('Some synthetic workload budgets failed. Review detailed telemetry.\n');
  }

  process.exit(allPassed ? 0 : 1);
}

runBenchmarkSuite();
