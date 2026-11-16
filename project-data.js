/* Validation shared by file imports and persisted projects. No state is changed here. */
(() => {
  'use strict';

  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const walls = new Set(['top', 'bottom', 'left', 'right']);
  const reservedIds = new Set(['__proto__', 'prototype', 'constructor']);

  function fail(label) {
    throw new Error(`Dados inválidos em ${label}. O projeto atual não foi alterado.`);
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label);
  }

  function text(value, label) {
    if (typeof value !== 'string') fail(label);
  }

  function number(value, label, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(label);
  }

  function id(value, label) {
    text(value, label);
    if (!value || reservedIds.has(value)) fail(label);
  }

  function entries(value, label) {
    if (!Array.isArray(value)) fail(label);
    const ids = new Set();
    for (const entry of value) {
      object(entry, label);
      id(entry.id, `${label}: identificador`);
      if (ids.has(entry.id)) fail(`${label}: identificador repetido`);
      ids.add(entry.id);
    }
    return value;
  }

  function folds(value, label) {
    if (!Array.isArray(value) || value.length !== 3) fail(label);
    value.forEach(angle => number(angle, label, -135, 135));
  }

  function assertCompatible(project) {
    object(project, 'projeto');
    if (owns(project, 'version') && ![1, 2].includes(project.version)) {
      throw new Error('Versão de projeto não suportada. Abre o ficheiro na aplicação que o criou; o projeto atual foi mantido.');
    }
    if (['buildings', 'layers', 'wallGraph', 'storeys', 'spaces'].some(key => owns(project, key))) {
      throw new Error('Este ficheiro contém edifícios, divisões ou camadas ainda não suportados. O projeto atual foi mantido.');
    }
    if (!['room', 'items', 'furniture', 'catalog'].some(key => owns(project, key))) fail('projeto');
  }

  function validate(project) {
    assertCompatible(project);
    const room = project.room;
    object(room, 'quarto');
    text(room.name, 'nome do quarto');
    number(room.w, 'largura do quarto (100–2000 cm)', 100, 2000);
    number(room.h, 'profundidade do quarto (100–2000 cm)', 100, 2000);
    number(room.wallThickness, 'espessura da parede', 0, Math.min(room.w, room.h));
    for (const key of ['doors', 'windows', 'outlets']) {
      const label = { doors: 'portas', windows: 'janelas', outlets: 'tomadas' }[key];
      for (const opening of entries(room[key], label)) {
        if (!walls.has(opening.wall)) fail(`${label}: parede`);
        if (opening.name !== undefined) text(opening.name, `${label}: nome`);
        if (key === 'outlets') {
          number(opening.pos, 'posição da tomada', 0);
        } else {
          number(opening.offset, `${label}: posição`, 0);
          number(opening.width, `${label}: largura`, 0);
        }
      }
    }

    const endpointIds = new Set(room.outlets.map(outlet => outlet.id));
    for (const item of entries(project.items, 'móveis')) {
      if (endpointIds.has(item.id)) fail('identificador de móvel/tomada repetido');
      endpointIds.add(item.id);
      text(item.name, 'nome do móvel');
      text(item.type, 'tipo de móvel');
      if (!owns(window.COLOR_PALETTE, item.color)) fail('cor do móvel');
      number(item.w, 'largura do móvel', 4, 600);
      number(item.h, 'profundidade do móvel', 4, 600);
      number(item.zHeight, 'altura do móvel', 1, 350);
      for (const key of ['x', 'y', 'rot']) number(item[key], `móvel: ${key}`);
      if (item.type === 'divider') folds(item.foldAngles, 'articulação da divisória');
      if (item.photoDataUrl != null && (typeof item.photoDataUrl !== 'string' || !/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(item.photoDataUrl))) fail('fotografia do móvel');
    }

    for (const cable of entries(project.cables, 'cabos')) {
      text(cable.name, 'nome do cabo');
      text(cable.fromId, 'origem do cabo');
      text(cable.toId, 'destino do cabo');
      number(cable.maxMeters, 'comprimento do cabo', 0.3, 50);
      number(cable.warnMeters, 'aviso do cabo', 0, cable.maxMeters);
      if (!['direct', 'wall'].includes(cable.routingMode)) fail('percurso do cabo');
      if (cable.color !== undefined && (typeof cable.color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cable.color))) fail('cor do cabo');
    }

    const layouts = entries(project.layouts, 'disposições');
    if (!layouts.length || !layouts.some(layout => layout.id === project.activeLayoutId)) fail('disposição ativa');
    for (const layout of layouts) {
      text(layout.name, 'nome da disposição');
      object(layout.placements, 'posições da disposição');
      for (const [itemId, placement] of Object.entries(layout.placements)) {
        id(itemId, 'identificador na disposição');
        object(placement, 'posição na disposição');
        for (const key of ['cx', 'cy', 'minX', 'minY', 'rot']) {
          if (owns(placement, key)) number(placement[key], `disposição: ${key}`);
        }
        for (const key of ['w', 'h']) {
          if (owns(placement, key)) number(placement[key], `disposição: ${key}`, 4, 600);
        }
        if (owns(placement, 'zHeight')) number(placement.zHeight, 'altura na disposição', 1, 350);
        if (owns(placement, 'foldAngles')) folds(placement.foldAngles, 'articulação na disposição');
      }
    }
    if (![0, 1, 5].includes(project.gridStep)) fail('grelha');
    if (typeof project.wallSnap !== 'boolean') fail('encaixe na parede');
    if (!['solid', 'sketch'].includes(project.style3d)) fail('estilo');
    return project;
  }

  window.SimpleCADProjectData = Object.freeze({ assertCompatible, validate });
})();
