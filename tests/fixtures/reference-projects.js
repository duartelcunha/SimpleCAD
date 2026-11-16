/**
 * SimpleCAD Test Fixtures — Reference Project Payloads
 * Used for opaque-box schema validation, loadability testing, and contract verification
 * across Small Studio, Medium Apartment, and Large Commercial Floorplate scales.
 */

'use strict';

const smallStudioProject = {
  version: 2,
  app: 'SimpleCAD',
  room: {
    name: 'Studio Bedroom (440×380 cm)',
    w: 440,
    h: 380,
    wallThickness: 14,
    doors: [
      { id: 'door-1', name: 'Door', wall: 'bottom', offset: 28, width: 90, hinge: 'left', swing: 'inward' }
    ],
    windows: [
      { id: 'win-1', name: 'WINDOW', wall: 'top', offset: 36, width: 175 }
    ],
    outlets: [
      { id: 'T1', name: 'T1', wall: 'top', pos: 290, x: 290, y: 0 },
      { id: 'T2', name: 'T2', wall: 'right', pos: 165, x: 440, y: 165 },
      { id: 'T3', name: 'T3', wall: 'left', pos: 110, x: 0, y: 110 },
      { id: 'T4', name: 'T4', wall: 'bottom', pos: 215, x: 215, y: 380 }
    ]
  },
  cables: [
    {
      id: 'cable-demo',
      name: 'Power Line',
      fromId: 'desk',
      toId: 'T1',
      maxMeters: 4.5,
      warnMeters: 3.8,
      routingMode: 'wall',
      color: '#6e9887',
      visible: true
    }
  ],
  catalog: [
    { id: 'rug', name: 'Area Rug', type: 'rug', w: 228, h: 204, zHeight: 1, color: 'violet', ignoreCollision: true, lockedDims: false, visible: true },
    { id: 'bed', name: 'Queen Bed', type: 'bed', w: 200, h: 155, zHeight: 46, color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'ns1', name: 'Nightstand', type: 'nightstand', w: 46, h: 42, zHeight: 54, color: 'amber', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'ns2', name: 'Nightstand', type: 'nightstand', w: 46, h: 42, zHeight: 54, color: 'amber', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'lamp', name: 'Floor Lamp', type: 'lamp', w: 36, h: 36, zHeight: 162, color: 'amber', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'desk', name: 'Oak Desk', type: 'desk', w: 140, h: 64, zHeight: 75, color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'chair', name: 'Studio Chair', type: 'chair', w: 52, h: 52, zHeight: 84, color: 'amber', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'plant', name: 'Ficus Plant', type: 'plant', w: 40, h: 40, zHeight: 112, color: 'emerald', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'divider', name: 'Folding Screen', type: 'divider', w: 150, h: 4, zHeight: 178, foldAngles: [16, -20, 16], color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true, adjustable: true },
    { id: 'shelf', name: 'Bookcase', type: 'shelf', w: 120, h: 36, zHeight: 175, color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'wardrobe', name: 'Wardrobe', type: 'wardrobe', w: 150, h: 56, zHeight: 205, color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true }
  ],
  activeLayoutId: 'opt1',
  layouts: [
    {
      id: 'opt1',
      name: 'Studio Suite (Default)',
      builtIn: true,
      placements: {
        rug: { minX: 206, minY: 56, rot: 0, w: 228, h: 204, zHeight: 1, visible: true },
        bed: { minX: 240, minY: 72, rot: 180, w: 200, h: 155, zHeight: 46, visible: true },
        ns1: { minX: 394, minY: 20, rot: 270, w: 46, h: 42, zHeight: 54, visible: true },
        ns2: { minX: 394, minY: 236, rot: 270, w: 46, h: 42, zHeight: 54, visible: true },
        lamp: { minX: 332, minY: 18, rot: 0, w: 36, h: 36, zHeight: 162, visible: true },
        desk: { minX: 54, minY: 14, rot: 0, w: 140, h: 64, zHeight: 75, visible: true },
        chair: { minX: 98, minY: 88, rot: 0, w: 52, h: 52, zHeight: 84, visible: true },
        plant: { minX: 8, minY: 14, rot: 0, w: 40, h: 40, zHeight: 112, visible: true },
        divider: { cx: 190, cy: 154, rot: 90, w: 150, h: 4, zHeight: 178, visible: true, foldAngles: [16, -20, 16] },
        shelf: { minX: 0, minY: 120, rot: 270, w: 120, h: 36, zHeight: 175, visible: true },
        wardrobe: { minX: 256, minY: 324, rot: 180, w: 150, h: 56, zHeight: 205, visible: true }
      }
    }
  ]
};

// Generate Medium Apartment (4 zones / rooms, 25 items, 4 outlets, 3 cables)
function createMediumApartmentProject() {
  const catalog = [
    { id: 'bed-master', name: 'Master Bed', type: 'bed', w: 180, h: 120, zHeight: 50, color: 'zinc' },
    { id: 'ns-m1', name: 'Master Nightstand L', type: 'nightstand', w: 45, h: 40, zHeight: 50, color: 'amber' },
    { id: 'ns-m2', name: 'Master Nightstand R', type: 'nightstand', w: 45, h: 40, zHeight: 50, color: 'amber' },
    { id: 'wardrobe-m', name: 'Master Wardrobe', type: 'wardrobe', w: 160, h: 60, zHeight: 210, color: 'zinc' },
    { id: 'sofa-living', name: 'Lounge Sofa', type: 'sofa', w: 180, h: 80, zHeight: 80, color: 'violet' },
    { id: 'rug-living', name: 'Living Area Rug', type: 'rug', w: 200, h: 120, zHeight: 1, color: 'sky', ignoreCollision: true },
    { id: 'tv-living', name: 'Media Console & TV', type: 'tv', w: 140, h: 40, zHeight: 45, color: 'sky' },
    { id: 'dining-table', name: 'Dining Table', type: 'desk', w: 160, h: 80, zHeight: 76, color: 'amber' },
    { id: 'chair-d1', name: 'Dining Chair 1', type: 'chair', w: 48, h: 48, zHeight: 85, color: 'amber' },
    { id: 'chair-d2', name: 'Dining Chair 2', type: 'chair', w: 48, h: 48, zHeight: 85, color: 'amber' },
    { id: 'chair-d3', name: 'Dining Chair 3', type: 'chair', w: 48, h: 48, zHeight: 85, color: 'amber' },
    { id: 'chair-d4', name: 'Dining Chair 4', type: 'chair', w: 48, h: 48, zHeight: 85, color: 'amber' },
    { id: 'kitchen-counter', name: 'Kitchen Island', type: 'desk', w: 160, h: 70, zHeight: 90, color: 'zinc' },
    { id: 'fridge', name: 'Refrigerator', type: 'appliance', w: 70, h: 65, zHeight: 185, color: 'zinc' },
    { id: 'desk-office', name: 'Executive Desk', type: 'desk', w: 150, h: 70, zHeight: 75, color: 'zinc' },
    { id: 'chair-office', name: 'Ergonomic Task Chair', type: 'chair', w: 60, h: 60, zHeight: 95, color: 'sky' },
    { id: 'pc-workstation', name: 'Dual Monitor PC', type: 'pc', w: 80, h: 30, zHeight: 65, color: 'emerald' },
    { id: 'bookcase-office', name: 'Office Bookcase', type: 'shelf', w: 140, h: 38, zHeight: 200, color: 'zinc' },
    { id: 'plant-living', name: 'Monstera Plant', type: 'plant', w: 50, h: 50, zHeight: 120, color: 'emerald' },
    { id: 'floor-lamp-living', name: 'Arc Floor Lamp', type: 'lamp', w: 40, h: 40, zHeight: 175, color: 'amber' }
  ];

  const placements = {};
  catalog.forEach((item, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    placements[item.id] = {
      minX: 40 + col * 200,
      minY: 40 + row * 135,
      rot: 0,
      w: item.w,
      h: item.h,
      zHeight: item.zHeight,
      visible: true
    };
  });

  return {
    version: 2,
    app: 'SimpleCAD',
    room: {
      name: 'Residential Suite (850×720 cm)',
      w: 850,
      h: 720,
      wallThickness: 16,
      doors: [
        { id: 'd-entry', name: 'Entry Door', wall: 'bottom', offset: 80, width: 95, hinge: 'left', swing: 'inward' },
        { id: 'd-balcony', name: 'Balcony Slider', wall: 'top', offset: 400, width: 220, hinge: 'right', swing: 'outward' }
      ],
      windows: [
        { id: 'w-living', name: 'Living Room Window', wall: 'top', offset: 120, width: 200 },
        { id: 'w-bedroom', name: 'Bedroom Window', wall: 'right', offset: 150, width: 160 }
      ],
      outlets: [
        { id: 'O1', name: 'O1-Living', wall: 'top', pos: 100, x: 100, y: 0 },
        { id: 'O2', name: 'O2-Media', wall: 'top', pos: 350, x: 350, y: 0 },
        { id: 'O3', name: 'O3-Office', wall: 'right', pos: 200, x: 850, y: 200 },
        { id: 'O4', name: 'O4-Bed', wall: 'left', pos: 300, x: 0, y: 300 }
      ]
    },
    cables: [
      { id: 'c-tv', name: 'Media Feed', fromId: 'tv-living', toId: 'O2', maxMeters: 4.0, warnMeters: 3.2, routingMode: 'wall', color: '#5a8cb2', visible: true },
      { id: 'c-pc', name: 'Workstation Line', fromId: 'pc-workstation', toId: 'O3', maxMeters: 5.0, warnMeters: 4.2, routingMode: 'direct', color: '#6e9887', visible: true }
    ],
    catalog,
    activeLayoutId: 'apt-standard',
    layouts: [
      {
        id: 'apt-standard',
        name: 'Standard Furnished Layout',
        builtIn: true,
        placements
      }
    ]
  };
}

// Generate Large Commercial Floorplate (100+ items, commercial open office)
function createLargeFloorplateProject(itemCount = 120) {
  const catalog = [];
  const placements = {};

  const archetypes = ['desk', 'chair', 'shelf', 'pc', 'plant', 'divider', 'sofa', 'lamp'];
  const colors = ['zinc', 'amber', 'sky', 'emerald', 'violet'];

  for (let i = 0; i < itemCount; i++) {
    const type = archetypes[i % archetypes.length];
    const color = colors[i % colors.length];
    const id = `item-${i + 1}`;
    const w = type === 'desk' ? 140 : (type === 'chair' ? 52 : (type === 'sofa' ? 180 : 60));
    const h = type === 'desk' ? 70 : (type === 'chair' ? 52 : (type === 'sofa' ? 85 : 45));
    const zHeight = type === 'chair' ? 85 : (type === 'desk' ? 75 : 120);

    catalog.push({
      id,
      name: `Commercial ${type.toUpperCase()} #${i + 1}`,
      type,
      w,
      h,
      zHeight,
      color,
      ignoreCollision: false,
      visible: true
    });

    const col = i % 12;
    const row = Math.floor(i / 12);
    placements[id] = {
      minX: 60 + col * 155,
      minY: 60 + row * 160,
      rot: (i % 4) * 90,
      w,
      h,
      zHeight,
      visible: true
    };
  }

  const outlets = [];
  for (let i = 0; i < 16; i++) {
    outlets.push({
      id: `OUT-${i + 1}`,
      name: `Floor Box ${i + 1}`,
      wall: i < 8 ? 'top' : 'bottom',
      pos: 100 + i * 110,
      x: 100 + i * 110,
      y: i < 8 ? 0 : 1800
    });
  }

  const cables = [];
  for (let i = 0; i < 12; i++) {
    cables.push({
      id: `comm-cable-${i + 1}`,
      name: `MEP Circuit ${i + 1}`,
      fromId: `item-${(i * 9) + 1}`,
      toId: `OUT-${(i % 16) + 1}`,
      maxMeters: 8.0,
      warnMeters: 6.5,
      routingMode: i % 2 === 0 ? 'wall' : 'direct',
      color: '#d99b26',
      visible: true
    });
  }

  return {
    version: 2,
    app: 'SimpleCAD',
    room: {
      name: 'Commercial Office Floorplate (2000×1800 cm)',
      w: 2000,
      h: 1800,
      wallThickness: 24,
      doors: [
        { id: 'fire-exit-1', name: 'North Fire Stair', wall: 'top', offset: 250, width: 120, hinge: 'left', swing: 'outward' },
        { id: 'fire-exit-2', name: 'South Fire Stair', wall: 'bottom', offset: 1600, width: 120, hinge: 'right', swing: 'outward' },
        { id: 'main-entry', name: 'Elevator Lobby Entry', wall: 'bottom', offset: 900, width: 240, hinge: 'double', swing: 'both' }
      ],
      windows: [
        { id: 'curtain-north', name: 'Curtain Wall N', wall: 'top', offset: 500, width: 900 },
        { id: 'curtain-south', name: 'Curtain Wall S', wall: 'bottom', offset: 200, width: 600 }
      ],
      outlets
    },
    cables,
    catalog,
    activeLayoutId: 'floorplate-open',
    layouts: [
      {
        id: 'floorplate-open',
        name: 'Open Plan Commercial Desking (120 Pax)',
        builtIn: true,
        placements
      }
    ]
  };
}

module.exports = {
  smallStudioProject,
  createMediumApartmentProject,
  createLargeFloorplateProject
};
