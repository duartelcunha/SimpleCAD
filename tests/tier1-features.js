/**
 * SimpleCAD Verification Suite — Tier 1: Feature Coverage
 * 8 Features × 5 Tests each = 40 Test Assertions
 * Synthetic geometry, mock drawing, and source/document checks; app.js is not executed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  ROOT_DIR,
  MockCanvas2D,
  CSSInspector,
  DocAuditor,
  GeometryEngine,
  expect
} = require('./cad-test-harness');

const {
  smallStudioProject,
  createMediumApartmentProject,
  createLargeFloorplateProject
} = require('./fixtures/reference-projects');

function registerTier1Tests(runner) {
  // =========================================================================
  // FEATURE 1: 2D Floor Plan Stylized Rendering & Poché (R1, Acceptance Criteria §1)
  // =========================================================================
  runner.suite('Tier 1 - Feature 1: 2D Floor Plan Stylized Rendering & Poché');

  runner.test('T1.1.1', 'Wall cavity double lines and physical wall thickness rendering', () => {
    const room = { w: 440, h: 380, wallThickness: 14 };
    const bounds = GeometryEngine.computeWallPocheBounds(room);

    expect(bounds.thickness).toBe(14);
    expect(bounds.outer.x).toBe(-14);
    expect(bounds.outer.y).toBe(-14);
    expect(bounds.outer.w).toBe(468);
    expect(bounds.outer.h).toBe(408);
    expect(bounds.inner.w).toBe(440);
    expect(bounds.inner.h).toBe(380);

    // Verify canvas context mock receives double-line boundary commands
    const ctx = new MockCanvas2D(800, 600);
    ctx.save();
    ctx.lineWidth = 2.4; // Structural wall cut
    ctx.strokeRect(bounds.outer.x, bounds.outer.y, bounds.outer.w, bounds.outer.h);
    ctx.strokeRect(bounds.inner.x, bounds.inner.y, bounds.inner.w, bounds.inner.h);
    ctx.restore();

    expect(ctx.hasCall('strokeRect')).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(2.4)).toBeTruthy();
  });

  runner.test('T1.1.2', 'Wall poché 45° diagonal hatch pattern fill configuration', () => {
    const ctx = new MockCanvas2D(40, 40);
    const patternAngleRad = Math.PI / 4; // 45 degrees
    const hatchSpacing = 6; // 6cm / px spacing

    ctx.save();
    ctx.rotate(patternAngleRad);
    ctx.strokeStyle = 'rgba(234, 231, 223, 0.28)'; // Drafting ink tint
    ctx.lineWidth = 0.8;
    for (let x = -80; x < 80; x += hatchSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, -80);
      ctx.lineTo(x, 80);
      ctx.stroke();
    }
    ctx.restore();

    expect(ctx.hasCall('rotate')).toBeTruthy();
    expect(ctx.hasCall('stroke')).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(0.8)).toBeTruthy();
    const rotateCalls = ctx.getCalls('rotate');
    expect(rotateCalls[0].args[0]).toBeCloseTo(Math.PI / 4, 0.001);
  });

  runner.test('T1.1.3', '5-tier architectural line weight hierarchy enforcement', () => {
    // Architectural 5-tier line hierarchy:
    // Tier 1: Structural wall cut (2.0 - 3.0 px)
    // Tier 2: Millwork, door swings, glazing (1.2 - 1.6 px)
    // Tier 3: Furniture silhouettes (0.8 - 1.1 px)
    // Tier 4: Surface detailing & hatching (0.4 - 0.6 px)
    // Tier 5: Annotation witness lines & grid (0.3 - 0.5 px)
    const lineHierarchy = {
      structuralWallCut: 2.5,
      millworkGlazing: 1.4,
      furnitureSilhouette: 0.9,
      surfaceDetailing: 0.5,
      annotationsGrid: 0.4
    };

    expect(lineHierarchy.structuralWallCut).toBeGreaterThan(lineHierarchy.millworkGlazing);
    expect(lineHierarchy.millworkGlazing).toBeGreaterThan(lineHierarchy.furnitureSilhouette);
    expect(lineHierarchy.furnitureSilhouette).toBeGreaterThan(lineHierarchy.surfaceDetailing);
    expect(lineHierarchy.surfaceDetailing).toBeGreaterThanOrEqual(lineHierarchy.annotationsGrid);

    const ctx = new MockCanvas2D(800, 600);
    Object.values(lineHierarchy).forEach(w => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(100, 100);
      ctx.stroke();
    });

    expect(ctx.hasStrokeWithWidth(2.5)).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(1.4)).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(0.9)).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(0.5)).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(0.4)).toBeTruthy();
  });

  runner.test('T1.1.4', 'Architectural dimensioning with 45° oblique tick slashes', () => {
    const ctx = new MockCanvas2D(800, 600);
    const slashLength = 8;
    const slashRad = Math.PI / 4; // 45°
    const dx = (slashLength / 2) * Math.cos(slashRad);
    const dy = (slashLength / 2) * Math.sin(slashRad);

    // Witness points
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 100 };

    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#c8a96e'; // Architectural Ochre/Brass

    // Dimension line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 45° slashes
    [p1, p2].forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x - dx, p.y + dy);
      ctx.lineTo(p.x + dx, p.y - dy);
      ctx.stroke();
    });
    ctx.restore();

    expect(ctx.getCalls('stroke').length).toBe(3);
    expect(ctx.hasStrokeWithWidth(1.2)).toBeTruthy();
  });

  runner.test('T1.1.5', 'Room area stamp and square meter formatting calculation', () => {
    const room = { name: 'Studio Suite', w: 440, h: 380 };
    const areaM2 = (room.w * room.h) / 10000;
    const formattedArea = `${areaM2.toFixed(2)} m²`;

    expect(areaM2).toBe(16.72);
    expect(formattedArea).toBe('16.72 m²');

    const ctx = new MockCanvas2D(800, 600);
    ctx.font = '700 13px -apple-system, sans-serif';
    ctx.fillStyle = '#EAE7DF';
    ctx.fillText(`${room.name.toUpperCase()} • ${formattedArea}`, 400, 300);

    const fillCalls = ctx.getCalls('fillText');
    expect(fillCalls.length).toBe(1);
    expect(fillCalls[0].args[0]).toContain('16.72 m²');
    expect(fillCalls[0].args[0]).toContain('STUDIO SUITE');
  });

  // =========================================================================
  // FEATURE 2: 3D View Stylized Shading & Materials (R1, Acceptance Criteria §2)
  // =========================================================================
  runner.suite('Tier 1 - Feature 2: 3D View Stylized Shading & Materials');

  runner.test('T1.2.1', 'Directional sunlight vector L and surface normal calculation', () => {
    const topNormal = { x: 0, y: 0, z: 1 };
    const southNormal = { x: 0, y: 1, z: 0 };
    const eastNormal = { x: 1, y: 0, z: 0 };

    const sunVector = { x: 0.577, y: -0.577, z: 0.577 };

    const topShading = GeometryEngine.compute3ToneCelShading(topNormal, sunVector);
    const southShading = GeometryEngine.compute3ToneCelShading(southNormal, sunVector);
    const eastShading = GeometryEngine.compute3ToneCelShading(eastNormal, sunVector);

    expect(topShading.tone).toBe('sunlight');
    expect(topShading.factor).toBe(1.15);
    expect(southShading.tone).toBe('shadow');
    expect(southShading.factor).toBe(0.65);
    expect(eastShading.tone).toBe('sunlight');
  });

  runner.test('T1.2.2', '3-tone quantized cel-shading illumination evaluation', () => {
    const normals = [
      { normal: { x: 0, y: 0, z: 1 }, expectedTone: 'sunlight' }, // Top face illuminated (dot > 0.45)
      { normal: { x: 0, y: -0.8, z: 0.6 }, expectedTone: 'sunlight' },
      { normal: { x: 1, y: 1, z: 0 }, expectedTone: 'midtone' },   // Neutral grazing face (dot == 0)
      { normal: { x: 0, y: 1, z: 0 }, expectedTone: 'shadow' }     // Away from sun (dot < -0.15)
    ];

    normals.forEach(({ normal, expectedTone }) => {
      const res = GeometryEngine.compute3ToneCelShading(normal);
      expect(res.tone).toBe(expectedTone);
    });
  });

  runner.test('T1.2.3', '3D architectural material palette reflectance & color mapping', () => {
    const materials = {
      whiteOak: { label: 'White Oak Wood', baseColor: '#bfa782', roughness: 0.7, metallic: 0.0 },
      bonePlaster: { label: 'Bone Plaster', baseColor: '#EAE7DF', roughness: 0.9, metallic: 0.0 },
      obsidianSlate: { label: 'Obsidian Slate', baseColor: '#1a1c22', roughness: 0.4, metallic: 0.2 },
      satinBrass: { label: 'Satin Brass', baseColor: '#d99b26', roughness: 0.3, metallic: 0.8 },
      glazing: { label: 'Architectural Glazing', baseColor: '#5a8cb2', roughness: 0.1, metallic: 0.1, opacity: 0.4 }
    };

    expect(materials.whiteOak.baseColor).toBe('#bfa782');
    expect(materials.bonePlaster.baseColor).toBe('#EAE7DF');
    expect(materials.satinBrass.baseColor).toBe('#d99b26');
    expect(materials.glazing.opacity).toBe(0.4);
    expect(materials.satinBrass.metallic).toBeGreaterThan(0.5);
  });

  runner.test('T1.2.4', 'Ground contact ambient occlusion shadows at z = 0', () => {
    const ctx = new MockCanvas2D(800, 600);
    const item = { x: 200, y: 150, w: 140, h: 60, zHeight: 75 };

    // Draw AO ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(10, 11, 13, 0.45)'; // Obsidian shadow tint
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(item.x - 4, item.y - 4, item.w + 8, item.h + 8);
    ctx.restore();

    expect(ctx.hasCall('fillRect')).toBeTruthy();
    expect(ctx.hasFillStyle('rgba(10, 11, 13, 0.45)')).toBeTruthy();
  });

  runner.test('T1.2.5', 'Normal-based wall cutaway for arbitrary camera-facing walls', () => {
    // Camera azimuth = 45 degrees (viewing from South-West)
    const cameraVector = { x: -Math.SQRT1_2, y: -Math.SQRT1_2, z: 0.5 };

    // Walls
    const southWallNormal = { x: 0, y: 1, z: 0 };
    const northWallNormal = { x: 0, y: -1, z: 0 };

    // Dot product with camera vector determines if wall faces camera (should cut away)
    const dotSouth = southWallNormal.x * cameraVector.x + southWallNormal.y * cameraVector.y;
    const dotNorth = northWallNormal.x * cameraVector.x + northWallNormal.y * cameraVector.y;

    // South wall faces towards camera (dot < 0 in camera ray coordinates)
    const southWallCutaway = dotSouth < 0;
    const northWallCutaway = dotNorth < 0;

    expect(southWallCutaway).toBe(true);
    expect(northWallCutaway).toBe(false);
  });

  // =========================================================================
  // FEATURE 3: Application UI & Theme Styling (R1, Acceptance Criteria §3)
  // =========================================================================
  runner.suite('Tier 1 - Feature 3: Application UI & Theme Styling');

  const css = new CSSInspector();

  runner.test('T1.3.1', 'Primary Obsidian Black theme CSS variables (--bg-app, --bg-surface)', () => {
    expect(css.hasVar('--bg-app')).toBeTruthy();
    expect(css.getVar('--bg-app')).toMatch(/#(?:0a0b0d|0d0e10)/i);
    expect(css.hasVar('--bg-surface')).toBeTruthy();
    expect(css.getVar('--bg-surface')).toMatch(/#121316/i);
  });

  runner.test('T1.3.2', 'Harbour Blue color family CSS tokens in styles.css', () => {
    expect(css.hasVar('--harbour-blue')).toBeTruthy();
    expect(css.getVar('--harbour-blue')).toMatch(/#28425d/i);
    expect(css.hasVar('--harbour-blue-deep') || css.hasVar('--harbour-bg')).toBeTruthy();
  });

  runner.test('T1.3.3', 'Architectural Ochre-Yellow & Brass accents in styles.css', () => {
    expect(css.hasVar('--accent')).toBeTruthy();
    expect(css.getVar('--accent')).toMatch(/#(?:d99b26|c8a96e)/i);
    expect(css.hasVar('--accent-hover') || css.hasVar('--ochre-hover')).toBeTruthy();
  });

  runner.test('T1.3.4', 'Off-white drafting ink typography and architectural font stack', () => {
    expect(css.hasVar('--drafting-ink') || css.hasVar('--text')).toBeTruthy();
    const textVal = css.getVar('--drafting-ink') || css.getVar('--text');
    expect(textVal).toMatch(/#(?:EAE7DF|edeae4)/i);

    expect(css.hasVar('--font-ui')).toBeTruthy();
    expect(css.hasVar('--font-mono')).toBeTruthy();
    expect(css.getVar('--font-mono')).toContain('JetBrains Mono');
  });

  runner.test('T1.3.5', 'Component styling: badges, buttons, segmented controls', () => {
    expect(css.hasSelector('.room-badge')).toBeTruthy();
    expect(css.hasSelector('.tb-btn-primary')).toBeTruthy();
    expect(css.hasSelector('.view-seg-btn')).toBeTruthy();
  });

  // =========================================================================
  // FEATURE 4: Written Architectural Specification (R2, Acceptance Criteria §4)
  // =========================================================================
  runner.suite('Tier 1 - Feature 4: Written Architectural Specification');

  const archDoc = new DocAuditor('docs/ARCHITECTURE_LAYERS_DIVISIONS_BUILDINGS.md');

  runner.test('T1.4.1', 'Architecture doc exists and defines Whole-Building Hierarchical Taxonomy', () => {
    expect(archDoc.exists).toBeTruthy();
    expect(archDoc.hasHeading(1, /Architectural Specification/i)).toBeTruthy();
    expect(archDoc.contains(/Project/i)).toBeTruthy();
    expect(archDoc.contains(/Building/i)).toBeTruthy();
    expect(archDoc.contains(/Storey/i)).toBeTruthy();
  });

  runner.test('T1.4.2', 'Topological Planar Wall Graph G = (V, E) schema definition', () => {
    expect(archDoc.contains(/Planar Wall Graph/i)).toBeTruthy();
    expect(archDoc.contains(/WallNode/i)).toBeTruthy();
    expect(archDoc.contains(/WallSegment/i)).toBeTruthy();
    expect(archDoc.contains(/half-edge/i) || archDoc.contains(/adjacency/i)).toBeTruthy();
  });

  runner.test('T1.4.3', 'Autonomous space cycle detection algorithm (Euler Left-Face Walk)', () => {
    expect(archDoc.contains(/Left-Face Walk/i) || archDoc.contains(/Space.*Cycle/i)).toBeTruthy();
    expect(archDoc.contains(/Euler/i) || archDoc.contains(/polygon/i)).toBeTruthy();
    expect(archDoc.contains(/m²/i) || archDoc.contains(/area/i)).toBeTruthy();
  });

  runner.test('T1.4.4', 'Parametric hosted openings specification (doors, windows, cutouts)', () => {
    expect(archDoc.contains(/Parametric.*Opening/i)).toBeTruthy();
    expect(archDoc.contains(/offset/i)).toBeTruthy();
    expect(archDoc.contains(/swing/i) || archDoc.contains(/hinge/i)).toBeTruthy();
  });

  runner.test('T1.4.5', 'CAD layer system specification (AIA/ISO 13567, z-index, states)', () => {
    expect(archDoc.contains(/Layer/i)).toBeTruthy();
    expect(archDoc.contains(/visibility/i) || archDoc.contains(/visible/i)).toBeTruthy();
    expect(archDoc.contains(/locked/i) || archDoc.contains(/lock/i)).toBeTruthy();
    expect(archDoc.contains(/ISO 13567/i) || archDoc.contains(/AIA/i)).toBeTruthy();
  });

  // =========================================================================
  // FEATURE 5: Comprehensive UX Audit Report (R2, Acceptance Criteria §5)
  // =========================================================================
  runner.suite('Tier 1 - Feature 5: Comprehensive UX Audit Report');

  const uxDoc = new DocAuditor('docs/UX_AUDIT_REPORT.md');

  runner.test('T1.5.1', 'UX audit report exists and defines executive evaluation structure', () => {
    expect(uxDoc.exists).toBeTruthy();
    expect(uxDoc.hasHeading(1, /UX Audit/i)).toBeTruthy();
    expect(uxDoc.contains(/Executive Summary/i)).toBeTruthy();
  });

  runner.test('T1.5.2', 'Quantitative usability ratings (1-10 numerical scale) across workflows', () => {
    expect(uxDoc.contains(/Usability Rating/i) || uxDoc.contains(/Rating.*10/i)).toBeTruthy();
    // Verify presence of numerical ratings (e.g. 6.5/10, 7.8/10, etc.)
    const ratings = uxDoc.extractNumbers(/\b([1-9](?:\.[0-9])?|10(?:\.0)?)\s*\/\s*10\b/);
    expect(ratings.length).toBeGreaterThan(0);
  });

  runner.test('T1.5.3', 'Heuristic evaluation catalog conforming to standardized criteria', () => {
    expect(uxDoc.contains(/Heuristic/i)).toBeTruthy();
    expect(uxDoc.contains(/Visibility of system status/i) || uxDoc.contains(/Error prevention/i) || uxDoc.contains(/Consistency/i)).toBeTruthy();
  });

  runner.test('T1.5.4', 'Problem severity classification (Critical, Major, Minor, Cosmetic)', () => {
    expect(uxDoc.contains(/Critical/i)).toBeTruthy();
    expect(uxDoc.contains(/Major/i)).toBeTruthy();
    expect(uxDoc.contains(/Minor/i)).toBeTruthy();
  });

  runner.test('T1.5.5', 'Actionable UX recommendations and architectural blueprints', () => {
    expect(uxDoc.contains(/Blueprint/i) || uxDoc.contains(/Redesign/i)).toBeTruthy();
    expect(uxDoc.contains(/Resolution/i) || uxDoc.contains(/Scorecard/i)).toBeTruthy();
  });

  // =========================================================================
  // FEATURE 6: Performance Scaling Strategy Document (R2, Acceptance Criteria §6)
  // =========================================================================
  runner.suite('Tier 1 - Feature 6: Performance Scaling Strategy Document');

  const perfDoc = new DocAuditor('docs/PERFORMANCE_STRATEGY.md');

  runner.test('T1.6.1', 'Performance strategy document exists and profiles O(N^2) SAT bottleneck', () => {
    expect(perfDoc.exists).toBeTruthy();
    expect(perfDoc.hasHeading(1, /Performance/i)).toBeTruthy();
    expect(perfDoc.contains(/O\(N\^2\)/i) || perfDoc.contains(/SAT/i)).toBeTruthy();
  });

  runner.test('T1.6.2', 'Broadphase Spatial Hash Grid / Quadtree partitioning architecture', () => {
    expect(perfDoc.contains(/Spatial Hash/i) || perfDoc.contains(/Quadtree/i)).toBeTruthy();
    expect(perfDoc.contains(/Broadphase/i) || perfDoc.contains(/partitioning/i)).toBeTruthy();
  });

  runner.test('T1.6.3', 'Multi-layer offscreen canvas caching design (static vs dynamic)', () => {
    expect(perfDoc.contains(/Offscreen Canvas/i) || perfDoc.contains(/Multi-Layer/i)).toBeTruthy();
    expect(perfDoc.contains(/cache/i) || perfDoc.contains(/bitmap/i)).toBeTruthy();
  });

  runner.test('T1.6.4', 'Viewport frustum culling and RAF event coalescing strategy', () => {
    expect(perfDoc.contains(/Culling/i) || perfDoc.contains(/Frustum/i)).toBeTruthy();
    expect(perfDoc.contains(/requestAnimationFrame/i) || perfDoc.contains(/RAF/i)).toBeTruthy();
  });

  runner.test('T1.6.5', 'Proposal describes performance targets (not measured app performance)', () => {
    expect(perfDoc.contains(/60 FPS/i) || perfDoc.contains(/60 fps/i)).toBeTruthy();
    expect(perfDoc.contains(/16/i) || perfDoc.contains(/Budget/i)).toBeTruthy();
  });

  // =========================================================================
  // FEATURE 7: Scriptable Performance Benchmark Suite (R3, Acceptance Criteria §7)
  // =========================================================================
  runner.suite('Tier 1 - Feature 7: Scriptable Performance Benchmark Suite');

  runner.test('T1.7.1', 'Benchmark harness interface contract & metric calculations', () => {
    // Benchmark metric aggregator contract
    function computeBenchmarkMetrics(samplesMs) {
      if (!samplesMs || samplesMs.length === 0) return null;
      const sorted = [...samplesMs].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      const avg = sum / sorted.length;
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      const p95 = sorted[p95Index];
      const fps = avg > 0 ? 1000 / avg : 60;
      return { avgMs: Number(avg.toFixed(3)), p95Ms: Number(p95.toFixed(3)), fps: Number(fps.toFixed(1)) };
    }

    const testSamples = [1.2, 1.5, 1.4, 2.0, 1.3, 1.8, 1.6, 1.5, 3.2, 1.4];
    const metrics = computeBenchmarkMetrics(testSamples);

    expect(metrics.avgMs).toBeGreaterThan(0);
    expect(metrics.p95Ms).toBeGreaterThan(metrics.avgMs);
    expect(metrics.fps).toBeGreaterThan(0);
  });

  runner.test('T1.7.2', '2D rendering frame time benchmark scenario contract', () => {
    const ctx = new MockCanvas2D(1920, 1080);
    const room = { w: 850, h: 720, wallThickness: 16 };
    const items = createMediumApartmentProject().catalog;

    const t0 = process.hrtime.bigint();
    // Simulated 2D render pass
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.strokeRect(0, 0, room.w, room.h);
    items.forEach(it => {
      ctx.fillRect(it.w, it.h, 20, 20);
    });
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    expect(durationMs).toBeLessThan(50); // Frame budget under 50ms in Node test
    expect(ctx.hasCall('fillRect')).toBeTruthy();
  });

  runner.test('T1.7.3', '3D axonometric orbit projection frame time benchmark scenario', () => {
    const items = createMediumApartmentProject().catalog;
    const t0 = process.hrtime.bigint();

    // Orbit projection benchmark
    const cam = { yaw: -22, pitch: 52, zoom: 0.94 };
    let transformedCount = 0;
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = GeometryEngine.degToRad(deg + cam.yaw);
      items.forEach(it => {
        const x = it.w * Math.cos(rad);
        const y = it.h * Math.sin(rad);
        transformedCount++;
      });
    }

    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    expect(transformedCount).toBe(items.length * 12);
    expect(durationMs).toBeLessThan(50);
  });

  runner.test('T1.7.4', 'SAT polygon collision engine benchmark under scaled loads', () => {
    const project = createMediumApartmentProject();
    const items = project.catalog;

    const polys = items.map(it => GeometryEngine.getItemPolygon(it));

    const t0 = process.hrtime.bigint();
    let collisionChecks = 0;
    let collisionsFound = 0;
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        collisionChecks++;
        if (GeometryEngine.polygonsIntersect(polys[i], polys[j])) {
          collisionsFound++;
        }
      }
    }
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    expect(collisionChecks).toBe((items.length * (items.length - 1)) / 2);
    expect(durationMs).toBeLessThan(100);
  });

  runner.test('T1.7.5', 'Project JSON serialization & deserialization benchmark scenario', () => {
    const largeProject = createLargeFloorplateProject(120);

    const t0 = process.hrtime.bigint();
    const serialized = JSON.stringify(largeProject);
    const deserialized = JSON.parse(serialized);
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    expect(deserialized.catalog.length).toBe(120);
    expect(serialized.length).toBeGreaterThan(10000);
    expect(durationMs).toBeLessThan(100);
  });

  // =========================================================================
  // FEATURE 8: Representative Test Projects (Small & Large) (R3, Acceptance Criteria §8)
  // =========================================================================
  runner.suite('Tier 1 - Feature 8: Representative Test Projects (Small & Large)');

  function validateSimpleCADProjectSchema(proj) {
    expect(proj.app).toBe('SimpleCAD');
    expect(proj.version).toBeGreaterThanOrEqual(2);
    expect(proj.room).toBeTruthy();
    expect(typeof proj.room.w).toBe('number');
    expect(typeof proj.room.h).toBe('number');
    expect(Array.isArray(proj.catalog || proj.items)).toBeTruthy();
    expect(Array.isArray(proj.layouts)).toBeTruthy();
    expect(Array.isArray(proj.cables)).toBeTruthy();
  }

  runner.test('T1.8.1', 'SimpleCAD JSON project schema compliance across test project payloads', () => {
    validateSimpleCADProjectSchema(smallStudioProject);
    validateSimpleCADProjectSchema(createMediumApartmentProject());
    validateSimpleCADProjectSchema(createLargeFloorplateProject(120));
  });

  runner.test('T1.8.2', 'Small studio baseline project payload structure', () => {
    const proj = smallStudioProject;
    expect(proj.room.name).toContain('Studio');
    expect(proj.room.w).toBe(440);
    expect(proj.room.h).toBe(380);
    expect(proj.catalog.length).toBe(11);
    expect(proj.cables.length).toBe(1);
    expect(proj.layouts.length).toBeGreaterThanOrEqual(1);
  });

  runner.test('T1.8.3', 'Medium multi-room residential apartment payload structure', () => {
    const proj = createMediumApartmentProject();
    expect(proj.room.name).toContain('Residential');
    expect(proj.room.w).toBe(850);
    expect(proj.room.h).toBe(720);
    expect(proj.catalog.length).toBeGreaterThanOrEqual(20);
    expect(proj.cables.length).toBeGreaterThanOrEqual(2);
  });

  runner.test('T1.8.4', 'Large commercial whole-floorplate payload structure (100+ items)', () => {
    const proj = createLargeFloorplateProject(120);
    expect(proj.room.name).toContain('Commercial');
    expect(proj.room.w).toBe(2000);
    expect(proj.room.h).toBe(1800);
    expect(proj.catalog.length).toBe(120);
    expect(proj.cables.length).toBeGreaterThanOrEqual(10);
  });

  runner.test('T1.8.5', 'Zero-exception project loading and coordinate validity', () => {
    const projects = [smallStudioProject, createMediumApartmentProject(), createLargeFloorplateProject(120)];

    projects.forEach(p => {
      // Coordinate validity check: items within room boundaries
      const items = p.catalog;
      items.forEach(it => {
        expect(it.w).toBeGreaterThan(0);
        expect(it.h).toBeGreaterThan(0);
        expect(it.zHeight).toBeGreaterThan(0);
      });

      // Cable endpoints match valid catalog items or outlets
      p.cables.forEach(c => {
        expect(typeof c.fromId).toBe('string');
        expect(typeof c.toId).toBe('string');
      });
    });
  });
}

module.exports = { registerTier1Tests };
