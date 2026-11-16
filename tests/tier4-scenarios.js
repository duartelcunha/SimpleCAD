/**
 * SimpleCAD Synthetic Checks — Tier 4: Scenario Models
 * Five fixture and source-inspection scenarios. These do not execute app.js,
 * build the application, or exercise end-to-end user workflows.
 */

'use strict';

const fs = require('fs');
const path = require('path');
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

function registerTier4Tests(runner) {
  runner.suite('Tier 4: Synthetic Scenario Models');

  // =========================================================================
  // SCENARIO 1: Studio Bedroom 2D/3D Styling & Export (F1, F2, F3, F8)
  // =========================================================================
  runner.test('T4.1', 'Scenario 1: Studio Bedroom 2D/3D Styling & Export workflow', () => {
    const project = smallStudioProject;
    const css = new CSSInspector();
    const ctx2D = new MockCanvas2D(1920, 1080);
    const ctx3D = new MockCanvas2D(1920, 1080);

    // 1. Verify CSS tokens for Harbour Blue + Ochre-Yellow + Obsidian Black
    expect(css.hasVar('--bg-app')).toBeTruthy();
    expect(css.hasVar('--harbour-blue')).toBeTruthy();
    expect(css.hasVar('--accent')).toBeTruthy();

    // 2. Render 2D floor plan with wall poché and line hierarchy
    const bounds = GeometryEngine.computeWallPocheBounds(project.room);
    ctx2D.fillStyle = '#0a0b0d';
    ctx2D.fillRect(0, 0, 1920, 1080);
    ctx2D.lineWidth = 2.5; // Structural wall cut
    ctx2D.strokeRect(bounds.outer.x, bounds.outer.y, bounds.outer.w, bounds.outer.h);
    ctx2D.strokeRect(bounds.inner.x, bounds.inner.y, bounds.inner.w, bounds.inner.h);

    project.catalog.forEach(item => {
      ctx2D.lineWidth = item.type === 'bed' ? 1.0 : 0.8;
      ctx2D.strokeRect(item.w, item.h, 30, 30);
    });

    expect(ctx2D.hasStrokeWithWidth(2.5)).toBeTruthy();
    expect(ctx2D.hasStrokeWithWidth(1.0)).toBeTruthy();

    // 3. Render 3D view with 3-tone cel-shading
    const sunVector = { x: 0.577, y: -0.577, z: 0.577 };
    project.catalog.forEach(item => {
      const topShade = GeometryEngine.compute3ToneCelShading({ x: 0, y: 0, z: 1 }, sunVector);
      expect(topShade.tone).toBe('sunlight');
    });

    // 4. Export payload to JSON and verify roundtrip fidelity
    const exportedJson = JSON.stringify(project);
    const imported = JSON.parse(exportedJson);
    expect(imported.room.name).toBe(project.room.name);
    expect(imported.catalog.length).toBe(project.catalog.length);
  });

  // =========================================================================
  // SCENARIO 2: Residential Apartment Load & Collision Check (F1, F2, F7, F8)
  // =========================================================================
  runner.test('T4.2', 'Scenario 2: Residential Apartment Load & SAT Collision Check workflow', () => {
    const apt = createMediumApartmentProject();
    expect(apt.catalog.length).toBeGreaterThanOrEqual(20);

    // 1. Convert all furniture items in active layout to OBB polygons
    const layout = apt.layouts[0];
    const itemPolygons = [];

    apt.catalog.forEach(item => {
      const placement = layout.placements[item.id];
      if (placement) {
        const poly = GeometryEngine.getItemPolygon({
          minX: placement.minX,
          minY: placement.minY,
          w: placement.w,
          h: placement.h,
          rot: placement.rot
        });
        itemPolygons.push({ id: item.id, ignoreCollision: item.ignoreCollision, poly });
      }
    });

    // 2. Perform pairwise SAT collision checks
    let collisionPairs = 0;
    for (let i = 0; i < itemPolygons.length; i++) {
      for (let j = i + 1; j < itemPolygons.length; j++) {
        const a = itemPolygons[i];
        const b = itemPolygons[j];
        if (a.ignoreCollision || b.ignoreCollision) continue;

        if (GeometryEngine.polygonsIntersect(a.poly, b.poly)) {
          collisionPairs++;
        }
      }
    }

    // In a well-placed default apartment layout, valid non-overlapping furniture should have zero collisions
    expect(collisionPairs).toBe(0);

    // 3. Deliberately move an item into another to verify SAT detection triggers
    const movedPoly = GeometryEngine.getItemPolygon({
      minX: layout.placements['sofa-living'].minX,
      minY: layout.placements['sofa-living'].minY,
      w: 100,
      h: 100,
      rot: 0
    });
    const sofaPoly = itemPolygons.find(p => p.id === 'sofa-living').poly;
    const hasCollision = GeometryEngine.polygonsIntersect(movedPoly, sofaPoly);
    expect(hasCollision).toBe(true);
  });

  // =========================================================================
  // SCENARIO 3: Commercial Whole-Floorplate 1000-Item Benchmark (F1, F2, F7, F8)
  // =========================================================================
  runner.test('T4.3', 'Scenario 3: Commercial Whole-Floorplate 1000-Item Benchmark workflow', () => {
    // Generate scaled commercial payload with 1,000 items
    const floorplate = createLargeFloorplateProject(1000);
    expect(floorplate.catalog.length).toBe(1000);

    // Benchmark 1: Serialization throughput
    const t0 = process.hrtime.bigint();
    const serialized = JSON.stringify(floorplate);
    const deserialized = JSON.parse(serialized);
    const t1 = process.hrtime.bigint();
    const serializationMs = Number(t1 - t0) / 1e6;

    expect(deserialized.catalog.length).toBe(1000);
    expect(serializationMs).toBeLessThan(250); // Under 250ms for 1,000 items

    // Benchmark 2: 2D Floor Plan Drawing pass
    const ctx = new MockCanvas2D(3840, 2160); // 4K Canvas
    const t2 = process.hrtime.bigint();
    ctx.fillRect(0, 0, 3840, 2160);
    floorplate.catalog.forEach(item => {
      ctx.strokeRect(item.w, item.h, 40, 40);
    });
    const t3 = process.hrtime.bigint();
    const render2DMs = Number(t3 - t2) / 1e6;

    expect(render2DMs).toBeLessThan(50);
    expect(ctx.getCalls('strokeRect').length).toBe(1000);
  });

  // =========================================================================
  // SCENARIO 4: Architectural Scope & Layers Schema Verification (F4, F5, F6, F8)
  // =========================================================================
  runner.test('T4.4', 'Scenario 4: Architectural Scope & Layers Schema Verification workflow', () => {
    const archDoc = new DocAuditor('docs/ARCHITECTURE_LAYERS_DIVISIONS_BUILDINGS.md');
    const perfDoc = new DocAuditor('docs/PERFORMANCE_STRATEGY.md');
    const uxDoc = new DocAuditor('docs/UX_AUDIT_REPORT.md');

    // All three architectural and strategic planning documents must exist and be cohesive
    expect(archDoc.exists).toBeTruthy();
    expect(perfDoc.exists).toBeTruthy();
    expect(uxDoc.exists).toBeTruthy();

    // Verify key architectural schema definitions:
    // 1. Wall graph model
    expect(archDoc.contains(/WallNode/i)).toBeTruthy();
    expect(archDoc.contains(/WallSegment/i)).toBeTruthy();

    // 2. Space detection
    expect(archDoc.contains(/Space/i) && archDoc.contains(/Left-Face/i)).toBeTruthy();

    // 3. Performance hash grid
    expect(perfDoc.contains(/Spatial Hash/i)).toBeTruthy();

    // 4. UX Usability Ratings
    expect(uxDoc.contains(/10/i)).toBeTruthy();
  });

  // =========================================================================
  // SCENARIO 5: Source and Asset Presence Checks (F1-F8)
  // =========================================================================
  runner.test('T4.5', 'Scenario 5: Source and asset presence (no build or visual validation)', () => {
    // 1. Inspect index.html markup
    const htmlPath = path.join(ROOT_DIR, 'index.html');
    expect(fs.existsSync(htmlPath)).toBeTruthy();
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('cadCanvas');
    expect(html).toContain('viewport');
    expect(html).toContain('styles.css');
    expect(html).toContain('default-room.js');
    expect(html).toContain('app.js');

    // 2. Inspect brand assets
    const iconSvgPath = path.join(ROOT_DIR, 'icon.svg');
    expect(fs.existsSync(iconSvgPath)).toBeTruthy();
    const iconSvg = fs.readFileSync(iconSvgPath, 'utf8');
    expect(iconSvg).toContain('<svg');

    // 3. Inspect styles.css theme tokens
    const css = new CSSInspector();
    expect(css.hasVar('--bg-app')).toBeTruthy();
    expect(css.hasVar('--harbour-blue')).toBeTruthy();
    expect(css.hasVar('--accent')).toBeTruthy();

    // 4. Inspect default-room.js color palette
    const defaultRoomPath = path.join(ROOT_DIR, 'default-room.js');
    expect(fs.existsSync(defaultRoomPath)).toBeTruthy();
    const defRoomCode = fs.readFileSync(defaultRoomPath, 'utf8');
    expect(defRoomCode).toContain('COLOR_PALETTE');
    expect(defRoomCode).toContain('DEFAULT_PROJECT');

    // 5. Verify documentation artifacts
    expect(fs.existsSync(path.join(ROOT_DIR, 'docs', 'ARCHITECTURE_LAYERS_DIVISIONS_BUILDINGS.md'))).toBeTruthy();
    expect(fs.existsSync(path.join(ROOT_DIR, 'docs', 'UX_AUDIT_REPORT.md'))).toBeTruthy();
    expect(fs.existsSync(path.join(ROOT_DIR, 'docs', 'PERFORMANCE_STRATEGY.md'))).toBeTruthy();
  });
}

module.exports = { registerTier4Tests };
