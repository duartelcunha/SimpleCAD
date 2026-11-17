/**
 * SimpleCAD Test Project Generator
 * Generates the three representative project files:
 * 1. projects/project-small-studio.json (440x380 cm, 12 items, 1 door, 1 window, 4 outlets, 1 cable)
 * 2. projects/project-medium-apartment.json (1200x900 cm, 4+ rooms, 32 wall segments, 6 doors, 7 windows, 88 items, 14 cables)
 * 3. projects/project-large-floorplate.json (3600x2400 cm, 165 wall segments, 34 doors, 44 windows, 640 items, 56 cables)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const standardLayers = [
  { id: 'A-FLOR-SLAB', name: 'Floor Slab & Grid', color: '#28425d', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 0 },
  { id: 'A-WALL-EXTR', name: 'Exterior Walls', color: '#EAE7DF', lineWeightMm: 0.70, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 10 },
  { id: 'A-WALL-INTR', name: 'Interior Partitions', color: '#b0aca2', lineWeightMm: 0.50, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 15 },
  { id: 'A-DOOR',      name: 'Doors & Swings', color: '#c8a96e', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 20 },
  { id: 'A-GLAZ',      name: 'Windows & Glazing', color: '#5a8cb2', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 25 },
  { id: 'A-FURN',      name: 'Furniture & Fixtures', color: '#d99b26', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 30 },
  { id: 'E-POWR',      name: 'Electrical & Cables', color: '#4ecdc4', lineWeightMm: 0.35, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 40 },
  { id: 'A-ANNO-DIMS', name: 'Dimension Lines', color: '#c8a96e', lineWeightMm: 0.18, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 50 },
  { id: 'A-ANNO-TEXT', name: 'Room Stamps & Labels', color: '#EAE7DF', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 60 },
  { id: 'A-CLG-GRID',  name: 'Reflected Ceiling', color: '#505565', lineWeightMm: 0.13, lineType: 'dashed', visible: true, locked: false, printable: true, zOrder: 70 }
];

function buildSmallStudio() {
  const W = 440;
  const H = 380;
  const th = 14;

  const catalog = [
    { id: 'rug',      name: 'Area Rug',       type: 'rug',        w: 228, h: 204, zHeight: 1,   color: 'violet',  ignoreCollision: true,  lockedDims: false, visible: true },
    { id: 'bed',      name: 'Queen Bed',      type: 'bed',        w: 200, h: 155, zHeight: 46,  color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'ns1',      name: 'Nightstand N',   type: 'nightstand', w: 46,  h: 42,  zHeight: 54,  color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'ns2',      name: 'Nightstand S',   type: 'nightstand', w: 46,  h: 42,  zHeight: 54,  color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'lamp',     name: 'Floor Lamp',     type: 'lamp',       w: 36,  h: 36,  zHeight: 162, color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'desk',     name: 'Oak Desk',       type: 'desk',       w: 140, h: 64,  zHeight: 75,  color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'chair',    name: 'Studio Chair',   type: 'chair',      w: 52,  h: 52,  zHeight: 84,  color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'plant',    name: 'Ficus Plant',    type: 'plant',      w: 40,  h: 40,  zHeight: 112, color: 'emerald', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'divider',  name: 'Folding Screen', type: 'divider',    w: 150, h: 4,   zHeight: 178, foldAngles: [16, -20, 16], color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true, adjustable: true },
    { id: 'shelf',    name: 'Bookcase',       type: 'shelf',      w: 120, h: 36,  zHeight: 175, color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'wardrobe', name: 'Wardrobe',       type: 'wardrobe',   w: 150, h: 56,  zHeight: 205, color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'mirror',   name: 'Vanity Mirror',  type: 'mirror',     w: 55,  h: 8,   zHeight: 165, color: 'sky',     ignoreCollision: false, lockedDims: false, visible: true }
  ];

  const placements = {
    rug:      { minX: 206, minY: 56,  rot: 0,   w: 228, h: 204, zHeight: 1,   visible: true },
    bed:      { minX: 240, minY: 72,  rot: 180, w: 200, h: 155, zHeight: 46,  visible: true },
    ns1:      { minX: 394, minY: 20,  rot: 270, w: 46,  h: 42,  zHeight: 54,  visible: true },
    ns2:      { minX: 394, minY: 236, rot: 270, w: 46,  h: 42,  zHeight: 54,  visible: true },
    lamp:     { minX: 332, minY: 18,  rot: 0,   w: 36,  h: 36,  zHeight: 162, visible: true },
    desk:     { minX: 54,  minY: 14,  rot: 0,   w: 140, h: 64,  zHeight: 75,  visible: true },
    chair:    { minX: 98,  minY: 88,  rot: 0,   w: 52,  h: 52,  zHeight: 84,  visible: true },
    plant:    { minX: 8,   minY: 14,  rot: 0,   w: 40,  h: 40,  zHeight: 112, visible: true },
    divider:  { cx: 190,   cy: 154,   rot: 90,  w: 150, h: 4,   zHeight: 178, visible: true, foldAngles: [16, -20, 16] },
    shelf:    { minX: 0,   minY: 120, rot: 270, w: 120, h: 36,  zHeight: 175, visible: true },
    wardrobe: { minX: 256, minY: 324, rot: 180, w: 150, h: 56,  zHeight: 205, visible: true },
    mirror:   { minX: 2,   minY: 260, rot: 90,  w: 55,  h: 8,   zHeight: 165, visible: true }
  };

  const items = catalog.map(cat => {
    const pl = placements[cat.id];
    const isDivider = cat.type === 'divider';
    const cx = isDivider ? pl.cx : pl.minX + pl.w / 2;
    const cy = isDivider ? pl.cy : pl.minY + pl.h / 2;
    return {
      id: cat.id,
      name: cat.name,
      type: cat.type,
      x: cx,
      y: cy,
      cx: cx,
      cy: cy,
      w: pl.w,
      h: pl.h,
      zHeight: pl.zHeight,
      rot: pl.rot,
      color: cat.color,
      ignoreCollision: Boolean(cat.ignoreCollision),
      lockedDims: Boolean(cat.lockedDims),
      visible: pl.visible !== false,
      adjustable: Boolean(cat.adjustable),
      foldAngles: cat.foldAngles
    };
  });

  const doors = [
    { id: 'door-1', name: 'Main Door', wall: 'bottom', offset: 28, width: 90, hinge: 'left', swing: 'inward' }
  ];

  const windows = [
    { id: 'win-1', name: 'Exterior Window', wall: 'top', offset: 36, width: 175 }
  ];

  const outlets = [
    { id: 'T1', name: 'T1', wall: 'top',    pos: 290, x: 290, y: 0 },
    { id: 'T2', name: 'T2', wall: 'right',  pos: 165, x: 440, y: 165 },
    { id: 'T3', name: 'T3', wall: 'left',   pos: 110, x: 0,   y: 110 },
    { id: 'T4', name: 'T4', wall: 'bottom', pos: 215, x: 215, y: 380 }
  ];

  const cables = [
    {
      id: 'cable-demo',
      name: 'Power Line (Desk to T1)',
      fromId: 'desk',
      toId: 'T1',
      maxMeters: 4.5,
      warnMeters: 3.8,
      routingMode: 'wall',
      color: '#6e9887',
      visible: true
    }
  ];

  const nodes = [
    { id: 'node-tl', x: 0, y: 0 },
    { id: 'node-tr', x: W, y: 0 },
    { id: 'node-br', x: W, y: H },
    { id: 'node-bl', x: 0, y: H }
  ];

  const segments = [
    { id: 'wall-top',    startNodeId: 'node-tl', endNodeId: 'node-tr', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-right',  startNodeId: 'node-tr', endNodeId: 'node-br', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-bottom', startNodeId: 'node-br', endNodeId: 'node-bl', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-left',   startNodeId: 'node-bl', endNodeId: 'node-tl', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true }
  ];

  const spaces = [
    {
      id: 'space-main',
      name: 'Studio Bedroom Suite',
      number: '101',
      boundarySegmentIds: ['wall-top', 'wall-right', 'wall-bottom', 'wall-left'],
      polygon: [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: H },
        { x: 0, y: H }
      ],
      areaM2: Number(((W * H) / 10000).toFixed(2)),
      perimeterM: Number(((2 * (W + H)) / 100).toFixed(2)),
      centroid: { x: W / 2, y: H / 2 },
      floorMaterial: 'herringbone_parquet',
      fillColor: '#121316'
    }
  ];

  const openings = [
    {
      id: 'door-1',
      wallSegmentId: 'wall-bottom',
      t: Number(((28 + 45) / W).toFixed(4)),
      width: 90,
      height: 210,
      sillHeight: 0,
      type: 'door_single_swing',
      hinge: 'left',
      swing: 'inward',
      swingAngleDeg: 90
    },
    {
      id: 'win-1',
      wallSegmentId: 'wall-top',
      t: Number(((36 + 87.5) / W).toFixed(4)),
      width: 175,
      height: 140,
      sillHeight: 90,
      type: 'window_casement',
      hinge: 'left',
      swing: 'outward',
      swingAngleDeg: 45,
      glazing: { paneCount: 2, mullionThicknessCm: 4, glassTint: '#5a8cb2' }
    }
  ];

  const furniture = items.map(it => ({
    id: it.id,
    name: it.name,
    archetype: it.type,
    layerId: 'A-FURN',
    spaceId: 'space-main',
    x: it.x,
    y: it.y,
    z: 0,
    rotation: it.rot,
    w: it.w,
    h: it.h,
    zHeight: it.zHeight,
    color: it.color,
    ignoreCollision: it.ignoreCollision,
    lockedDims: it.lockedDims,
    visible: it.visible
  }));

  const annotations = outlets.map(o => ({
    id: `anno-${o.id}`,
    layerId: 'E-POWR',
    type: 'leader_text',
    x1: o.x,
    y1: o.y,
    text: o.name,
    fontSizePx: 12
  }));

  return {
    version: 3,
    app: 'SimpleCAD',
    createdAt: '2026-11-15T13:30:00.000Z',
    updatedAt: '2026-11-15T13:30:00.000Z',
    project: {
      id: 'proj-small-studio',
      name: 'Studio Bedroom Baseline (440×380 cm)',
      author: 'SimpleCAD Architecture Lab',
      units: 'cm',
      gridStepCm: 10,
      majorGridStepCm: 50,
      activeBuildingId: 'bldg-studio',
      activeStoreyId: 'lvl-0',
      activeLayoutId: 'opt1'
    },
    // Top-level v2 backwards-compatibility fields:
    room: {
      name: 'Studio Bedroom (440×380 cm)',
      w: W,
      h: H,
      wallThickness: th,
      doors,
      windows,
      outlets
    },
    cables,
    catalog,
    items,
    activeLayoutId: 'opt1',
    layouts: [
      {
        id: 'opt1',
        name: 'Studio Suite (Default Baseline)',
        builtIn: true,
        placements
      }
    ],
    // V3 full hierarchy:
    layers: standardLayers,
    buildings: [
      {
        id: 'bldg-studio',
        name: 'Residential Pavilion',
        storeys: [
          {
            id: 'lvl-0',
            name: 'Studio Floor (Level 0)',
            index: 0,
            elevationZ: 0,
            storyHeight: 280,
            slabThickness: 20,
            wallGraph: {
              nodes,
              segments
            },
            spaces,
            openings,
            furniture,
            cables: cables.map(c => ({ ...c, layerId: 'E-POWR' })),
            annotations
          }
        ]
      }
    ]
  };
}

function buildMediumApartment() {
  const W = 1200;
  const H = 900;
  const th = 16;

  // Multi-room layout definition:
  // Space 1: Living & Dining (x: 0..700, y: 400..900) - 700x500 cm
  // Space 2: Master Bedroom (x: 700..1200, y: 0..500) - 500x500 cm
  // Space 3: En-suite Bathroom (x: 950..1200, y: 500..900) - 250x400 cm
  // Space 4: Home Office (x: 0..420, y: 0..400) - 420x400 cm
  // Space 5: Kitchenette & Pantry (x: 420..700, y: 0..400) - 280x400 cm
  // Space 6: Entry Foyer & Gallery (x: 700..950, y: 500..900) - 250x400 cm

  const nodes = [
    // Exterior perimeter corners and divisions
    { id: 'n01', x: 0, y: 0 },
    { id: 'n02', x: 420, y: 0 },
    { id: 'n03', x: 700, y: 0 },
    { id: 'n04', x: 950, y: 0 },
    { id: 'n05', x: 1200, y: 0 },
    { id: 'n06', x: 1200, y: 250 },
    { id: 'n07', x: 1200, y: 500 },
    { id: 'n08', x: 1200, y: 700 },
    { id: 'n09', x: 1200, y: 900 },
    { id: 'n10', x: 950, y: 900 },
    { id: 'n11', x: 700, y: 900 },
    { id: 'n12', x: 400, y: 900 },
    { id: 'n13', x: 0, y: 900 },
    { id: 'n14', x: 0, y: 650 },
    { id: 'n15', x: 0, y: 400 },
    { id: 'n16', x: 0, y: 200 },

    // Interior T-junction and partition nodes
    { id: 'n17', x: 420, y: 400 },
    { id: 'n18', x: 700, y: 400 },
    { id: 'n19', x: 700, y: 500 },
    { id: 'n20', x: 950, y: 500 },
    { id: 'n21', x: 950, y: 700 },
    { id: 'n22', x: 700, y: 700 },
    { id: 'n23', x: 200, y: 400 },
    { id: 'n24', x: 560, y: 400 },
    { id: 'n25', x: 1080, y: 500 },
    { id: 'n26', x: 1080, y: 700 },
    { id: 'n27', x: 420, y: 200 },
    { id: 'n28', x: 700, y: 200 }
  ];

  // 32 Wall segments (surpasses 28+ requirement)
  const segments = [
    // Exterior North segments (y=0)
    { id: 'w-ext-n1', startNodeId: 'n01', endNodeId: 'n02', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-n2', startNodeId: 'n02', endNodeId: 'n03', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-n3', startNodeId: 'n03', endNodeId: 'n04', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-n4', startNodeId: 'n04', endNodeId: 'n05', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },

    // Exterior East segments (x=1200)
    { id: 'w-ext-e1', startNodeId: 'n05', endNodeId: 'n06', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-e2', startNodeId: 'n06', endNodeId: 'n07', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-e3', startNodeId: 'n07', endNodeId: 'n08', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-e4', startNodeId: 'n08', endNodeId: 'n09', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },

    // Exterior South segments (y=900)
    { id: 'w-ext-s1', startNodeId: 'n09', endNodeId: 'n10', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-s2', startNodeId: 'n10', endNodeId: 'n11', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-s3', startNodeId: 'n11', endNodeId: 'n12', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-s4', startNodeId: 'n12', endNodeId: 'n13', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },

    // Exterior West segments (x=0)
    { id: 'w-ext-w1', startNodeId: 'n13', endNodeId: 'n14', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-w2', startNodeId: 'n14', endNodeId: 'n15', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-w3', startNodeId: 'n15', endNodeId: 'n16', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'w-ext-w4', startNodeId: 'n16', endNodeId: 'n01', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },

    // Interior Horizontal dividing walls (y=400)
    { id: 'w-int-h1', startNodeId: 'n15', endNodeId: 'n23', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-h2', startNodeId: 'n23', endNodeId: 'n17', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-h3', startNodeId: 'n17', endNodeId: 'n24', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-h4', startNodeId: 'n24', endNodeId: 'n18', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },

    // Interior Vertical dividing walls (x=420)
    { id: 'w-int-v1', startNodeId: 'n02', endNodeId: 'n27', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-v2', startNodeId: 'n27', endNodeId: 'n17', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },

    // Interior Vertical dividing walls (x=700)
    { id: 'w-int-v3', startNodeId: 'n03', endNodeId: 'n28', thickness: 14, height: 280, type: 'interior', material: 'concrete_cast', layerId: 'A-WALL-INTR', loadBearing: true },
    { id: 'w-int-v4', startNodeId: 'n28', endNodeId: 'n18', thickness: 14, height: 280, type: 'interior', material: 'concrete_cast', layerId: 'A-WALL-INTR', loadBearing: true },
    { id: 'w-int-v5', startNodeId: 'n18', endNodeId: 'n19', thickness: 14, height: 280, type: 'interior', material: 'concrete_cast', layerId: 'A-WALL-INTR', loadBearing: true },
    { id: 'w-int-v6', startNodeId: 'n19', endNodeId: 'n22', thickness: 14, height: 280, type: 'interior', material: 'concrete_cast', layerId: 'A-WALL-INTR', loadBearing: true },
    { id: 'w-int-v7', startNodeId: 'n22', endNodeId: 'n11', thickness: 14, height: 280, type: 'interior', material: 'concrete_cast', layerId: 'A-WALL-INTR', loadBearing: true },

    // Master Bedroom / Foyer / Bath dividing walls (y=500 and x=950)
    { id: 'w-int-h5', startNodeId: 'n19', endNodeId: 'n20', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-h6', startNodeId: 'n20', endNodeId: 'n25', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-h7', startNodeId: 'n25', endNodeId: 'n07', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-v8', startNodeId: 'n20', endNodeId: 'n21', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false },
    { id: 'w-int-v9', startNodeId: 'n21', endNodeId: 'n10', thickness: 12, height: 280, type: 'interior', material: 'gypsum_stud', layerId: 'A-WALL-INTR', loadBearing: false }
  ];

  // 6 Doors (as required)
  const doors = [
    { id: 'd-entry',   name: 'Main Foyer Entry Door', wall: 'bottom', offset: 800, width: 95,  hinge: 'left',  swing: 'inward' },
    { id: 'd-terrace', name: 'Living Balcony Slider',  wall: 'bottom', offset: 160, width: 220, hinge: 'right', swing: 'outward' },
    { id: 'd-office',  name: 'Home Office Door',       wall: 'top',    offset: 200, width: 90,  hinge: 'left',  swing: 'inward' },
    { id: 'd-kitchen', name: 'Kitchen Pocket Door',    wall: 'top',    offset: 560, width: 90,  hinge: 'right', swing: 'inward' },
    { id: 'd-master',  name: 'Master Suite Door',      wall: 'right',  offset: 450, width: 90,  hinge: 'left',  swing: 'inward' },
    { id: 'd-ensuite', name: 'En-suite Bathroom Door', wall: 'right',  offset: 750, width: 80,  hinge: 'right', swing: 'inward' }
  ];

  // 7 Windows (as required)
  const windows = [
    { id: 'w-liv-1', name: 'Living Room South Bay 1', wall: 'bottom', offset: 50,  width: 140 },
    { id: 'w-liv-2', name: 'Living Room South Bay 2', wall: 'bottom', offset: 520, width: 140 },
    { id: 'w-bed-1', name: 'Master Bed East View 1',  wall: 'right',  offset: 80,  width: 150 },
    { id: 'w-bed-2', name: 'Master Bed East View 2',  wall: 'right',  offset: 300, width: 150 },
    { id: 'w-off-1', name: 'Office North Light 1',    wall: 'top',    offset: 60,  width: 130 },
    { id: 'w-off-2', name: 'Office North Light 2',    wall: 'top',    offset: 240, width: 130 },
    { id: 'w-kit-1', name: 'Kitchenette North Pane',  wall: 'top',    offset: 500, width: 120 }
  ];

  // Outlets
  const outlets = [
    { id: 'O1', name: 'O1-Office-PC', wall: 'top',    pos: 120, x: 120, y: 0 },
    { id: 'O2', name: 'O2-Office-Aux', wall: 'left',  pos: 150, x: 0,   y: 150 },
    { id: 'O3', name: 'O3-Kitchen-Fridge', wall: 'top', pos: 460, x: 460, y: 0 },
    { id: 'O4', name: 'O4-Kitchen-Cook', wall: 'top', pos: 620, x: 620, y: 0 },
    { id: 'O5', name: 'O5-Bed-East1', wall: 'right',  pos: 120, x: 1200, y: 120 },
    { id: 'O6', name: 'O6-Bed-East2', wall: 'right',  pos: 280, x: 1200, y: 280 },
    { id: 'O7', name: 'O7-Bed-Media', wall: 'top',    pos: 850, x: 850, y: 0 },
    { id: 'O8', name: 'O8-Bath-Vanity', wall: 'right', pos: 620, x: 1200, y: 620 },
    { id: 'O9', name: 'O9-Foyer-Console', wall: 'bottom', pos: 880, x: 880, y: 900 },
    { id: 'O10', name: 'O10-Living-AV', wall: 'left', pos: 550, x: 0,   y: 550 },
    { id: 'O11', name: 'O11-Living-Sofa', wall: 'left', pos: 780, x: 0, y: 780 },
    { id: 'O12', name: 'O12-Living-Dining', wall: 'bottom', pos: 460, x: 460, y: 900 }
  ];

  // 14 Cables (as required)
  const cables = [
    { id: 'c-liv-tv',      name: 'Living Media Feed',       fromId: 'tv-living',       toId: 'O10', maxMeters: 4.5, warnMeters: 3.8, routingMode: 'wall',   color: '#5a8cb2', visible: true },
    { id: 'c-liv-audio',   name: 'Subwoofer Link',          fromId: 'sofa-living-c',   toId: 'tv-living', maxMeters: 5.0, warnMeters: 4.2, routingMode: 'direct', color: '#c8a96e', visible: true },
    { id: 'c-dining-lamp', name: 'Dining Lamp Circuit',     fromId: 'lamp-dining',     toId: 'O12', maxMeters: 3.5, warnMeters: 2.8, routingMode: 'wall',   color: '#d99b26', visible: true },
    { id: 'c-off-pc',      name: 'Workstation LAN/Power',   fromId: 'pc-workstation',  toId: 'O1',  maxMeters: 3.0, warnMeters: 2.5, routingMode: 'direct', color: '#4ecdc4', visible: true },
    { id: 'c-off-mon',     name: 'Secondary Monitor Power', fromId: 'desk-office',     toId: 'O1',  maxMeters: 2.5, warnMeters: 2.0, routingMode: 'direct', color: '#6e9887', visible: true },
    { id: 'c-off-print',   name: 'Printer Data Line',       fromId: 'shredder-office', toId: 'O2',  maxMeters: 3.5, warnMeters: 3.0, routingMode: 'wall',   color: '#5a8cb2', visible: true },
    { id: 'c-off-lamp',    name: 'Office Desk Lamp',        fromId: 'lamp-office',     toId: 'O2',  maxMeters: 3.0, warnMeters: 2.5, routingMode: 'direct', color: '#d99b26', visible: true },
    { id: 'c-bed-ns1',     name: 'Master Bed L Charger',    fromId: 'ns-m1',           toId: 'O5',  maxMeters: 3.0, warnMeters: 2.4, routingMode: 'wall',   color: '#c8a96e', visible: true },
    { id: 'c-bed-ns2',     name: 'Master Bed R Charger',    fromId: 'ns-m2',           toId: 'O6',  maxMeters: 3.0, warnMeters: 2.4, routingMode: 'wall',   color: '#c8a96e', visible: true },
    { id: 'c-bed-tv',      name: 'Master Bed Display Line', fromId: 'tv-master',       toId: 'O7',  maxMeters: 3.5, warnMeters: 3.0, routingMode: 'wall',   color: '#5a8cb2', visible: true },
    { id: 'c-kit-cook',    name: 'Induction Hob 32A',       fromId: 'counter-cook',    toId: 'O4',  maxMeters: 2.5, warnMeters: 2.0, routingMode: 'direct', color: '#d96b6b', visible: true },
    { id: 'c-kit-fridge',  name: 'Refrigerator Feed',       fromId: 'fridge',          toId: 'O3',  maxMeters: 2.5, warnMeters: 2.0, routingMode: 'wall',   color: '#4ecdc4', visible: true },
    { id: 'c-kit-coffee',  name: 'Coffee Bar Circuit',      fromId: 'coffee-station',  toId: 'O4',  maxMeters: 2.0, warnMeters: 1.6, routingMode: 'direct', color: '#c8a96e', visible: true },
    { id: 'c-foy-lamp',    name: 'Foyer Art Light Circuit', fromId: 'lamp-foyer',      toId: 'O9',  maxMeters: 3.5, warnMeters: 3.0, routingMode: 'wall',   color: '#d99b26', visible: true }
  ];

  // 88 Furniture elements (satisfies 80-100 requirement)
  const items = [];
  const catalog = [];
  const placements = {};

  function addItem(id, name, type, cx, cy, w, h, zH, rot, color, ignoreCol = false, locked = false) {
    const item = {
      id,
      name,
      type,
      x: cx,
      y: cy,
      cx,
      cy,
      w,
      h,
      zHeight: zH,
      rot,
      color,
      ignoreCollision: ignoreCol,
      lockedDims: locked,
      visible: true
    };
    items.push(item);
    catalog.push({
      id,
      name,
      type,
      w,
      h,
      zHeight: zH,
      color,
      ignoreCollision: ignoreCol,
      lockedDims: locked,
      visible: true
    });
    placements[id] = {
      minX: Math.round(cx - w / 2),
      minY: Math.round(cy - h / 2),
      rot,
      w,
      h,
      zHeight: zH,
      visible: true
    };
  }

  // --- Zone 1: Master Bedroom (x: 700..1200, y: 0..500) -> 18 items
  addItem('bed-master',      'King Master Bed',          'bed',        950, 180, 200, 180, 52,  180, 'zinc');
  addItem('ns-m1',           'Master Nightstand Left',   'nightstand', 815, 120, 50,  45,  54,  270, 'amber');
  addItem('ns-m2',           'Master Nightstand Right',  'nightstand', 1085, 120, 50, 45,  54,  270, 'amber');
  addItem('lamp-m1',         'Bedside Lamp L',           'lamp',       815, 120, 30,  30,  65,  0,   'amber');
  addItem('lamp-m2',         'Bedside Lamp R',           'lamp',       1085, 120, 30, 30,  65,  0,   'amber');
  addItem('rug-master',      'Master Wool Rug',          'rug',        950, 220, 260, 220, 1,   0,   'violet', true);
  addItem('bench-master',    'Upholstered Bed End Bench','box',        950, 295, 140, 40,  45,  0,   'zinc');
  addItem('wardrobe-m1',     'Wardrobe Unit A',          'wardrobe',   740, 240, 60,  140, 210, 90,  'zinc');
  addItem('wardrobe-m2',     'Wardrobe Unit B',          'wardrobe',   740, 380, 60,  140, 210, 90,  'zinc');
  addItem('tv-master',       'Bedroom OLED & Console',   'tv',         950, 470, 120, 30,  45,  180, 'sky');
  addItem('chair-master',    'Velvet Reading Armchair',  'chair',      1140, 380, 65, 65,  85,  315, 'amber');
  addItem('lamp-master-fl',  'Reading Floor Lamp',       'lamp',       1160, 440, 36, 36,  165, 0,   'amber');
  addItem('vanity-master',   'Dressing Vanity Desk',     'desk',       1130, 220, 90, 45,  76,  270, 'zinc');
  addItem('mirror-master',   'Full Length Mirror',       'mirror',     1185, 220, 8,  65,  175, 90,  'sky');
  addItem('plant-master1',   'Olive Tree in Ceramic Pot','plant',      750, 90,  45,  45,  130, 0,   'emerald');
  addItem('plant-master2',   'Sansevieria Floor Plant',  'plant',      1140, 90, 40,  40,  110, 0,   'emerald');
  addItem('easel-master1',   'Architectural Sketch 1',   'easel',      870, 20,  55,  35,  160, 0,   'amber');
  addItem('easel-master2',   'Architectural Sketch 2',   'easel',      1030, 20, 55,  35,  160, 0,   'amber');

  // --- Zone 2: Living & Dining (x: 0..700, y: 400..900) -> 28 items
  addItem('rug-living',      'Grand Berber Area Rug',    'rug',        280, 650, 340, 260, 1,   0,   'violet', true);
  addItem('sofa-living-c',   'Sectional Sofa Center',    'sofa',       280, 750, 220, 90,  78,  0,   'violet');
  addItem('sofa-living-l',   'Sectional Left Chaise',    'sofa',       145, 680, 90,  160, 78,  90,  'violet');
  addItem('table-coffee',    'Travertine Coffee Table',  'desk',       280, 630, 120, 60,  38,  0,   'zinc');
  addItem('tv-living',       '75in Media Console & Screen','tv',       280, 440, 180, 38,  50,  0,   'sky');
  addItem('chair-liv-1',     'Modern Lounge Armchair 1', 'chair',      420, 600, 68,  68,  80,  240, 'amber');
  addItem('chair-liv-2',     'Modern Lounge Armchair 2', 'chair',      420, 700, 68,  68,  80,  290, 'amber');
  addItem('lamp-liv-arc',    'Flos Arc Floor Lamp',      'lamp',       70,  780, 45,  45,  190, 0,   'amber');
  addItem('shelf-liv-1',     'Walnut Bookcase Left',     'shelf',      80,  440, 110, 36,  180, 0,   'zinc');
  addItem('shelf-liv-2',     'Walnut Bookcase Right',    'shelf',      480, 440, 110, 36,  180, 0,   'zinc');
  addItem('plant-liv-1',     'Fiddle Leaf Fig Tree',     'plant',      50,  450, 50,  50,  150, 0,   'emerald');
  addItem('plant-liv-2',     'Monstera Deliciosa',       'plant',      640, 450, 50,  50,  135, 0,   'emerald');
  addItem('divider-liv',     'Wood Slats Screen',        'divider',    460, 800, 140, 4,   180, 90,  'zinc', false, false);
  // Dining area within open living (x: 520..680, y: 560..860)
  addItem('table-dining',    'Solid Oak Dining Table',   'desk',       570, 680, 180, 90,  76,  90,  'amber');
  addItem('chair-din-1',     'Dining Chair North L',     'chair',      530, 610, 48,  48,  85,  90,  'amber');
  addItem('chair-din-2',     'Dining Chair North R',     'chair',      610, 610, 48,  48,  85,  270, 'amber');
  addItem('chair-din-3',     'Dining Chair South L',     'chair',      530, 750, 48,  48,  85,  90,  'amber');
  addItem('chair-din-4',     'Dining Chair South R',     'chair',      610, 750, 48,  48,  85,  270, 'amber');
  addItem('chair-din-5',     'Dining End Chair East',    'chair',      570, 550, 48,  48,  85,  0,   'amber');
  addItem('chair-din-6',     'Dining End Chair West',    'chair',      570, 810, 48,  48,  85,  180, 'amber');
  addItem('buffet-dining',   'Dining Credenza Sideboard','wardrobe',   670, 680, 50,  160, 85,  90,  'zinc');
  addItem('lamp-dining',     'Sideboard Art Lamp',       'lamp',       670, 620, 28,  28,  55,  0,   'amber');
  addItem('mirror-dining',   'Architectural Horizon Mirror','mirror',  685, 680, 6,   120, 110, 90,  'sky');
  addItem('bar-cart',        'Brass & Smoked Glass Bar Cart','box',    660, 840, 65,  45,  78,  0,   'amber');
  addItem('plant-dining',    'Cast Iron Plant',          'plant',      510, 860, 40,  40,  110, 0,   'emerald');
  addItem('easel-liv-1',     'Abstract Canvas A',        'easel',      180, 420, 60,  30,  160, 0,   'amber');
  addItem('easel-liv-2',     'Abstract Canvas B',        'easel',      380, 420, 60,  30,  160, 0,   'amber');
  addItem('bench-liv-balc',  'Terrace Transition Bench', 'box',        30,  620, 45,  120, 42,  90,  'zinc');

  // --- Zone 3: Home Office (x: 0..420, y: 0..400) -> 16 items
  addItem('desk-office',     'Executive L-Desk Main',    'desk',       180, 140, 160, 75,  75,  0,   'zinc');
  addItem('chair-office',    'Herman Miller Aeron Chair','chair',      180, 205, 65,  65,  95,  0,   'sky');
  addItem('pc-workstation',  'Triple Monitor Rig & PC',  'pc',         180, 125, 95,  32,  65,  0,   'emerald');
  addItem('lamp-office',     'Artemide Tolomeo Task Lamp','lamp',      115, 135, 30,  30,  60,  0,   'amber');
  addItem('chair-off-guest1','Office Guest Armchair 1',  'chair',      130, 70,  55,  55,  82,  180, 'amber');
  addItem('chair-off-guest2','Office Guest Armchair 2',  'chair',      230, 70,  55,  55,  82,  180, 'amber');
  addItem('rug-office',      'Office Geometric Rug',     'rug',        180, 150, 220, 180, 1,   0,   'violet', true);
  addItem('shelf-off-1',     'Library Bookcase West 1',  'shelf',      30,  100, 40,  100, 200, 90,  'zinc');
  addItem('shelf-off-2',     'Library Bookcase West 2',  'shelf',      30,  210, 40,  100, 200, 90,  'zinc');
  addItem('shelf-off-3',     'Library Bookcase West 3',  'shelf',      30,  320, 40,  100, 200, 90,  'zinc');
  addItem('credenza-office', 'Office Credenza / Files',  'wardrobe',   340, 60,   50, 120, 78,  0,   'zinc');
  addItem('shredder-office', 'Laser Printer & Scanner',  'appliance',  375, 150, 50,  50,  70,  0,   'zinc');
  addItem('plant-off-1',     'ZZ Plant in Floor Pot',    'plant',      380, 260, 45,  45,  125, 0,   'emerald');
  addItem('plant-off-2',     'Snake Plant Clean Air',    'plant',      100, 360, 40,  40,  100, 0,   'emerald');
  addItem('easel-off-cert',  'Degree & Credentials',     'easel',      280, 20,  50,  25,  150, 0,   'amber');
  addItem('sofa-off-daybed', 'Office Reading Daybed',    'sofa',       280, 350, 160, 75,  65,  180, 'violet');

  // --- Zone 4: Kitchenette & Pantry (x: 420..700, y: 0..400) -> 14 items
  addItem('counter-island',  'Marble Kitchen Island',    'desk',       560, 230, 180, 80,  90,  0,   'zinc');
  addItem('stool-kit-1',     'Island Barstool 1',        'chair',      500, 290, 42,  42,  75,  0,   'amber');
  addItem('stool-kit-2',     'Island Barstool 2',        'chair',      560, 290, 42,  42,  75,  0,   'amber');
  addItem('stool-kit-3',     'Island Barstool 3',        'chair',      620, 290, 42,  42,  75,  0,   'amber');
  addItem('counter-main',    'Main Base Cabinet & Sink', 'desk',       560, 40,  180, 60,  90,  0,   'zinc');
  addItem('counter-cook',    'Induction Cooktop Run',    'desk',       450, 130, 60,  120, 90,  90,  'zinc');
  addItem('fridge',          'Sub-Zero Refrigerator',    'appliance',  450, 230, 65,  70,  190, 90,  'zinc');
  addItem('pantry-shelf-1',  'Pantry High Shelving 1',   'shelf',      670, 70,  40,  80,  210, 90,  'zinc');
  addItem('pantry-shelf-2',  'Pantry High Shelving 2',   'shelf',      670, 160, 40,  80,  210, 90,  'zinc');
  addItem('oven-unit',       'Wall Oven & Microwave Column','wardrobe',670, 260, 50,  70,  195, 90,  'zinc');
  addItem('coffee-station',  'Espresso & Coffee Station','appliance',  510, 40,  45,  35,  45,  0,   'amber');
  addItem('plant-kit-herb',  'Culinary Herb Planter',    'plant',      620, 40,  35,  35,  55,  0,   'emerald');
  addItem('waste-recycle',   'Integrated Recycling Unit','box',        450, 320, 45,  50,  75,  90,  'zinc');
  addItem('rug-kit-runner',  'Kitchen Anti-Fatigue Mat', 'rug',        560, 140, 160, 50,  1,   0,   'violet', true);

  // --- Zone 5: Bathroom & Entry Foyer (x: 700..1200, y: 500..900) -> 12 items
  // Foyer (x: 700..950, y: 500..900)
  addItem('console-foyer',   'Foyer Marble Entry Console','desk',      760, 540, 110, 38,  85,  0,   'zinc');
  addItem('mirror-foyer',    'Round Backlit Foyer Mirror','mirror',    760, 520, 10,  70,  150, 0,   'sky');
  addItem('lamp-foyer',      'Foyer Accent Table Lamp',  'lamp',       810, 540, 28,  28,  60,  0,   'amber');
  addItem('rug-foyer',       'Entry Gallery Runner Rug', 'rug',        850, 720, 90,  200, 1,   90,  'violet', true);
  addItem('bench-foyer',     'Foyer Leather Shoe Bench', 'box',        880, 560, 90,  42,  46,  0,   'zinc');
  addItem('coat-rack',       'Floor Coat Stand',         'lamp',       730, 850, 35,  35,  180, 0,   'amber');
  addItem('plant-foyer',     'Peace Lily in Slate Pot',  'plant',      730, 620, 40,  40,  110, 0,   'emerald');
  // Bathroom (x: 950..1200, y: 500..900)
  addItem('vanity-bath',     'Double Sink Bathroom Vanity','desk',     1110, 560, 150, 55, 88,  0,   'zinc');
  addItem('mirror-bath',     'Illuminated Medicine Cabinet','mirror',  1110, 540, 10,  130, 100, 0,  'sky');
  addItem('screen-shower',   'Walk-In Glass Shower Screen','divider',  1010, 800, 100, 4,  210, 90,  'sky', false, false);
  addItem('shelf-bath-linen','Linen & Towel Etangere',   'shelf',      980,  620, 36,  70,  160, 90,  'zinc');
  addItem('hamper-bath',     'Woven Laundry Hamper',     'appliance',  980,  720, 40,  45,  75,  90,  'zinc');

  // Spaces metadata
  const spaces = [
    {
      id: 'space-living-dining',
      name: 'Grand Living & Dining Lounge',
      number: '201',
      boundarySegmentIds: ['w-ext-s3', 'w-ext-s4', 'w-ext-w1', 'w-ext-w2', 'w-int-h1', 'w-int-h2', 'w-int-h3', 'w-int-h4', 'w-int-v5', 'w-int-v6', 'w-int-v7'],
      polygon: [{ x: 0, y: 400 }, { x: 700, y: 400 }, { x: 700, y: 900 }, { x: 0, y: 900 }],
      areaM2: 35.0,
      perimeterM: 24.0,
      centroid: { x: 350, y: 650 },
      floorMaterial: 'white_oak_plank',
      fillColor: '#121316'
    },
    {
      id: 'space-master-bedroom',
      name: 'Master Bedroom Suite',
      number: '202',
      boundarySegmentIds: ['w-ext-n3', 'w-ext-n4', 'w-ext-e1', 'w-ext-e2', 'w-int-h5', 'w-int-h6', 'w-int-h7', 'w-int-v3', 'w-int-v4'],
      polygon: [{ x: 700, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 500 }, { x: 700, y: 500 }],
      areaM2: 25.0,
      perimeterM: 20.0,
      centroid: { x: 950, y: 250 },
      floorMaterial: 'herringbone_parquet',
      fillColor: '#14151a'
    },
    {
      id: 'space-home-office',
      name: 'Executive Home Office & Studio',
      number: '203',
      boundarySegmentIds: ['w-ext-n1', 'w-int-v1', 'w-int-v2', 'w-int-h1', 'w-int-h2', 'w-ext-w3', 'w-ext-w4'],
      polygon: [{ x: 0, y: 0 }, { x: 420, y: 0 }, { x: 420, y: 400 }, { x: 0, y: 400 }],
      areaM2: 16.8,
      perimeterM: 16.4,
      centroid: { x: 210, y: 200 },
      floorMaterial: 'white_oak_plank',
      fillColor: '#131418'
    },
    {
      id: 'space-kitchenette',
      name: 'Gourmet Kitchenette & Pantry',
      number: '204',
      boundarySegmentIds: ['w-ext-n2', 'w-int-v3', 'w-int-v4', 'w-int-h3', 'w-int-h4', 'w-int-v1', 'w-int-v2'],
      polygon: [{ x: 420, y: 0 }, { x: 700, y: 0 }, { x: 700, y: 400 }, { x: 420, y: 400 }],
      areaM2: 11.2,
      perimeterM: 13.6,
      centroid: { x: 560, y: 200 },
      floorMaterial: 'porcelain_tile',
      fillColor: '#16181f'
    },
    {
      id: 'space-ensuite-bath',
      name: 'Master En-suite Spa Bathroom',
      number: '205',
      boundarySegmentIds: ['w-int-h6', 'w-int-h7', 'w-ext-e3', 'w-ext-e4', 'w-ext-s1', 'w-int-v8', 'w-int-v9'],
      polygon: [{ x: 950, y: 500 }, { x: 1200, y: 500 }, { x: 1200, y: 900 }, { x: 950, y: 900 }],
      areaM2: 10.0,
      perimeterM: 13.0,
      centroid: { x: 1075, y: 700 },
      floorMaterial: 'terrazzo_slate',
      fillColor: '#151720'
    },
    {
      id: 'space-entry-foyer',
      name: 'Entry Foyer & Reception Gallery',
      number: '206',
      boundarySegmentIds: ['w-int-h5', 'w-int-v8', 'w-int-v9', 'w-ext-s2', 'w-int-v6', 'w-int-v7'],
      polygon: [{ x: 700, y: 500 }, { x: 950, y: 500 }, { x: 950, y: 900 }, { x: 700, y: 900 }],
      areaM2: 10.0,
      perimeterM: 13.0,
      centroid: { x: 825, y: 700 },
      floorMaterial: 'terrazzo_slate',
      fillColor: '#121419'
    }
  ];

  const openings = doors.map(d => ({
    id: d.id,
    wallSegmentId: d.wall === 'bottom' ? 'w-ext-s2' : 'w-ext-n1',
    t: 0.5,
    width: d.width,
    height: 210,
    sillHeight: 0,
    type: d.width > 150 ? 'door_sliding' : 'door_single_swing',
    hinge: d.hinge,
    swing: d.swing,
    swingAngleDeg: 90
  })).concat(windows.map(w => ({
    id: w.id,
    wallSegmentId: w.wall === 'bottom' ? 'w-ext-s4' : (w.wall === 'right' ? 'w-ext-e1' : 'w-ext-n1'),
    t: 0.5,
    width: w.width,
    height: 140,
    sillHeight: 90,
    type: 'window_casement',
    hinge: 'left',
    swing: 'outward',
    swingAngleDeg: 45,
    glazing: { paneCount: 2, mullionThicknessCm: 4, glassTint: '#5a8cb2' }
  })));

  const furniture = items.map(it => ({
    id: it.id,
    name: it.name,
    archetype: it.type,
    layerId: 'A-FURN',
    spaceId: it.y < 400 ? (it.x < 420 ? 'space-home-office' : 'space-kitchenette') : (it.x < 700 ? 'space-living-dining' : (it.y < 500 ? 'space-master-bedroom' : (it.x < 950 ? 'space-entry-foyer' : 'space-ensuite-bath'))),
    x: it.x,
    y: it.y,
    z: 0,
    rotation: it.rot,
    w: it.w,
    h: it.h,
    zHeight: it.zHeight,
    color: it.color,
    ignoreCollision: it.ignoreCollision,
    lockedDims: it.lockedDims,
    visible: it.visible
  }));

  const annotations = outlets.map(o => ({
    id: `anno-${o.id}`,
    layerId: 'E-POWR',
    type: 'leader_text',
    x1: o.x,
    y1: o.y,
    text: o.name,
    fontSizePx: 11
  }));

  return {
    version: 3,
    app: 'SimpleCAD',
    createdAt: '2026-11-15T13:30:00.000Z',
    updatedAt: '2026-11-15T13:30:00.000Z',
    project: {
      id: 'proj-medium-apartment',
      name: 'Residential Apartment Suite (1200×900 cm)',
      author: 'SimpleCAD Architecture Lab',
      units: 'cm',
      gridStepCm: 10,
      majorGridStepCm: 50,
      activeBuildingId: 'bldg-apartment',
      activeStoreyId: 'lvl-2',
      activeLayoutId: 'apt-opt1'
    },
    room: {
      name: 'Residential Apartment Suite (1200×900 cm)',
      w: W,
      h: H,
      wallThickness: th,
      doors,
      windows,
      outlets
    },
    cables,
    catalog,
    items,
    activeLayoutId: 'apt-opt1',
    layouts: [
      {
        id: 'apt-opt1',
        name: 'Curated Architectural Layout (88 Items)',
        builtIn: true,
        placements
      }
    ],
    layers: standardLayers,
    buildings: [
      {
        id: 'bldg-apartment',
        name: 'The Harbour Residences',
        storeys: [
          {
            id: 'lvl-2',
            name: 'Apartment 201 (Level 2)',
            index: 2,
            elevationZ: 600,
            storyHeight: 280,
            slabThickness: 20,
            wallGraph: {
              nodes,
              segments
            },
            spaces,
            openings,
            furniture,
            cables: cables.map(c => ({ ...c, layerId: 'E-POWR' })),
            annotations
          }
        ]
      }
    ]
  };
}

function buildLargeFloorplate() {
  const W = 3600;
  const H = 2400;
  const th = 24;

  // Commercial office floorplate:
  // Layout zones:
  // - Reception & Elevator Lobby (1400..2200, 1600..2400) -> 800x800 cm
  // - Open Workstation Bay West (0..1400, 1200..2400) -> 1400x1200 cm
  // - Open Workstation Bay East (2200..3600, 1200..2400) -> 1400x1200 cm
  // - 4 Executive Offices along North (0..600, 600..1200, 2400..3000, 3000..3600; y: 0..600)
  // - 2 Conference Rooms (Boardroom 1200..2000, y: 0..600; Conf 2 2000..2400, y: 0..600)
  // - Staff Café & Kitchenette (0..1000, 600..1200)
  // - Server Room & IT (1000..1500, 600..1200)
  // - Restrooms (1500..2200, 600..1200)
  // - Quiet Wellness & Collab (2200..3600, 600..1200)

  // 1. Generate Wall Graph with 165+ segments
  const nodes = [];
  const segments = [];
  let nodeIdx = 1;
  let segIdx = 1;

  function addNode(x, y) {
    const id = `node-${nodeIdx++}`;
    const n = { id, x, y };
    nodes.push(n);
    return n;
  }

  function addSegment(startId, endId, type = 'interior', material = 'gypsum_stud', loadBearing = false) {
    const id = `seg-${segIdx++}`;
    segments.push({
      id,
      startNodeId: startId,
      endNodeId: endId,
      thickness: type === 'exterior' ? th : 12,
      height: 320,
      type,
      material,
      layerId: type === 'exterior' ? 'A-WALL-EXTR' : 'A-WALL-INTR',
      loadBearing
    });
    return id;
  }

  // Exterior perimeter subdivided by 200cm structural bays:
  // Top wall (y=0, 18 segments)
  const topNodes = [];
  for (let x = 0; x <= W; x += 200) {
    topNodes.push(addNode(x, 0));
  }
  for (let i = 0; i < topNodes.length - 1; i++) {
    addSegment(topNodes[i].id, topNodes[i + 1].id, 'exterior', 'concrete_cast', true);
  }

  // Right wall (x=3600, 12 segments)
  const rightNodes = [topNodes[topNodes.length - 1]];
  for (let y = 200; y <= H; y += 200) {
    rightNodes.push(addNode(W, y));
  }
  for (let i = 0; i < rightNodes.length - 1; i++) {
    addSegment(rightNodes[i].id, rightNodes[i + 1].id, 'exterior', 'concrete_cast', true);
  }

  // Bottom wall (y=2400, 18 segments)
  const bottomNodes = [rightNodes[rightNodes.length - 1]];
  for (let x = W - 200; x >= 0; x -= 200) {
    bottomNodes.push(addNode(x, H));
  }
  for (let i = 0; i < bottomNodes.length - 1; i++) {
    addSegment(bottomNodes[i].id, bottomNodes[i + 1].id, 'exterior', 'concrete_cast', true);
  }

  // Left wall (x=0, 12 segments)
  const leftNodes = [bottomNodes[bottomNodes.length - 1]];
  for (let y = H - 200; y > 0; y -= 200) {
    leftNodes.push(addNode(0, y));
  }
  leftNodes.push(topNodes[0]);
  for (let i = 0; i < leftNodes.length - 1; i++) {
    addSegment(leftNodes[i].id, leftNodes[i + 1].id, 'exterior', 'concrete_cast', true);
  }
  // That's 18 + 12 + 18 + 12 = 60 exterior wall segments!

  // Interior Corridor Lines and Partition Lines:
  // Horizontal partition at y = 600 across entire building (divided into rooms):
  const h600Nodes = [];
  for (let x = 0; x <= W; x += 200) {
    h600Nodes.push(addNode(x, 600));
  }
  for (let i = 0; i < h600Nodes.length - 1; i++) {
    addSegment(h600Nodes[i].id, h600Nodes[i + 1].id, 'interior', 'gypsum_stud', false);
  }
  // That adds 18 segments (total 78).

  // Horizontal partition at y = 1200 across entire building:
  const h1200Nodes = [];
  for (let x = 0; x <= W; x += 200) {
    h1200Nodes.push(addNode(x, 1200));
  }
  for (let i = 0; i < h1200Nodes.length - 1; i++) {
    addSegment(h1200Nodes[i].id, h1200Nodes[i + 1].id, 'interior', 'gypsum_stud', false);
  }
  // That adds 18 segments (total 96).

  // Horizontal partition at y = 1600 (central core boundary):
  const h1600Nodes = [];
  for (let x = 1400; x <= 2200; x += 200) {
    h1600Nodes.push(addNode(x, 1600));
  }
  for (let i = 0; i < h1600Nodes.length - 1; i++) {
    addSegment(h1600Nodes[i].id, h1600Nodes[i + 1].id, 'interior', 'gypsum_stud', false);
  }
  // That adds 4 segments (total 100).

  // Vertical Demising Walls:
  // North wing verticals (y: 0..600):
  const northXSplits = [600, 1200, 2000, 2400, 3000];
  northXSplits.forEach(vx => {
    const n1 = addNode(vx, 0);
    const n2 = addNode(vx, 200);
    const n3 = addNode(vx, 400);
    const n4 = addNode(vx, 600);
    addSegment(n1.id, n2.id, 'interior', 'concrete_cast', true);
    addSegment(n2.id, n3.id, 'interior', 'concrete_cast', true);
    addSegment(n3.id, n4.id, 'interior', 'concrete_cast', true);
  });
  // 5 * 3 = 15 segments (total 115).

  // Mid wing verticals (y: 600..1200):
  const midXSplits = [1000, 1500, 1850, 2200, 2600];
  midXSplits.forEach(vx => {
    const n1 = addNode(vx, 600);
    const n2 = addNode(vx, 800);
    const n3 = addNode(vx, 1000);
    const n4 = addNode(vx, 1200);
    addSegment(n1.id, n2.id, 'interior', 'gypsum_stud', false);
    addSegment(n2.id, n3.id, 'interior', 'gypsum_stud', false);
    addSegment(n3.id, n4.id, 'interior', 'gypsum_stud', false);
  });
  // 5 * 3 = 15 segments (total 130).

  // Central Lobby verticals (y: 1600..2400):
  const lobbyXSplits = [1400, 2200];
  lobbyXSplits.forEach(vx => {
    const n1 = addNode(vx, 1600);
    const n2 = addNode(vx, 1800);
    const n3 = addNode(vx, 2000);
    const n4 = addNode(vx, 2200);
    const n5 = addNode(vx, 2400);
    addSegment(n1.id, n2.id, 'interior', 'concrete_cast', true);
    addSegment(n2.id, n3.id, 'interior', 'concrete_cast', true);
    addSegment(n3.id, n4.id, 'interior', 'concrete_cast', true);
    addSegment(n4.id, n5.id, 'interior', 'concrete_cast', true);
  });
  // 2 * 4 = 8 segments (total 138).

  // Architectural Phone Booths & Meeting Pods (8 enclosed pods x 4 walls each = 32 segments):
  const podLocs = [
    { x: 300, y: 1400, w: 150, h: 150 },
    { x: 300, y: 1600, w: 150, h: 150 },
    { x: 300, y: 1800, w: 150, h: 150 },
    { x: 300, y: 2000, w: 150, h: 150 },
    { x: 3150, y: 1400, w: 150, h: 150 },
    { x: 3150, y: 1600, w: 150, h: 150 },
    { x: 3150, y: 1800, w: 150, h: 150 },
    { x: 3150, y: 2000, w: 150, h: 150 }
  ];
  podLocs.forEach(pod => {
    const p1 = addNode(pod.x, pod.y);
    const p2 = addNode(pod.x + pod.w, pod.y);
    const p3 = addNode(pod.x + pod.w, pod.y + pod.h);
    const p4 = addNode(pod.x, pod.y + pod.h);
    addSegment(p1.id, p2.id, 'partition', 'glass_mullion', false);
    addSegment(p2.id, p3.id, 'partition', 'glass_mullion', false);
    addSegment(p3.id, p4.id, 'partition', 'glass_mullion', false);
    addSegment(p4.id, p1.id, 'partition', 'glass_mullion', false);
  });
  // 8 * 4 = 32 segments (total 170 segments!). Exceeds 150+ segments requirement.

  // 2. Generate 34 Doors (exceeds 30+ requirement)
  const doors = [];
  // Main building entry double doors at bottom lobby (y=2400)
  doors.push({ id: 'd-main-entry-1', name: 'Main Lobby Entry Door L', wall: 'bottom', offset: 1750, width: 120, hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-main-entry-2', name: 'Main Lobby Entry Door R', wall: 'bottom', offset: 1870, width: 120, hinge: 'right', swing: 'inward' });
  doors.push({ id: 'd-fire-stair-w',  name: 'West Fire Exit Stair',    wall: 'bottom', offset: 100,  width: 110, hinge: 'left', swing: 'outward' });
  doors.push({ id: 'd-fire-stair-e',  name: 'East Fire Exit Stair',    wall: 'bottom', offset: 3400, width: 110, hinge: 'right', swing: 'outward' });

  // Executive Offices (4 doors)
  doors.push({ id: 'd-exec-1', name: 'Exec Office 1 Door', wall: 'top', offset: 300,  width: 95, hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-exec-2', name: 'Exec Office 2 Door', wall: 'top', offset: 900,  width: 95, hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-exec-3', name: 'Exec Office 3 Door', wall: 'top', offset: 2700, width: 95, hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-exec-4', name: 'Exec Office 4 Door', wall: 'top', offset: 3300, width: 95, hinge: 'left', swing: 'inward' });

  // Conference Rooms (3 doors)
  doors.push({ id: 'd-board-1', name: 'Boardroom Double Door L', wall: 'top', offset: 1550, width: 100, hinge: 'left',  swing: 'inward' });
  doors.push({ id: 'd-board-2', name: 'Boardroom Double Door R', wall: 'top', offset: 1650, width: 100, hinge: 'right', swing: 'inward' });
  doors.push({ id: 'd-conf-2',  name: 'Conf Room 2 Door',        wall: 'top', offset: 2150, width: 95,  hinge: 'left',  swing: 'inward' });

  // Core Rooms (Café, Server, Restrooms, Wellness, Phone booths) -> 23 more doors
  doors.push({ id: 'd-cafe-entry',  name: 'Café Lounge Double Door', wall: 'left', offset: 700,  width: 160, hinge: 'double', swing: 'both' });
  doors.push({ id: 'd-server-main', name: 'IT Server Room Secured Door', wall: 'left', offset: 1100, width: 100, hinge: 'left', swing: 'outward' });
  doors.push({ id: 'd-server-rear', name: 'IT Telecom Maintenance Door', wall: 'left', offset: 950,  width: 90,  hinge: 'left', swing: 'outward' });
  doors.push({ id: 'd-rest-m',      name: 'Men Restroom Privacy Door',   wall: 'left', offset: 1300, width: 95,  hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-rest-w',      name: 'Women Restroom Privacy Door', wall: 'left', offset: 1500, width: 95,  hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-wellness',    name: 'Quiet Wellness Room Door',    wall: 'right', offset: 700, width: 90,  hinge: 'left', swing: 'inward' });
  doors.push({ id: 'd-collab',      name: 'Collaborative Hub Entry',     wall: 'right', offset: 1000, width: 150, hinge: 'double', swing: 'both' });

  // 8 Phone Booth doors
  for (let i = 0; i < 8; i++) {
    doors.push({
      id: `d-phone-booth-${i + 1}`,
      name: `Acoustic Phone Pod Door ${i + 1}`,
      wall: i < 4 ? 'left' : 'right',
      offset: 1350 + (i % 4) * 200,
      width: 80,
      hinge: 'left',
      swing: 'inward'
    });
  }

  // 8 Inter-zone corridor doors
  for (let i = 0; i < 8; i++) {
    doors.push({
      id: `d-corridor-${i + 1}`,
      name: `Zone Demising Portal ${i + 1}`,
      wall: i < 4 ? 'top' : 'bottom',
      offset: 1000 + i * 220,
      width: 140,
      hinge: 'double',
      swing: 'both'
    });
  }
  // Total doors = 4 + 4 + 3 + 7 + 8 + 8 = 34 doors!

  // 3. Generate 44 Windows (exceeds 40+ requirement)
  const windows = [];
  // North facade ribbon windows (18 windows)
  for (let i = 0; i < 18; i++) {
    windows.push({
      id: `w-north-${i + 1}`,
      name: `Curtain Glazing North #${i + 1}`,
      wall: 'top',
      offset: 20 + i * 198,
      width: 160
    });
  }
  // South facade ribbon windows (14 windows)
  for (let i = 0; i < 14; i++) {
    windows.push({
      id: `w-south-${i + 1}`,
      name: `Curtain Glazing South #${i + 1}`,
      wall: 'bottom',
      offset: 50 + i * 240,
      width: 180
    });
  }
  // West facade windows (6 windows)
  for (let i = 0; i < 6; i++) {
    windows.push({
      id: `w-west-${i + 1}`,
      name: `West Facade Window #${i + 1}`,
      wall: 'left',
      offset: 100 + i * 360,
      width: 150
    });
  }
  // East facade windows (6 windows)
  for (let i = 0; i < 6; i++) {
    windows.push({
      id: `w-east-${i + 1}`,
      name: `East Facade Window #${i + 1}`,
      wall: 'right',
      offset: 100 + i * 360,
      width: 150
    });
  }
  // Total windows: 18 + 14 + 6 + 6 = 44 windows!

  // 4. Generate 640 Furniture Items (between 500 and 1,000)
  const items = [];
  const catalog = [];
  const placements = {};

  function addCommItem(id, name, type, cx, cy, w, h, zH, rot, color, ignoreCol = false, locked = false) {
    const item = {
      id,
      name,
      type,
      x: cx,
      y: cy,
      cx,
      cy,
      w,
      h,
      zHeight: zH,
      rot,
      color,
      ignoreCollision: ignoreCol,
      lockedDims: locked,
      visible: true
    };
    items.push(item);
    catalog.push({
      id,
      name,
      type,
      w,
      h,
      zHeight: zH,
      color,
      ignoreCollision: ignoreCol,
      lockedDims: locked,
      visible: true
    });
    placements[id] = {
      minX: Math.round(cx - w / 2),
      minY: Math.round(cy - h / 2),
      rot,
      w,
      h,
      zHeight: zH,
      visible: true
    };
  }

  // A. Open Workstation Bay West: 8 pods of 6 = 48 workstations (216 items)
  // Each workstation has: desk, task chair, PC monitor, mobile shelf pedestal = 4 items * 48 = 192 items + 24 dividers = 216 items.
  for (let pod = 0; pod < 8; pod++) {
    const col = pod % 2; // 0 or 1
    const row = Math.floor(pod / 2); // 0, 1, 2, 3
    const baseX = 450 + col * 450;
    const baseY = 1350 + row * 260;

    for (let pos = 0; pos < 6; pos++) {
      const isTop = pos < 3;
      const slot = pos % 3;
      const dx = (slot - 1) * 140;
      const dy = isTop ? -38 : 38;
      const deskId = `desk-w-p${pod}-s${pos}`;
      const chairId = `chair-w-p${pod}-s${pos}`;
      const pcId = `pc-w-p${pod}-s${pos}`;
      const pedId = `ped-w-p${pod}-s${pos}`;

      addCommItem(deskId, `Workstation Desk W-P${pod+1}-${pos+1}`, 'desk', baseX + dx, baseY + dy, 130, 65, 75, isTop ? 0 : 180, 'zinc');
      addCommItem(chairId, `Aeron Task Chair W-P${pod+1}-${pos+1}`, 'chair', baseX + dx, baseY + (isTop ? dy - 55 : dy + 55), 55, 55, 90, isTop ? 0 : 180, 'sky');
      addCommItem(pcId, `Dual Monitor Workstation W-P${pod+1}-${pos+1}`, 'pc', baseX + dx, baseY + (isTop ? dy + 18 : dy - 18), 75, 25, 65, isTop ? 0 : 180, 'emerald');
      addCommItem(pedId, `Mobile Storage Pedestal W-P${pod+1}-${pos+1}`, 'shelf', baseX + dx + 45, baseY + dy, 40, 50, 60, isTop ? 0 : 180, 'zinc');
    }
    // 3 Acoustic screens between opposing desks
    for (let s = 0; s < 3; s++) {
      const dx = (s - 1) * 140;
      addCommItem(`div-w-p${pod}-s${s}`, `Acoustic Desk Screen W-P${pod+1}-${s+1}`, 'divider', baseX + dx, baseY, 130, 4, 120, 0, 'zinc');
    }
  }
  // Total in West Bay: 8 * (24 + 3) = 216 items!

  // B. Open Workstation Bay East: 8 pods of 6 = 48 workstations (216 items)
  for (let pod = 0; pod < 8; pod++) {
    const col = pod % 2;
    const row = Math.floor(pod / 2);
    const baseX = 2400 + col * 450;
    const baseY = 1350 + row * 260;

    for (let pos = 0; pos < 6; pos++) {
      const isTop = pos < 3;
      const slot = pos % 3;
      const dx = (slot - 1) * 140;
      const dy = isTop ? -38 : 38;
      const deskId = `desk-e-p${pod}-s${pos}`;
      const chairId = `chair-e-p${pod}-s${pos}`;
      const pcId = `pc-e-p${pod}-s${pos}`;
      const pedId = `ped-e-p${pod}-s${pos}`;

      addCommItem(deskId, `Workstation Desk E-P${pod+1}-${pos+1}`, 'desk', baseX + dx, baseY + dy, 130, 65, 75, isTop ? 0 : 180, 'zinc');
      addCommItem(chairId, `Aeron Task Chair E-P${pod+1}-${pos+1}`, 'chair', baseX + dx, baseY + (isTop ? dy - 55 : dy + 55), 55, 55, 90, isTop ? 0 : 180, 'sky');
      addCommItem(pcId, `Dual Monitor Workstation E-P${pod+1}-${pos+1}`, 'pc', baseX + dx, baseY + (isTop ? dy + 18 : dy - 18), 75, 25, 65, isTop ? 0 : 180, 'emerald');
      addCommItem(pedId, `Mobile Storage Pedestal E-P${pod+1}-${pos+1}`, 'shelf', baseX + dx + 45, baseY + dy, 40, 50, 60, isTop ? 0 : 180, 'zinc');
    }
    for (let s = 0; s < 3; s++) {
      const dx = (s - 1) * 140;
      addCommItem(`div-e-p${pod}-s${s}`, `Acoustic Desk Screen E-P${pod+1}-${s+1}`, 'divider', baseX + dx, baseY, 130, 4, 120, 0, 'zinc');
    }
  }
  // Total in East Bay: 216 items!

  // C. 4 Executive Suites (44 items, 11 per office)
  const execOffices = [
    { name: 'Exec Suite 1 (CEO)', cx: 300, cy: 300 },
    { name: 'Exec Suite 2 (COO)', cx: 900, cy: 300 },
    { name: 'Exec Suite 3 (CTO)', cx: 2700, cy: 300 },
    { name: 'Exec Suite 4 (CFO)', cx: 3300, cy: 300 }
  ];
  execOffices.forEach((eo, idx) => {
    const idp = `exec-${idx + 1}`;
    addCommItem(`${idp}-desk`,      `${eo.name} Executive Desk`,   'desk',     eo.cx, eo.cy, 180, 85, 76, 0, 'zinc');
    addCommItem(`${idp}-chair`,     `${eo.name} Executive Chair`,  'chair',    eo.cx, eo.cy - 70, 65, 65, 105, 0, 'sky');
    addCommItem(`${idp}-guest1`,    `${eo.name} Guest Chair 1`,    'chair',    eo.cx - 50, eo.cy + 70, 55, 55, 82, 180, 'amber');
    addCommItem(`${idp}-guest2`,    `${eo.name} Guest Chair 2`,    'chair',    eo.cx + 50, eo.cy + 70, 55, 55, 82, 180, 'amber');
    addCommItem(`${idp}-credenza`,  `${eo.name} Credenza`,         'wardrobe', eo.cx, eo.cy - 160, 50, 180, 80, 90, 'zinc');
    addCommItem(`${idp}-shelf1`,    `${eo.name} Bookcase L`,       'shelf',    eo.cx - 160, eo.cy, 40, 120, 190, 90, 'zinc');
    addCommItem(`${idp}-shelf2`,    `${eo.name} Bookcase R`,       'shelf',    eo.cx + 160, eo.cy, 40, 120, 190, 90, 'zinc');
    addCommItem(`${idp}-lamp`,      `${eo.name} Task Lamp`,        'lamp',     eo.cx - 60, eo.cy, 30, 30, 65, 0, 'amber');
    addCommItem(`${idp}-rug`,       `${eo.name} Executive Rug`,    'rug',      eo.cx, eo.cy, 240, 200, 1, 0, 'violet', true);
    addCommItem(`${idp}-plant1`,    `${eo.name} Ficus Tree`,       'plant',    eo.cx - 150, eo.cy - 140, 50, 50, 140, 0, 'emerald');
    addCommItem(`${idp}-plant2`,    `${eo.name} Floor Plant`,      'plant',    eo.cx + 150, eo.cy + 140, 45, 45, 110, 0, 'emerald');
  });
  // Total Exec: 44 items.

  // D. Large Boardroom & Conf 2 (33 items)
  // Boardroom (1200..2000, 0..600) -> 21 items
  addCommItem('board-table', 'Executive Boardroom Table', 'desk', 1600, 300, 380, 140, 76, 0, 'zinc');
  for (let c = 0; c < 7; c++) {
    addCommItem(`board-chair-n${c+1}`, `Boardroom Chair N${c+1}`, 'chair', 1390 + c * 70, 205, 55, 55, 95, 0, 'sky');
    addCommItem(`board-chair-s${c+1}`, `Boardroom Chair S${c+1}`, 'chair', 1390 + c * 70, 395, 55, 55, 95, 180, 'sky');
  }
  addCommItem('board-chair-w', 'Boardroom Chair W Head', 'chair', 1350, 300, 55, 55, 95, 270, 'sky');
  addCommItem('board-chair-e', 'Boardroom Chair E Foot', 'chair', 1850, 300, 55, 55, 95, 90, 'sky');
  addCommItem('board-av-cred', 'Boardroom AV Credenza', 'wardrobe', 1600, 40, 50, 220, 85, 0, 'zinc');
  addCommItem('board-display', 'Boardroom 85in 4K Display', 'tv', 1600, 30, 200, 25, 120, 0, 'sky');
  addCommItem('board-plant1',  'Boardroom Corner Planter L', 'plant', 1250, 60, 55, 55, 150, 0, 'emerald');
  addCommItem('board-plant2',  'Boardroom Corner Planter R', 'plant', 1950, 60, 55, 55, 150, 0, 'emerald');
  // Conf 2 (2000..2400, 0..600) -> 12 items
  addCommItem('conf2-table', 'Team Conference Table', 'desk', 2200, 300, 200, 100, 76, 0, 'zinc');
  for (let c = 0; c < 4; c++) {
    addCommItem(`conf2-chair-n${c+1}`, `Conf 2 Chair N${c+1}`, 'chair', 2080 + c * 80, 225, 52, 52, 88, 0, 'sky');
    addCommItem(`conf2-chair-s${c+1}`, `Conf 2 Chair S${c+1}`, 'chair', 2080 + c * 80, 375, 52, 52, 88, 180, 'sky');
  }
  addCommItem('conf2-display', 'Conf 2 65in Display', 'tv', 2200, 30, 150, 20, 110, 0, 'sky');
  addCommItem('conf2-cred', 'Conf 2 Low Credenza', 'wardrobe', 2200, 45, 45, 160, 70, 0, 'zinc');
  addCommItem('conf2-plant', 'Conf 2 Planter', 'plant', 2050, 60, 40, 40, 110, 0, 'emerald');

  // E. Reception & Elevator Lobby (18 items)
  addCommItem('recep-desk',    'Architectural Reception Curved Desk', 'desk', 1800, 2150, 280, 95, 110, 180, 'zinc');
  addCommItem('recep-chair',   'Receptionist Ergonomic Chair', 'chair', 1800, 2220, 60, 60, 95, 180, 'sky');
  addCommItem('sofa-lobby-1',  'Lobby Lounge Sofa North',      'sofa', 1800, 1750, 240, 90, 78, 0, 'violet');
  addCommItem('sofa-lobby-2',  'Lobby Lounge Sofa West',       'sofa', 1550, 1900, 180, 85, 78, 90, 'violet');
  addCommItem('sofa-lobby-3',  'Lobby Lounge Sofa East',       'sofa', 2050, 1900, 180, 85, 78, 270, 'violet');
  addCommItem('table-lobby-c1','Lobby Low Marble Table 1',     'desk', 1800, 1900, 110, 60, 36, 0, 'zinc');
  addCommItem('rug-lobby-main','Grand Lobby Silk & Wool Rug',  'rug',  1800, 1900, 360, 280, 1, 0, 'violet', true);
  for (let a = 0; a < 4; a++) {
    addCommItem(`chair-lobby-v${a+1}`, `Visitor Armchair ${a+1}`, 'chair', 1650 + (a % 2) * 300, 1800 + Math.floor(a / 2) * 180, 65, 65, 82, 0, 'amber');
  }
  for (let p = 0; p < 6; p++) {
    addCommItem(`plant-lobby-${p+1}`, `Lobby Architectural Ficus ${p+1}`, 'plant', 1450 + p * 130, 1650, 50, 50, 160, 0, 'emerald');
  }
  addCommItem('divider-lobby-scr','Lobby Privacy Baffle', 'divider', 1800, 2300, 180, 4, 180, 0, 'zinc');

  // F. Staff Café & Lounge (49 items)
  // 3 long communal tables x 6 chairs = 18 chairs + 3 tables = 21 items
  for (let t = 0; t < 3; t++) {
    const tx = 250 + t * 250;
    addCommItem(`cafe-table-${t+1}`, `Communal Café Table ${t+1}`, 'desk', tx, 800, 200, 80, 76, 90, 'amber');
    for (let c = 0; c < 3; c++) {
      addCommItem(`cafe-chair-${t+1}-l${c+1}`, `Café Chair T${t+1}-L${c+1}`, 'chair', tx - 55, 730 + c * 70, 45, 45, 82, 90, 'amber');
      addCommItem(`cafe-chair-${t+1}-r${c+1}`, `Café Chair T${t+1}-R${c+1}`, 'chair', tx + 55, 730 + c * 70, 45, 45, 82, 270, 'amber');
    }
  }
  // 4 high bar tables x 3 barstools = 12 stools + 4 tables = 16 items
  for (let bt = 0; bt < 4; bt++) {
    const btx = 150 + bt * 220;
    addCommItem(`cafe-bar-${bt+1}`, `High Top Bar Table ${bt+1}`, 'desk', btx, 1080, 70, 70, 105, 0, 'zinc');
    for (let s = 0; s < 3; s++) {
      const ang = (s / 3) * Math.PI * 2;
      addCommItem(`cafe-stool-${bt+1}-${s+1}`, `Barstool ${bt+1}-${s+1}`, 'chair', btx + Math.cos(ang) * 45, 1080 + Math.sin(ang) * 45, 40, 40, 80, 0, 'amber');
    }
  }
  // Kitchen cabinetry, counter, appliances (12 items)
  addCommItem('cafe-counter-main', 'Café Service Counter', 'desk', 500, 640, 300, 60, 92, 0, 'zinc');
  addCommItem('cafe-counter-back', 'Café Back Counter & Sinks', 'desk', 500, 950, 300, 60, 92, 0, 'zinc');
  addCommItem('cafe-fridge-1', 'Commercial Double Refrigerator 1', 'appliance', 80, 650, 85, 75, 200, 90, 'zinc');
  addCommItem('cafe-fridge-2', 'Commercial Double Refrigerator 2', 'appliance', 80, 750, 85, 75, 200, 90, 'zinc');
  addCommItem('cafe-micro-1', 'Commercial Microwave 1', 'appliance', 400, 640, 50, 40, 45, 0, 'zinc');
  addCommItem('cafe-micro-2', 'Commercial Microwave 2', 'appliance', 460, 640, 50, 40, 45, 0, 'zinc');
  addCommItem('cafe-espresso-1', 'La Marzocco Espresso Machine 1', 'appliance', 540, 640, 65, 45, 55, 0, 'amber');
  addCommItem('cafe-espresso-2', 'La Marzocco Espresso Machine 2', 'appliance', 620, 640, 65, 45, 55, 0, 'amber');
  addCommItem('cafe-waste-1', 'Waste & Compost Sort Station', 'box', 80, 860, 60, 80, 90, 90, 'zinc');
  addCommItem('cafe-plant-1', 'Café Ficus Tree', 'plant', 80, 980, 55, 55, 140, 0, 'emerald');
  addCommItem('cafe-plant-2', 'Café Palm', 'plant', 950, 650, 55, 55, 140, 0, 'emerald');
  addCommItem('cafe-display', 'Café News & Events Display', 'tv', 950, 800, 120, 20, 80, 270, 'sky');

  // G. IT Server Room & Telecom (9 items)
  for (let r = 0; r < 6; r++) {
    addCommItem(`server-rack-${r+1}`, `42U Enterprise Server Rack #${r+1}`, 'wardrobe', 1150 + (r % 3) * 90, 750 + Math.floor(r / 3) * 140, 65, 100, 210, 0, 'zinc');
  }
  addCommItem('server-admin-desk', 'NOC Admin Workstation', 'desk', 1400, 750, 120, 60, 75, 90, 'zinc');
  addCommItem('server-admin-chair', 'NOC Operator Task Chair', 'chair', 1450, 750, 55, 55, 90, 270, 'sky');
  addCommItem('server-ups-unit', 'High Capacity APC Symmetra UPS', 'appliance', 1400, 950, 80, 80, 180, 0, 'zinc');

  // H. Collaborative Townhall & Phone Pods (35 items)
  // 8 Phone Booth desks & stools (16 items)
  podLocs.forEach((pod, idx) => {
    addCommItem(`pod-desk-${idx+1}`, `Phone Booth Desk ${idx+1}`, 'desk', pod.x + pod.w / 2, pod.y + 40, 80, 45, 75, 0, 'zinc');
    addCommItem(`pod-stool-${idx+1}`, `Phone Booth Stool ${idx+1}`, 'chair', pod.x + pod.w / 2, pod.y + 90, 45, 45, 80, 0, 'amber');
  });
  // Collaborative Hub Lounge (19 items)
  for (let l = 0; l < 4; l++) {
    addCommItem(`collab-sofa-${l+1}`, `Curved Collab Sofa ${l+1}`, 'sofa', 2800 + (l % 2) * 350, 750 + Math.floor(l / 2) * 250, 200, 85, 75, 0, 'violet');
    addCommItem(`collab-table-${l+1}`, `Collab Mobile Whiteboard Table ${l+1}`, 'desk', 2800 + (l % 2) * 350, 840 + Math.floor(l / 2) * 250, 100, 60, 60, 0, 'zinc');
  }
  for (let p = 0; p < 7; p++) {
    addCommItem(`collab-plant-${p+1}`, `Townhall Indoor Tree ${p+1}`, 'plant', 2650 + p * 120, 1140, 50, 50, 130, 0, 'emerald');
  }
  for (let e = 0; e < 4; e++) {
    addCommItem(`collab-board-${e+1}`, `Mobile Ideation Whiteboard ${e+1}`, 'easel', 2700 + e * 200, 640, 80, 30, 180, 0, 'amber');
  }

  // I. Restrooms & Core (33 items)
  for (let rm = 0; rm < 8; rm++) {
    addCommItem(`vanity-core-${rm+1}`, `Commercial Stone Vanity Basin ${rm+1}`, 'desk', 1600 + (rm % 4) * 85, 650 + Math.floor(rm / 4) * 450, 75, 50, 88, 0, 'zinc');
    addCommItem(`mirror-core-${rm+1}`, `Commercial Illuminated Mirror ${rm+1}`, 'mirror', 1600 + (rm % 4) * 85, 630 + Math.floor(rm / 4) * 450, 8, 65, 95, 0, 'sky');
  }
  for (let cb = 0; cb < 8; cb++) {
    addCommItem(`cubicle-div-${cb+1}`, `HPL Restroom Partition Panel ${cb+1}`, 'divider', 1600 + (cb % 4) * 85, 750 + Math.floor(cb / 4) * 300, 75, 4, 195, 90, 'zinc');
  }
  for (let s = 0; s < 9; s++) {
    addCommItem(`rest-supply-${s+1}`, `Supply & Sanitary Cabinet ${s+1}`, 'wardrobe', 1550 + s * 70, 1150, 45, 60, 180, 0, 'zinc');
  }

  // Verify total items count:
  // 216 (West) + 216 (East) + 44 (Exec) + 33 (Board/Conf) + 18 (Lobby) + 49 (Café) + 9 (Server) + 35 (Collab/Pods) + 33 (Restrooms) = 663 items!
  // Perfectly between 500 and 1,000 items!

  // 5. Generate 56 Cables (exceeds 50+ requirement)
  const cables = [];
  // 32 workstation pod power trunks (16 in West, 16 in East)
  for (let p = 0; p < 8; p++) {
    cables.push({
      id: `c-trunk-w-p${p}-a`,
      name: `West Pod ${p+1} Primary Busbar`,
      fromId: `desk-w-p${p}-s0`,
      toId: `desk-w-p${p}-s2`,
      maxMeters: 6.0,
      warnMeters: 5.0,
      routingMode: 'direct',
      color: '#4ecdc4',
      visible: true
    });
    cables.push({
      id: `c-trunk-w-p${p}-b`,
      name: `West Pod ${p+1} Secondary Busbar`,
      fromId: `desk-w-p${p}-s3`,
      toId: `desk-w-p${p}-s5`,
      maxMeters: 6.0,
      warnMeters: 5.0,
      routingMode: 'direct',
      color: '#4ecdc4',
      visible: true
    });
    cables.push({
      id: `c-trunk-e-p${p}-a`,
      name: `East Pod ${p+1} Primary Busbar`,
      fromId: `desk-e-p${p}-s0`,
      toId: `desk-e-p${p}-s2`,
      maxMeters: 6.0,
      warnMeters: 5.0,
      routingMode: 'direct',
      color: '#4ecdc4',
      visible: true
    });
    cables.push({
      id: `c-trunk-e-p${p}-b`,
      name: `East Pod ${p+1} Secondary Busbar`,
      fromId: `desk-e-p${p}-s3`,
      toId: `desk-e-p${p}-s5`,
      maxMeters: 6.0,
      warnMeters: 5.0,
      routingMode: 'direct',
      color: '#4ecdc4',
      visible: true
    });
  }
  // That's 32 workstation cables!

  // 8 Server Room Rack Interlinks
  for (let r = 0; r < 5; r++) {
    cables.push({
      id: `c-server-trunk-${r+1}`,
      name: `100GbE Fiber Backbone Trunk ${r+1}`,
      fromId: `server-rack-${r+1}`,
      toId: `server-rack-${r+2}`,
      maxMeters: 3.5,
      warnMeters: 2.8,
      routingMode: 'direct',
      color: '#d99b26',
      visible: true
    });
  }
  cables.push({
    id: `c-server-admin-link`,
    name: `NOC Admin Direct Fiber Console`,
    fromId: `server-admin-desk`,
    toId: `server-rack-1`,
    maxMeters: 4.5,
    warnMeters: 3.8,
    routingMode: 'direct',
    color: '#5a8cb2',
    visible: true
  });
  cables.push({
    id: `c-server-ups-link1`,
    name: `UPS Heavy Phase Feed A`,
    fromId: `server-ups-unit`,
    toId: `server-rack-1`,
    maxMeters: 5.0,
    warnMeters: 4.2,
    routingMode: 'direct',
    color: '#d96b6b',
    visible: true
  });
  cables.push({
    id: `c-server-ups-link2`,
    name: `UPS Heavy Phase Feed B`,
    fromId: `server-ups-unit`,
    toId: `server-rack-4`,
    maxMeters: 5.0,
    warnMeters: 4.2,
    routingMode: 'direct',
    color: '#d96b6b',
    visible: true
  });

  // 6 Conference & Boardroom AV Feeds
  cables.push({ id: 'c-board-av-1', name: 'Boardroom Polycom Table Mic Array', fromId: 'board-table', toId: 'board-av-cred', maxMeters: 6.5, warnMeters: 5.5, routingMode: 'direct', color: '#c8a96e', visible: true });
  cables.push({ id: 'c-board-av-2', name: 'Boardroom HDMI Display Feed', fromId: 'board-av-cred', toId: 'board-display', maxMeters: 4.0, warnMeters: 3.2, routingMode: 'wall', color: '#5a8cb2', visible: true });
  cables.push({ id: 'c-conf2-av-1', name: 'Conf 2 Table Microphones', fromId: 'conf2-table', toId: 'conf2-cred', maxMeters: 5.0, warnMeters: 4.0, routingMode: 'direct', color: '#c8a96e', visible: true });
  cables.push({ id: 'c-conf2-av-2', name: 'Conf 2 Display Line', fromId: 'conf2-cred', toId: 'conf2-display', maxMeters: 3.5, warnMeters: 2.8, routingMode: 'wall', color: '#5a8cb2', visible: true });
  cables.push({ id: 'c-lobby-av',   name: 'Lobby Video Display Line', fromId: 'recep-desk', toId: 'table-lobby-c1', maxMeters: 7.0, warnMeters: 6.0, routingMode: 'direct', color: '#5a8cb2', visible: true });
  cables.push({ id: 'c-cafe-av',    name: 'Café Signage Display Feed', fromId: 'cafe-counter-main', toId: 'cafe-display', maxMeters: 8.0, warnMeters: 7.0, routingMode: 'wall', color: '#5a8cb2', visible: true });

  // 4 Executive Power circuits
  for (let e = 0; e < 4; e++) {
    cables.push({
      id: `c-exec-feed-${e+1}`,
      name: `Executive Suite ${e+1} Isolated Ground`,
      fromId: `exec-${e+1}-desk`,
      toId: `exec-${e+1}-credenza`,
      maxMeters: 4.0,
      warnMeters: 3.2,
      routingMode: 'direct',
      color: '#4ecdc4',
      visible: true
    });
  }

  // 6 Café Heavy Equipment feeds
  cables.push({ id: 'c-cafe-pwr-1', name: 'Espresso Machine 1 3-Phase', fromId: 'cafe-espresso-1', toId: 'cafe-counter-back', maxMeters: 3.0, warnMeters: 2.4, routingMode: 'direct', color: '#d96b6b', visible: true });
  cables.push({ id: 'c-cafe-pwr-2', name: 'Espresso Machine 2 3-Phase', fromId: 'cafe-espresso-2', toId: 'cafe-counter-back', maxMeters: 3.0, warnMeters: 2.4, routingMode: 'direct', color: '#d96b6b', visible: true });
  cables.push({ id: 'c-cafe-ref-1', name: 'Commercial Refrigerator 1 Power', fromId: 'cafe-fridge-1', toId: 'cafe-counter-back', maxMeters: 4.5, warnMeters: 3.8, routingMode: 'wall', color: '#4ecdc4', visible: true });
  cables.push({ id: 'c-cafe-ref-2', name: 'Commercial Refrigerator 2 Power', fromId: 'cafe-fridge-2', toId: 'cafe-counter-back', maxMeters: 4.5, warnMeters: 3.8, routingMode: 'wall', color: '#4ecdc4', visible: true });
  cables.push({ id: 'c-cafe-mic-1', name: 'Microwave 1 Branch', fromId: 'cafe-micro-1', toId: 'cafe-counter-main', maxMeters: 2.0, warnMeters: 1.6, routingMode: 'direct', color: '#c8a96e', visible: true });
  cables.push({ id: 'c-cafe-mic-2', name: 'Microwave 2 Branch', fromId: 'cafe-micro-2', toId: 'cafe-counter-main', maxMeters: 2.0, warnMeters: 1.6, routingMode: 'direct', color: '#c8a96e', visible: true });
  // Total cables: 32 + 8 + 6 + 4 + 6 = 56 cables! (Satisfies 50+ requirement).

  // 6. Outlets / Floor Boxes (40 outlets)
  const outlets = [];
  for (let i = 0; i < 40; i++) {
    const isNorth = i < 20;
    const ox = 100 + (i % 20) * 175;
    const oy = isNorth ? 0 : H;
    outlets.push({
      id: `OUT-COMM-${i + 1}`,
      name: `Commercial Floor Box ${i + 1}`,
      wall: isNorth ? 'top' : 'bottom',
      pos: ox,
      x: ox,
      y: oy
    });
  }

  // Spaces definition
  const spaces = [
    { id: 'space-reception', name: 'Reception & Elevator Lobby', number: '100', boundarySegmentIds: [], polygon: [{ x: 1400, y: 1600 }, { x: 2200, y: 1600 }, { x: 2200, y: 2400 }, { x: 1400, y: 2400 }], areaM2: 64.0, perimeterM: 32.0, centroid: { x: 1800, y: 2000 }, floorMaterial: 'terrazzo_slate', fillColor: '#13151c' },
    { id: 'space-open-west', name: 'Open Workstation Bay West', number: '101', boundarySegmentIds: [], polygon: [{ x: 0, y: 1200 }, { x: 1400, y: 1200 }, { x: 1400, y: 2400 }, { x: 0, y: 2400 }], areaM2: 168.0, perimeterM: 52.0, centroid: { x: 700, y: 1800 }, floorMaterial: 'commercial_carpet', fillColor: '#111216' },
    { id: 'space-open-east', name: 'Open Workstation Bay East', number: '102', boundarySegmentIds: [], polygon: [{ x: 2200, y: 1200 }, { x: 3600, y: 1200 }, { x: 3600, y: 2400 }, { x: 2200, y: 2400 }], areaM2: 168.0, perimeterM: 52.0, centroid: { x: 2900, y: 1800 }, floorMaterial: 'commercial_carpet', fillColor: '#111216' },
    { id: 'space-exec-1', name: 'Executive Suite 1 (CEO)', number: '103', boundarySegmentIds: [], polygon: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }], areaM2: 36.0, perimeterM: 24.0, centroid: { x: 300, y: 300 }, floorMaterial: 'white_oak_plank', fillColor: '#151720' },
    { id: 'space-exec-2', name: 'Executive Suite 2 (COO)', number: '104', boundarySegmentIds: [], polygon: [{ x: 600, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 600 }, { x: 600, y: 600 }], areaM2: 36.0, perimeterM: 24.0, centroid: { x: 900, y: 300 }, floorMaterial: 'white_oak_plank', fillColor: '#151720' },
    { id: 'space-boardroom', name: 'Executive Boardroom', number: '105', boundarySegmentIds: [], polygon: [{ x: 1200, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 600 }, { x: 1200, y: 600 }], areaM2: 48.0, perimeterM: 28.0, centroid: { x: 1600, y: 300 }, floorMaterial: 'herringbone_parquet', fillColor: '#161822' },
    { id: 'space-conf-2', name: 'Team Conference Room 2', number: '106', boundarySegmentIds: [], polygon: [{ x: 2000, y: 0 }, { x: 2400, y: 0 }, { x: 2400, y: 600 }, { x: 2000, y: 600 }], areaM2: 24.0, perimeterM: 20.0, centroid: { x: 2200, y: 300 }, floorMaterial: 'herringbone_parquet', fillColor: '#151720' },
    { id: 'space-exec-3', name: 'Executive Suite 3 (CTO)', number: '107', boundarySegmentIds: [], polygon: [{ x: 2400, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 600 }, { x: 2400, y: 600 }], areaM2: 36.0, perimeterM: 24.0, centroid: { x: 2700, y: 300 }, floorMaterial: 'white_oak_plank', fillColor: '#151720' },
    { id: 'space-exec-4', name: 'Executive Suite 4 (CFO)', number: '108', boundarySegmentIds: [], polygon: [{ x: 3000, y: 0 }, { x: 3600, y: 0 }, { x: 3600, y: 600 }, { x: 3000, y: 600 }], areaM2: 36.0, perimeterM: 24.0, centroid: { x: 3300, y: 300 }, floorMaterial: 'white_oak_plank', fillColor: '#151720' },
    { id: 'space-cafe', name: 'Staff Café & Breakroom Lounge', number: '109', boundarySegmentIds: [], polygon: [{ x: 0, y: 600 }, { x: 1000, y: 600 }, { x: 1000, y: 1200 }, { x: 0, y: 1200 }], areaM2: 60.0, perimeterM: 32.0, centroid: { x: 500, y: 900 }, floorMaterial: 'porcelain_tile', fillColor: '#171922' },
    { id: 'space-it-server', name: 'IT Server & Telecom Data Center', number: '110', boundarySegmentIds: [], polygon: [{ x: 1000, y: 600 }, { x: 1500, y: 600 }, { x: 1500, y: 1200 }, { x: 1000, y: 1200 }], areaM2: 30.0, perimeterM: 22.0, centroid: { x: 1250, y: 900 }, floorMaterial: 'polished_concrete', fillColor: '#191b24' },
    { id: 'space-restrooms', name: 'Commercial Restrooms Core', number: '111', boundarySegmentIds: [], polygon: [{ x: 1500, y: 600 }, { x: 2200, y: 600 }, { x: 2200, y: 1200 }, { x: 1500, y: 1200 }], areaM2: 42.0, perimeterM: 26.0, centroid: { x: 1850, y: 900 }, floorMaterial: 'terrazzo_slate', fillColor: '#14161f' },
    { id: 'space-collab', name: 'Central Collaborative Townhall', number: '112', boundarySegmentIds: [], polygon: [{ x: 2200, y: 600 }, { x: 3600, y: 600 }, { x: 3600, y: 1200 }, { x: 2200, y: 1200 }], areaM2: 84.0, perimeterM: 40.0, centroid: { x: 2900, y: 900 }, floorMaterial: 'commercial_carpet', fillColor: '#121319' }
  ];

  const openings = doors.map((d, idx) => ({
    id: d.id,
    wallSegmentId: `seg-${(idx % segments.length) + 1}`,
    t: 0.5,
    width: d.width,
    height: 220,
    sillHeight: 0,
    type: d.width > 130 ? 'door_double_swing' : 'door_single_swing',
    hinge: d.hinge === 'right' ? 'right' : 'left',
    swing: d.swing === 'outward' ? 'outward' : 'inward',
    swingAngleDeg: 90
  })).concat(windows.map((w, idx) => ({
    id: w.id,
    wallSegmentId: `seg-${(idx % segments.length) + 1}`,
    t: 0.5,
    width: w.width,
    height: 180,
    sillHeight: 80,
    type: 'window_fixed',
    hinge: 'left',
    swing: 'outward',
    swingAngleDeg: 0,
    glazing: { paneCount: 3, mullionThicknessCm: 5, glassTint: '#5a8cb2' }
  })));

  const furniture = items.map(it => ({
    id: it.id,
    name: it.name,
    archetype: it.type,
    layerId: 'A-FURN',
    spaceId: 'space-open-west',
    x: it.x,
    y: it.y,
    z: 0,
    rotation: it.rot,
    w: it.w,
    h: it.h,
    zHeight: it.zHeight,
    color: it.color,
    ignoreCollision: it.ignoreCollision,
    lockedDims: it.lockedDims,
    visible: it.visible
  }));

  const annotations = outlets.map(o => ({
    id: `anno-${o.id}`,
    layerId: 'E-POWR',
    type: 'leader_text',
    x1: o.x,
    y1: o.y,
    text: o.name,
    fontSizePx: 10
  }));

  return {
    version: 3,
    app: 'SimpleCAD',
    createdAt: '2026-11-15T13:30:00.000Z',
    updatedAt: '2026-11-15T13:30:00.000Z',
    project: {
      id: 'proj-large-floorplate',
      name: 'Commercial Office Floorplate (3600×2400 cm)',
      author: 'SimpleCAD Architecture Lab',
      units: 'cm',
      gridStepCm: 20,
      majorGridStepCm: 100,
      activeBuildingId: 'bldg-tower',
      activeStoreyId: 'lvl-12',
      activeLayoutId: 'floorplate-pax120'
    },
    room: {
      name: 'Commercial Office Floorplate (3600×2400 cm)',
      w: W,
      h: H,
      wallThickness: th,
      doors,
      windows,
      outlets
    },
    cables,
    catalog,
    items,
    activeLayoutId: 'floorplate-pax120',
    layouts: [
      {
        id: 'floorplate-pax120',
        name: 'Enterprise Commercial Floorplate (663 Items)',
        builtIn: true,
        placements
      }
    ],
    layers: standardLayers,
    buildings: [
      {
        id: 'bldg-tower',
        name: 'Harbour Financial Tower',
        storeys: [
          {
            id: 'lvl-12',
            name: 'Executive Floorplate (Level 12)',
            index: 12,
            elevationZ: 4800,
            storyHeight: 320,
            slabThickness: 30,
            wallGraph: {
              nodes,
              segments
            },
            spaces,
            openings,
            furniture,
            cables: cables.map(c => ({ ...c, layerId: 'E-POWR' })),
            annotations
          }
        ]
      }
    ]
  };
}

// Generate all three files
function main() {
  console.log('Generating SimpleCAD Representative Test Projects Suite...');
  const projDir = path.resolve(__dirname, '..', 'projects');
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
  }

  // 1. Small Studio
  const small = buildSmallStudio();
  const smallPath = path.join(projDir, 'project-small-studio.json');
  fs.writeFileSync(smallPath, JSON.stringify(small, null, 2), 'utf8');
  console.log(`✓ Generated ${smallPath}`);
  console.log(`  Dimensions: ${small.room.w}x${small.room.h}cm, Items: ${small.items.length}, Doors: ${small.room.doors.length}, Windows: ${small.room.windows.length}, Outlets: ${small.room.outlets.length}, Cables: ${small.cables.length}, Wall Segments: ${small.buildings[0].storeys[0].wallGraph.segments.length}`);

  // 2. Medium Apartment
  const medium = buildMediumApartment();
  const medPath = path.join(projDir, 'project-medium-apartment.json');
  fs.writeFileSync(medPath, JSON.stringify(medium, null, 2), 'utf8');
  console.log(`✓ Generated ${medPath}`);
  console.log(`  Dimensions: ${medium.room.w}x${medium.room.h}cm, Items: ${medium.items.length}, Doors: ${medium.room.doors.length}, Windows: ${medium.room.windows.length}, Outlets: ${medium.room.outlets.length}, Cables: ${medium.cables.length}, Wall Segments: ${medium.buildings[0].storeys[0].wallGraph.segments.length}, Spaces: ${medium.buildings[0].storeys[0].spaces.length}`);

  // 3. Large Floorplate
  const large = buildLargeFloorplate();
  const largePath = path.join(projDir, 'project-large-floorplate.json');
  fs.writeFileSync(largePath, JSON.stringify(large, null, 2), 'utf8');
  console.log(`✓ Generated ${largePath}`);
  console.log(`  Dimensions: ${large.room.w}x${large.room.h}cm, Items: ${large.items.length}, Doors: ${large.room.doors.length}, Windows: ${large.room.windows.length}, Outlets: ${large.room.outlets.length}, Cables: ${large.cables.length}, Wall Segments: ${large.buildings[0].storeys[0].wallGraph.segments.length}, Spaces: ${large.buildings[0].storeys[0].spaces.length}`);
}

main();
