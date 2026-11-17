/**
 * SimpleCAD Synthetic Project Schema & Constraint Validator
 * Verifies that all representative test projects conform to:
 * - SimpleCAD v2 & v3 schema contracts
 * - Structural and architectural constraints for the generated proposal fixtures
 * - A separate import simulation, not execution of the app's applyImportedJson
 * It reports dimension loss and ignored v3 structures; success is not app compatibility.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function validateProject(filePath, scaleName, expectedConstraints) {
  console.log(`\nValidating ${scaleName} (${path.basename(filePath)})...`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const rawText = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Invalid JSON syntax in ${filePath}: ${err.message}`);
  }

  // 1. Basic V3 / V2 Top-Level Contracts
  if (!data.app || data.app !== 'SimpleCAD') {
    throw new Error(`Expected app === "SimpleCAD", got "${data.app}"`);
  }
  if (!data.version || (data.version !== 2 && data.version !== 3)) {
    throw new Error(`Expected version 2 or 3, got ${data.version}`);
  }

  // 2. Room Dimensions & Wall Thickness
  if (!data.room || typeof data.room.w !== 'number' || typeof data.room.h !== 'number') {
    throw new Error('Missing or invalid room geometry');
  }
  if (data.room.w !== expectedConstraints.w || data.room.h !== expectedConstraints.h) {
    throw new Error(`Dimension mismatch: expected ${expectedConstraints.w}x${expectedConstraints.h}, got ${data.room.w}x${data.room.h}`);
  }
  if (data.room.wallThickness !== expectedConstraints.wallThickness) {
    throw new Error(`Wall thickness mismatch: expected ${expectedConstraints.wallThickness}, got ${data.room.wallThickness}`);
  }

  // 3. Doors & Windows Counts
  const doors = data.room.doors || [];
  const windows = data.room.windows || [];
  const outlets = data.room.outlets || [];
  const cables = data.cables || [];
  const items = data.items || [];

  if (doors.length < expectedConstraints.minDoors || (expectedConstraints.maxDoors && doors.length > expectedConstraints.maxDoors)) {
    throw new Error(`Door count violation: expected [${expectedConstraints.minDoors}..${expectedConstraints.maxDoors || '+'}], got ${doors.length}`);
  }
  if (windows.length < expectedConstraints.minWindows || (expectedConstraints.maxWindows && windows.length > expectedConstraints.maxWindows)) {
    throw new Error(`Window count violation: expected [${expectedConstraints.minWindows}..${expectedConstraints.maxWindows || '+'}], got ${windows.length}`);
  }
  if (outlets.length < expectedConstraints.minOutlets) {
    throw new Error(`Outlet count violation: expected >= ${expectedConstraints.minOutlets}, got ${outlets.length}`);
  }
  if (cables.length < expectedConstraints.minCables || (expectedConstraints.maxCables && cables.length > expectedConstraints.maxCables)) {
    throw new Error(`Cable count violation: expected [${expectedConstraints.minCables}..${expectedConstraints.maxCables || '+'}], got ${cables.length}`);
  }
  if (items.length < expectedConstraints.minItems || items.length > expectedConstraints.maxItems) {
    throw new Error(`Item count violation: expected [${expectedConstraints.minItems}..${expectedConstraints.maxItems}], got ${items.length}`);
  }

  // 4. V3 Hierarchical Structure: Layers, Buildings, Storeys, WallGraph, Spaces
  if (!Array.isArray(data.layers) || data.layers.length < 8) {
    throw new Error(`Expected at least 8 standard CAD layers, got ${data.layers?.length}`);
  }
  if (!Array.isArray(data.buildings) || data.buildings.length < 1) {
    throw new Error('Expected at least 1 building definition');
  }
  const building = data.buildings[0];
  if (!Array.isArray(building.storeys) || building.storeys.length < 1) {
    throw new Error('Expected at least 1 storey in building');
  }
  const storey = building.storeys[0];
  if (!storey.wallGraph || !Array.isArray(storey.wallGraph.segments) || !Array.isArray(storey.wallGraph.nodes)) {
    throw new Error('Missing wallGraph nodes or segments in storey');
  }
  const wallSegments = storey.wallGraph.segments;
  if (wallSegments.length < expectedConstraints.minWallSegments) {
    throw new Error(`Wall segment count violation: expected >= ${expectedConstraints.minWallSegments}, got ${wallSegments.length}`);
  }
  const spaces = storey.spaces || [];
  if (spaces.length < expectedConstraints.minSpaces) {
    throw new Error(`Spaces count violation: expected >= ${expectedConstraints.minSpaces}, got ${spaces.length}`);
  }

  // 5. Separate import simulation; this is not the app's applyImportedJson.
  let loadedState = null;
  try {
    const parsed = JSON.parse(rawText);
    loadedState = {
      room: {
        name: String(parsed.room.name || 'Quarto').slice(0, 60),
        w: Math.max(100, Math.min(2000, Number(parsed.room.w))),
        h: Math.max(100, Math.min(2000, Number(parsed.room.h))),
        wallThickness: Number(parsed.room.wallThickness) || 14,
        doors: Array.isArray(parsed.room.doors) ? parsed.room.doors : [],
        windows: Array.isArray(parsed.room.windows) ? parsed.room.windows : [],
        outlets: Array.isArray(parsed.room.outlets) ? parsed.room.outlets : []
      },
      cables: Array.isArray(parsed.cables) ? parsed.cables.map(c => ({
        id: String(c.id),
        name: String(c.name || 'Cabo').slice(0, 50),
        fromId: String(c.fromId || ''),
        toId: String(c.toId || ''),
        maxMeters: Math.max(0.3, Math.min(50, Number(c.maxMeters) || 3.0)),
        warnMeters: Number(c.warnMeters) || 2.5,
        routingMode: c.routingMode === 'wall' ? 'wall' : 'direct',
        visible: c.visible !== false
      })) : [],
      items: (Array.isArray(parsed.items) ? parsed.items : []).map(it => ({
        id: String(it.id),
        name: String(it.name || 'Móvel').slice(0, 60),
        type: String(it.type || 'box'),
        w: Math.max(4, Math.min(600, Number(it.w ?? 60))),
        h: Math.max(4, Math.min(600, Number(it.h ?? 45))),
        zHeight: Math.max(1, Math.min(350, Number(it.zHeight ?? 75))),
        x: Number(it.cx ?? it.x ?? 60),
        y: Number(it.cy ?? it.y ?? 60),
        rot: Number(it.rot ?? 0),
        color: it.color || 'zinc',
        ignoreCollision: Boolean(it.ignoreCollision),
        lockedDims: Boolean(it.lockedDims),
        visible: it.visible !== false
      }))
    };
  } catch (err) {
    throw new Error(`Separate import simulation threw: ${err.message}`);
  }

  console.log(`  ✓ Passed all schema and constraint checks:`);
  console.log(`    - Dimensions: ${data.room.w}×${data.room.h} cm (Wall Thickness: ${data.room.wallThickness} cm)`);
  console.log(`    - Items: ${items.length} (Expected: ${expectedConstraints.minItems}..${expectedConstraints.maxItems})`);
  console.log(`    - Doors: ${doors.length} (Expected: >= ${expectedConstraints.minDoors})`);
  console.log(`    - Windows: ${windows.length} (Expected: >= ${expectedConstraints.minWindows})`);
  console.log(`    - Outlets: ${outlets.length} (Expected: >= ${expectedConstraints.minOutlets})`);
  console.log(`    - Cables: ${cables.length} (Expected: >= ${expectedConstraints.minCables})`);
  console.log(`    - Wall Segments: ${wallSegments.length} (Expected: >= ${expectedConstraints.minWallSegments})`);
  console.log(`    - Spaces/Rooms: ${spaces.length} (Expected: >= ${expectedConstraints.minSpaces})`);
  console.log(`    - CAD Layers: ${data.layers.length}`);
  console.log(`    - Separate import simulation: completed (${loadedState.items.length} items; app not executed)`);
  if (loadedState.room.w !== data.room.w || loadedState.room.h !== data.room.h) {
    console.warn(`    - Dimension loss: ${data.room.w}×${data.room.h} becomes ${loadedState.room.w}×${loadedState.room.h} cm in the simulation (2000 cm limit).`);
  }
  const ignoredStructures = ['layers', 'buildings', 'wallGraph', 'spaces'].filter(key => key in data);
  if (ignoredStructures.length) {
    console.warn(`    - Ignored v3 structures: ${ignoredStructures.join(', ')} (including nested storeys, wall graphs, and spaces). No v3 import fidelity is established.`);
  }

  return true;
}

function runValidation() {
  console.log('==============================================================================');
  console.log('         SIMPLECAD TEST PROJECTS SUITE VALIDATION & CONFORMANCE               ');
  console.log('==============================================================================');

  const projDir = path.resolve(__dirname, '..', 'projects');

  // Small Studio: 440×380 cm, 14cm wall, 11-15 items, 1 door, 1 window, 4 outlets, 1 cable run
  validateProject(
    path.join(projDir, 'project-small-studio.json'),
    'Small Studio Baseline',
    {
      w: 440,
      h: 380,
      wallThickness: 14,
      minItems: 11,
      maxItems: 15,
      minDoors: 1,
      maxDoors: 1,
      minWindows: 1,
      maxWindows: 1,
      minOutlets: 4,
      minCables: 1,
      maxCables: 1,
      minWallSegments: 4,
      minSpaces: 1
    }
  );

  // Medium Apartment: ~1200×900 cm, 16cm wall, 4+ rooms, 28+ wall segments, 6 doors, 7 windows, 80-100 items, 14 cables
  validateProject(
    path.join(projDir, 'project-medium-apartment.json'),
    'Medium Apartment Suite',
    {
      w: 1200,
      h: 900,
      wallThickness: 16,
      minItems: 80,
      maxItems: 100,
      minDoors: 6,
      maxDoors: 6,
      minWindows: 7,
      maxWindows: 7,
      minOutlets: 10,
      minCables: 14,
      maxCables: 14,
      minWallSegments: 28,
      minSpaces: 4
    }
  );

  // Large Floorplate: ~3600×2400 cm, 24cm wall, 150+ wall segments, 30+ doors, 40+ windows, 500-1,000 items, 50+ cables
  validateProject(
    path.join(projDir, 'project-large-floorplate.json'),
    'Large Commercial Floorplate',
    {
      w: 3600,
      h: 2400,
      wallThickness: 24,
      minItems: 500,
      maxItems: 1000,
      minDoors: 30,
      minWindows: 40,
      minOutlets: 30,
      minCables: 50,
      minWallSegments: 150,
      minSpaces: 10
    }
  );

  console.log('\n==============================================================================');
  console.log('Synthetic fixture constraints passed. Review simulation warnings; real app import compatibility is unverified.');
  console.log('==============================================================================\n');
}

runValidation();
