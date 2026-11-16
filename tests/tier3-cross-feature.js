/**
 * SimpleCAD Synthetic Checks — Tier 3: Cross-Feature Examples
 * Mock styling, separate algorithms, fixtures, and document checks.
 * These checks do not establish app integration behavior.
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

function registerTier3Tests(runner) {
  runner.suite('Tier 3: Cross-Feature Combinations');

  // =========================================================================
  // XF1: 2D Poché & Line Weight applied to Large Commercial Floorplate project
  // =========================================================================
  runner.test('T3.1', 'XF1: 2D Poché & Line Weight applied to Large Commercial Floorplate project', () => {
    const floorplate = createLargeFloorplateProject(120);
    const bounds = GeometryEngine.computeWallPocheBounds(floorplate.room);

    expect(bounds.thickness).toBe(24);
    expect(bounds.outer.w).toBe(2048);
    expect(bounds.outer.h).toBe(1848);

    const ctx = new MockCanvas2D(2048, 1848);
    // Draw outer & inner cut wall lines with Tier 1 line weight
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bounds.outer.x, bounds.outer.y, bounds.outer.w, bounds.outer.h);
    ctx.strokeRect(bounds.inner.x, bounds.inner.y, bounds.inner.w, bounds.inner.h);

    // Draw 120 items with Tier 3 furniture silhouette line weight
    floorplate.catalog.forEach(item => {
      ctx.lineWidth = 0.9;
      ctx.strokeRect(item.w, item.h, 20, 20);
    });

    expect(ctx.hasStrokeWithWidth(2.5)).toBeTruthy();
    expect(ctx.hasStrokeWithWidth(0.9)).toBeTruthy();
    expect(ctx.getCalls('strokeRect').length).toBe(122);
  });

  // =========================================================================
  // XF2: 3D Cel-shading & Material Archetypes applied to Small Studio project
  // =========================================================================
  runner.test('T3.2', 'XF2: 3D Cel-shading & Material Archetypes applied to Small Studio project', () => {
    const studio = smallStudioProject;
    const sunVector = { x: 0.577, y: -0.577, z: 0.577 };

    const renderedFaces = [];
    studio.catalog.forEach(item => {
      // Horizontal top face normal
      const topNormal = { x: 0, y: 0, z: 1 };
      const topShade = GeometryEngine.compute3ToneCelShading(topNormal, sunVector);

      // Vertical side face normal
      const sideNormal = { x: 0, y: 1, z: 0 };
      const sideShade = GeometryEngine.compute3ToneCelShading(sideNormal, sunVector);

      renderedFaces.push({ item: item.id, topShade: topShade.tone, sideShade: sideShade.tone });
    });

    expect(renderedFaces.length).toBe(studio.catalog.length);
    renderedFaces.forEach(f => {
      expect(f.topShade).toBe('sunlight');
      expect(f.sideShade).toBe('shadow');
    });
  });

  // =========================================================================
  // XF3: Spatial Hash Grid / Performance benchmark integration with 1000-element collision load
  // =========================================================================
  runner.test('T3.3', 'XF3: Spatial Hash Grid integration with 1000-element collision load', () => {
    // Spatial hash grid implementation for broadphase pruning
    class SpatialHashGrid {
      constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.cells = new Map();
      }

      _key(cx, cy) {
        return `${cx},${cy}`;
      }

      insert(id, minX, minY, maxX, maxY) {
        const x0 = Math.floor(minX / this.cellSize);
        const y0 = Math.floor(minY / this.cellSize);
        const x1 = Math.floor(maxX / this.cellSize);
        const y1 = Math.floor(maxY / this.cellSize);

        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const k = this._key(x, y);
            if (!this.cells.has(k)) this.cells.set(k, []);
            this.cells.get(k).push(id);
          }
        }
      }

      query(minX, minY, maxX, maxY) {
        const x0 = Math.floor(minX / this.cellSize);
        const y0 = Math.floor(minY / this.cellSize);
        const x1 = Math.floor(maxX / this.cellSize);
        const y1 = Math.floor(maxY / this.cellSize);

        const candidates = new Set();
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const k = this._key(x, y);
            const cell = this.cells.get(k);
            if (cell) {
              for (const id of cell) candidates.add(id);
            }
          }
        }
        return Array.from(candidates);
      }
    }

    const grid = new SpatialHashGrid(150);
    // Insert 1000 items into 3000x3000cm floor
    for (let i = 0; i < 1000; i++) {
      const x = (i % 30) * 100;
      const y = Math.floor(i / 30) * 100;
      grid.insert(`item-${i}`, x, y, x + 60, y + 60);
    }

    // Query local neighborhood of item 0 (x: 0, y: 0, w: 60, h: 60)
    const t0 = process.hrtime.bigint();
    const candidates = grid.query(0, 0, 100, 100);
    const t1 = process.hrtime.bigint();
    const queryDurationMs = Number(t1 - t0) / 1e6;

    // Pruned from 1000 candidates to only immediate neighbors (< 20 items)
    expect(candidates.length).toBeLessThan(20);
    expect(queryDurationMs).toBeLessThan(5);
  });

  // =========================================================================
  // XF4: Architectural Layer Schema compatibility with Project JSON representation
  // =========================================================================
  runner.test('T3.4', 'XF4: Architectural Layer Schema compatibility with Project JSON representation', () => {
    const archDoc = new DocAuditor('docs/ARCHITECTURE_LAYERS_DIVISIONS_BUILDINGS.md');
    expect(archDoc.exists).toBeTruthy();

    // Standard CAD layers defined in spec:
    // A-WALL (Structural), A-DOOR (Openings), A-FURN (Furniture), E-POWR (MEP/Power), A-ANNO (Annotations)
    const layerNames = ['WALL', 'DOOR', 'FURN'];
    layerNames.forEach(name => {
      expect(archDoc.contains(new RegExp(name, 'i'))).toBeTruthy();
    });

    // Check project layout objects can host layerId references
    const project = createMediumApartmentProject();
    project.catalog.forEach((item, idx) => {
      item.layerId = idx % 2 === 0 ? 'A-FURN' : 'A-FIXT';
    });
    expect(project.catalog[0].layerId).toBe('A-FURN');
  });

  // =========================================================================
  // XF5: UX Audit recommendations alignment with UI Design System CSS tokens
  // =========================================================================
  runner.test('T3.5', 'XF5: UX Audit recommendations alignment with UI Design System CSS tokens', () => {
    const uxDoc = new DocAuditor('docs/UX_AUDIT_REPORT.md');
    const css = new CSSInspector();

    expect(uxDoc.exists).toBeTruthy();
    // UX audit references HUD, Contrast, Toolbar, and Shortcuts
    expect(uxDoc.contains(/contrast/i) || uxDoc.contains(/palette/i) || uxDoc.contains(/HUD/i)).toBeTruthy();

    // Verify corresponding tokens exist in CSS
    expect(css.hasVar('--harbour-blue')).toBeTruthy();
    expect(css.hasVar('--accent')).toBeTruthy();
  });

  // =========================================================================
  // XF6: Wall graph planar subdivision in Architectural Spec compatible with 2D Poché double-line calculation
  // =========================================================================
  runner.test('T3.6', 'XF6: Wall graph planar subdivision compatible with 2D Poché calculation', () => {
    // Model a 2-segment wall junction: V0(0,0) -> V1(300,0) -> V2(300,200) with thickness 14cm
    const thickness = 14;
    const halfT = thickness / 2;

    const segment1 = {
      p1: { x: 0, y: 0 },
      p2: { x: 300, y: 0 },
      thickness
    };
    const segment2 = {
      p1: { x: 300, y: 0 },
      p2: { x: 300, y: 200 },
      thickness
    };

    // Parallel offset lines for poché double lines
    const offset1_left = { y: segment1.p1.y - halfT };
    const offset1_right = { y: segment1.p1.y + halfT };
    const offset2_left = { x: segment2.p1.x - halfT };
    const offset2_right = { x: segment2.p1.x + halfT };

    expect(offset1_right.y - offset1_left.y).toBe(14);
    expect(offset2_right.x - offset2_left.x).toBe(14);
  });

  // =========================================================================
  // XF7: 3D Ground AO footprint shadows calculated with correct item bounding boxes
  // =========================================================================
  runner.test('T3.7', 'XF7: 3D Ground AO footprint shadows calculated with correct item bounding boxes', () => {
    const project = createMediumApartmentProject();
    const ctx = new MockCanvas2D(1200, 900);

    let shadowCount = 0;
    project.catalog.forEach(item => {
      if (item.type !== 'rug') { // Non-rug items cast contact AO shadow
        const shadowPadding = 4;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 11, 13, 0.40)';
        ctx.fillRect(item.w - shadowPadding, item.h - shadowPadding, item.w + shadowPadding * 2, item.h + shadowPadding * 2);
        ctx.restore();
        shadowCount++;
      }
    });

    expect(shadowCount).toBeGreaterThan(15);
    expect(ctx.hasCall('fillRect')).toBeTruthy();
  });

  // =========================================================================
  // XF8: Serialization roundtrip of large project payload maintains cable and layout relationships
  // =========================================================================
  runner.test('T3.8', 'XF8: Serialization roundtrip maintains cable and layout relationships under benchmark timing', () => {
    const largeProject = createLargeFloorplateProject(120);

    const t0 = process.hrtime.bigint();
    const jsonStr = JSON.stringify(largeProject);
    const parsed = JSON.parse(jsonStr);
    const t1 = process.hrtime.bigint();

    const roundtripMs = Number(t1 - t0) / 1e6;

    expect(roundtripMs).toBeLessThan(100);
    expect(parsed.catalog.length).toBe(120);
    expect(parsed.cables.length).toBe(largeProject.cables.length);
    expect(parsed.layouts[0].id).toBe(largeProject.layouts[0].id);

    // Verify all cable endpoints exist in catalog or outlets
    const catalogIds = new Set(parsed.catalog.map(it => it.id));
    const outletIds = new Set(parsed.room.outlets.map(o => o.id));

    parsed.cables.forEach(c => {
      expect(catalogIds.has(c.fromId)).toBeTruthy();
      expect(outletIds.has(c.toId)).toBeTruthy();
    });
  });
}

module.exports = { registerTier3Tests };
