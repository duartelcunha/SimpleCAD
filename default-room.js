/**
 * SimpleCAD — Projeto Demonstrativo Padrão (360×420 cm),
 * Arquétipos CAD, Paleta de Cores & Parser Local Offline (Zero APIs / Zero Custo).
 */

window.COLOR_PALETTE = {
  zinc:    { label: 'Osso / Pedra',   stroke: '#d6d3cd', fill: 'rgba(214, 211, 205, 0.14)', text: '#edeae4' },
  amber:   { label: 'Latão / Âmbar',  stroke: '#c8a96e', fill: 'rgba(200, 169, 110, 0.16)', text: '#f3e5c8' },
  sky:     { label: 'Azul Aço',       stroke: '#6b93b8', fill: 'rgba(107, 147, 184, 0.16)', text: '#cfe0f0' },
  emerald: { label: 'Verde Mineral',  stroke: '#6e9887', fill: 'rgba(110, 152, 135, 0.16)', text: '#c7e2d7' },
  violet:  { label: 'Taupe Quente',   stroke: '#9e8c7a', fill: 'rgba(158, 140, 122, 0.16)', text: '#e6ddd3' },
  rose:    { label: 'Terracota',      stroke: '#d96b6b', fill: 'rgba(217, 107, 107, 0.16)', text: '#f7d4d4' }
};

window.ARCHETYPES = [
  { type: 'bed',        label: 'Cama / Colchão',                defaultW: 210, defaultH: 140, defaultZ: 45,  color: 'zinc',    ignoreCollision: false },
  { type: 'nightstand', label: 'Mesa de Cabeceira / Cómoda',    defaultW: 50,  defaultH: 40,  defaultZ: 55,  color: 'zinc',    ignoreCollision: false },
  { type: 'wardrobe',   label: 'Armário / Roupeiro',            defaultW: 117, defaultH: 55,  defaultZ: 200, color: 'zinc',    ignoreCollision: false },
  { type: 'desk',       label: 'Secretária / Mesa',             defaultW: 120, defaultH: 60,  defaultZ: 75,  color: 'zinc',    ignoreCollision: false },
  { type: 'chair',      label: 'Cadeira / Poltrona',            defaultW: 52,  defaultH: 52,  defaultZ: 85,  color: 'amber',   ignoreCollision: false },
  { type: 'sofa',       label: 'Sofá / Chaise / Puff',          defaultW: 160, defaultH: 80,  defaultZ: 78,  color: 'violet',  ignoreCollision: false },
  { type: 'tv',         label: 'Móvel TV + Ecrã',               defaultW: 100, defaultH: 25,  defaultZ: 40,  color: 'sky',     ignoreCollision: false },
  { type: 'pc',         label: 'Móvel PC / Torre',              defaultW: 66,  defaultH: 30,  defaultZ: 60,  color: 'emerald', ignoreCollision: false },
  { type: 'shelf',      label: 'Estante / Prateleiras',         defaultW: 60,  defaultH: 35,  defaultZ: 140, color: 'zinc',    ignoreCollision: false },
  { type: 'divider',    label: 'Divisória / Painel (4 partes)', defaultW: 145, defaultH: 4,   defaultZ: 180, color: 'zinc',    ignoreCollision: false },
  { type: 'easel',      label: 'Cavalete / Arte',               defaultW: 60,  defaultH: 45,  defaultZ: 160, color: 'amber',   ignoreCollision: false },
  { type: 'mirror',     label: 'Espelho / Quadro Alto',         defaultW: 55,  defaultH: 8,   defaultZ: 165, color: 'sky',     ignoreCollision: false },
  { type: 'lamp',       label: 'Candeeiro / Iluminação',        defaultW: 36,  defaultH: 36,  defaultZ: 155, color: 'amber',   ignoreCollision: false },
  { type: 'plant',      label: 'Planta / Vaso',                 defaultW: 40,  defaultH: 40,  defaultZ: 95,  color: 'emerald', ignoreCollision: false },
  { type: 'appliance',  label: 'Eletrodoméstico / AC / Mini-bar', defaultW: 50, defaultH: 48, defaultZ: 85,  color: 'zinc',    ignoreCollision: false },
  { type: 'rug',        label: 'Tapete / Zona',                 defaultW: 160, defaultH: 100, defaultZ: 1,   color: 'violet',  ignoreCollision: true  },
  { type: 'box',        label: 'Móvel / Bloco Genérico',        defaultW: 60,  defaultH: 45,  defaultZ: 75,  color: 'zinc',    ignoreCollision: false }
];

window.DEFAULT_PROJECT = {
  version: 2,
  app: 'SimpleCAD',
  room: {
    name: 'Estúdio Demo (360×420 cm)',
    w: 360,
    h: 420,
    wallThickness: 14,
    doors: [
      { id: 'door-1', name: 'Porta Principal', wall: 'bottom', offset: 25, width: 90, hinge: 'left', swing: 'inward' }
    ],
    windows: [
      { id: 'win-1', name: 'Janela Ampla', wall: 'top', offset: 90, width: 180 }
    ],
    outlets: [
      { id: 'T1', name: 'T1', wall: 'left',  pos: 70,  x: 0,   y: 70 },
      { id: 'T2', name: 'T2', wall: 'left',  pos: 320, x: 0,   y: 320 },
      { id: 'T3', name: 'T3', wall: 'top',   pos: 300, x: 300, y: 0 },
      { id: 'T4', name: 'T4', wall: 'right', pos: 180, x: 360, y: 180 }
    ]
  },
  cables: [
    {
      id: 'cable-demo',
      name: 'Cabo DisplayPort (Workstation ↔ Monitor/TV)',
      fromId: 'pc',
      toId: 'tv',
      maxMeters: 3.5,
      warnMeters: 3.0,
      routingMode: 'wall',
      color: '#6e9887',
      visible: true
    }
  ],
  catalog: [
    { id: 'cama',       name: 'Cama de Casal',        type: 'bed',        w: 200, h: 150, zHeight: 45,  color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'cabeceira',  name: 'Mesa de Cabeceira',    type: 'nightstand', w: 50,  h: 40,  zHeight: 55,  color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'divisoria',  name: 'Divisória Articulada', type: 'divider',    w: 160, h: 4,   zHeight: 180, foldAngles: [14, -18, 14], color: 'zinc', ignoreCollision: false, lockedDims: false, visible: true, adjustable: true },
    { id: 'secretaria', name: 'Secretária Studio',    type: 'desk',       w: 140, h: 65,  zHeight: 75,  color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'cadeira',    name: 'Cadeira Ergonómica',   type: 'chair',      w: 55,  h: 55,  zHeight: 85,  color: 'amber',   ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'tv',         name: 'Móvel TV & Monitor',   type: 'tv',         w: 120, h: 30,  zHeight: 45,  color: 'sky',     ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'pc',         name: 'Workstation',          type: 'pc',         w: 60,  h: 30,  zHeight: 60,  color: 'emerald', ignoreCollision: false, lockedDims: false, visible: true },
    { id: 'estante',    name: 'Estante Arquitetura',  type: 'shelf',      w: 80,  h: 35,  zHeight: 160, color: 'zinc',    ignoreCollision: false, lockedDims: false, visible: true }
  ],
  activeLayoutId: 'opt1',
  layouts: [
    {
      id: 'opt1',
      name: 'Estúdio & Lounge (Recomendado)',
      builtIn: true,
      placements: {
        cabeceira:  { minX: 0,   minY: 16,  rot: 0,   w: 50,  h: 40,  zHeight: 55,  visible: true },
        cama:       { minX: 0,   minY: 62,  rot: 0,   w: 200, h: 150, zHeight: 45,  visible: true },
        tv:         { minX: 330, minY: 75,  rot: 90,  w: 120, h: 30,  zHeight: 45,  visible: true },
        divisoria:  { minX: 0,   minY: 232, rot: 0,   w: 160, h: 4,   zHeight: 180, visible: true },
        secretaria: { minX: 160, minY: 270, rot: 0,   w: 140, h: 65,  zHeight: 75,  visible: true },
        cadeira:    { minX: 203, minY: 342, rot: 180, w: 55,  h: 55,  zHeight: 85,  visible: true },
        pc:         { minX: 330, minY: 245, rot: 90,  w: 60,  h: 30,  zHeight: 60,  visible: true },
        estante:    { minX: 280, minY: 385, rot: 0,   w: 80,  h: 35,  zHeight: 160, visible: true }
      }
    },
    {
      id: 'opt2',
      name: 'Suite Simétrica (Alternativo)',
      builtIn: true,
      placements: {
        cabeceira:  { minX: 310, minY: 16,  rot: 0,   w: 50,  h: 40,  zHeight: 55,  visible: true },
        cama:       { minX: 160, minY: 62,  rot: 180, w: 200, h: 150, zHeight: 45,  visible: true },
        tv:         { minX: 0,   minY: 75,  rot: 270, w: 120, h: 30,  zHeight: 45,  visible: true },
        divisoria:  { minX: 190, minY: 232, rot: 0,   w: 160, h: 4,   zHeight: 180, visible: true },
        secretaria: { minX: 160, minY: 268, rot: 0,   w: 140, h: 65,  zHeight: 75,  visible: true },
        cadeira:    { minX: 203, minY: 340, rot: 180, w: 55,  h: 55,  zHeight: 85,  visible: true },
        pc:         { minX: 0,   minY: 250, rot: 90,  w: 60,  h: 30,  zHeight: 60,  visible: true },
        estante:    { minX: 280, minY: 385, rot: 0,   w: 80,  h: 35,  zHeight: 160, visible: true }
      }
    }
  ]
};

/**
 * Parser 100% local e offline para transformar texto natural / ditado de voz
 * (ex: "Mesa cabeceira 45x40x55", "Secretária 1.20m x 60cm x 75cm", "Tapete 200 140")
 * num objeto CAD com L x P x A em cm, tipo visual e flag de colisão.
 */
window.parseQuickAddText = function parseQuickAddText(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) return null;

  function toCm(numStr, unit) {
    const val = parseFloat(String(numStr).replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) return null;
    const u = (unit || '').toLowerCase();
    if (u === 'm') return Math.round(val * 100);
    if (u === 'mm') return Math.round(val / 10);
    if (u === 'cm') return Math.round(val);
    // Sem unidade explícita: valores <= 5.0 (ex: 2 x 1.4) assumem metros no mobiliário
    if (val <= 5.0 && String(numStr).match(/[.,]/)) return Math.round(val * 100);
    if (val <= 3.5) return Math.round(val * 100);
    return Math.round(val);
  }

  // Padrão 1: 3 dimensões com separador explícito (x, ×, *, por, by)
  const rx3 = /(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*(?:[x×*]|\bpor\b|\bby\b)\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*(?:[x×*]|\bpor\b|\bby\b)\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?/i;
  // Padrão 2: 2 dimensões com separador explícito
  const rx2 = /(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*(?:[x×*]|\bpor\b|\bby\b)\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?/i;
  // Padrão 3: Sequência de 2 ou 3 números separados por espaços no final da frase
  const rxSpace = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s+(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?(?:\s+(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?)?\s*$/i;

  let w = null;
  let h = null;
  let zHeight = null;
  let matchedFrag = '';

  let m = input.match(rx3);
  if (m) {
    matchedFrag = m[0];
    w = toCm(m[1], m[2]);
    h = toCm(m[3], m[4]);
    zHeight = toCm(m[5], m[6]);
  } else {
    m = input.match(rx2);
    if (m) {
      matchedFrag = m[0];
      w = toCm(m[1], m[2]);
      h = toCm(m[3], m[4]);
    } else {
      m = input.match(rxSpace);
      if (m) {
        matchedFrag = m[0];
        w = toCm(m[1], m[2]);
        h = toCm(m[3], m[4]);
        if (m[5]) zHeight = toCm(m[5], m[6]);
      }
    }
  }

  // Limpa o nome removendo a porção das dimensões e preposições finais soltas
  let cleanName = input;
  if (matchedFrag) {
    cleanName = cleanName.replace(matchedFrag, ' ');
  }
  cleanName = cleanName
    .replace(/\b(?:com|de|da|do|para|medidas?|largura|profundidade|altura)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanName.length < 2) cleanName = 'Móvel Novo';
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const lower = input.toLowerCase();
  // Normaliza acentos (NFD) para que fronteiras \b funcionem em "sofá", "divã", "tripé", "árvore", etc.
  const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let type = 'box';
  let color = 'zinc';
  let ignoreCollision = false;
  let defaultZ = 75;
  let defaultW = 60;
  let defaultH = 45;

  if (/\b(cabeceira|comoda|camiseiro|sapateira|gaveteiro|criado-?mudo)\b/i.test(norm)) {
    type = 'nightstand'; color = 'zinc'; defaultW = 50; defaultH = 40; defaultZ = 55;
  } else if (/\b(cama|colchao|beliche|sommier)\b/i.test(norm)) {
    type = 'bed'; defaultW = 200; defaultH = 140; defaultZ = 45;
  } else if (/\b(cadeira|poltrona|banqueta|banco)\b/i.test(norm)) {
    type = 'chair'; color = 'amber'; defaultW = 52; defaultH = 52; defaultZ = 85;
  } else if (/\b(sofa|chaise|diva|puff|pufe|otomana)\b/i.test(norm)) {
    type = 'sofa'; color = 'violet';
    if (/\b(puff|pufe|otomana)\b/i.test(norm)) {
      defaultW = 45; defaultH = 45; defaultZ = 42;
    } else {
      defaultW = 160; defaultH = 80; defaultZ = 78;
    }
  } else if (/\b(mesa|secretaria|escrivaninha|bancada|ilha)\b/i.test(norm)) {
    type = 'desk'; defaultW = 120; defaultH = 60; defaultZ = 75;
  } else if (/\b(tv|televisao|televisor|consola|soundbar|monitor)\b/i.test(norm)) {
    type = 'tv'; color = 'sky'; defaultW = 100; defaultH = 30; defaultZ = 45;
  } else if (/\b(armario|roupeiro|closet|guarda-?fatos|aparador)\b/i.test(norm)) {
    type = 'wardrobe'; defaultW = 110; defaultH = 55; defaultZ = 200;
  } else if (/\b(estante|prateleira|livreiro|cubo|kallax|nicho)\b/i.test(norm)) {
    type = 'shelf'; defaultW = 60; defaultH = 35; defaultZ = 140;
    if (/\b(parede|suspensa|alta|aerea)\b/i.test(norm)) ignoreCollision = true;
  } else if (/\b(divisoria|painel|biombo|ripad[ao])\b/i.test(norm)) {
    type = 'divider'; defaultW = 145; defaultH = 5; defaultZ = 180;
  } else if (/\b(pc|computador|desktop|torre|gabinete|servidor)\b/i.test(norm)) {
    type = 'pc'; color = 'emerald'; defaultW = 60; defaultH = 30; defaultZ = 60;
  } else if (/\b(espelho|quadro|tela|poster)\b/i.test(norm)) {
    type = 'mirror'; color = 'sky'; defaultW = 55; defaultH = 8; defaultZ = 165;
  } else if (/\b(cavalete|tripe)\b/i.test(norm)) {
    type = 'easel'; color = 'amber'; defaultW = 60; defaultH = 45; defaultZ = 160;
  } else if (/\b(candeeiro|luminaria|abajur|led)\b/i.test(norm)) {
    type = 'lamp'; color = 'amber'; defaultW = 36; defaultH = 36; defaultZ = 155;
  } else if (/\b(tapete|alcatifa|passadeira)\b/i.test(norm)) {
    type = 'rug'; color = 'violet'; ignoreCollision = true; defaultW = 160; defaultH = 110; defaultZ = 1;
  } else if (/\b(planta|vaso|floreira|arvore)\b/i.test(norm)) {
    type = 'plant'; color = 'emerald'; defaultW = 40; defaultH = 40; defaultZ = 95;
  } else if (/\b(frigorifico|mini-?bar|ar condicionado|ac|aquecedor|radiador|desumidificador|ventoinha|cesto|eletrodomestico)\b/i.test(norm)) {
    type = 'appliance'; color = 'zinc'; defaultW = 50; defaultH = 48; defaultZ = 85;
  }

  return {
    name: cleanName,
    type,
    color,
    ignoreCollision,
    w: Math.max(4, Math.min(600, w || defaultW)),
    h: Math.max(4, Math.min(600, h || defaultH)),
    zHeight: Math.max(1, Math.min(350, zHeight || defaultZ)),
    hasParsedDims: Boolean(w && h)
  };
};
