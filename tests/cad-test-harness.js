/**
 * SimpleCAD Test Harness
 * Synthetic checks using a canvas spy, source/document inspection, and
 * separately implemented geometry. This harness does not execute app.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Workspace root directory
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// 1. HEADLESS CANVAS 2D CONTEXT SPY
// ============================================================================
class MockCanvas2D {
  constructor(width = 800, height = 600) {
    this.canvas = { width, height };
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.calls = [];
    this._stack = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this._lineDash = [];
  }

  _record(method, args) {
    this.calls.push({
      method,
      args: Array.from(args),
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      globalAlpha: this.globalAlpha
    });
  }

  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      font: this.font,
      globalAlpha: this.globalAlpha,
      lineDash: [...this._lineDash]
    });
    this._record('save', arguments);
  }

  restore() {
    if (this._stack.length > 0) {
      const s = this._stack.pop();
      Object.assign(this, s);
    }
    this._record('restore', arguments);
  }

  beginPath() { this._record('beginPath', arguments); }
  closePath() { this._record('closePath', arguments); }
  moveTo(x, y) { this._record('moveTo', arguments); }
  lineTo(x, y) { this._record('lineTo', arguments); }
  rect(x, y, w, h) { this._record('rect', arguments); }
  fillRect(x, y, w, h) { this._record('fillRect', arguments); }
  strokeRect(x, y, w, h) { this._record('strokeRect', arguments); }
  clearRect(x, y, w, h) { this._record('clearRect', arguments); }
  arc(x, y, r, sa, ea, acw) { this._record('arc', arguments); }
  ellipse(x, y, rx, ry, rot, sa, ea, acw) { this._record('ellipse', arguments); }
  fill() { this._record('fill', arguments); }
  stroke() { this._record('stroke', arguments); }
  clip() { this._record('clip', arguments); }

  translate(x, y) { this._record('translate', arguments); }
  rotate(rad) { this._record('rotate', arguments); }
  scale(sx, sy) { this._record('scale', arguments); }

  setLineDash(segments) {
    this._lineDash = Array.isArray(segments) ? [...segments] : [];
    this._record('setLineDash', arguments);
  }
  getLineDash() { return [...this._lineDash]; }

  fillText(text, x, y, maxW) { this._record('fillText', arguments); }
  strokeText(text, x, y, maxW) { this._record('strokeText', arguments); }
  measureText(text) {
    const str = String(text ?? '');
    return { width: str.length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
  }

  createPattern(image, repetition) {
    this._record('createPattern', arguments);
    return { __isPattern: true, repetition, image };
  }

  createLinearGradient(x0, y0, x1, y1) {
    this._record('createLinearGradient', arguments);
    return {
      __isGradient: true,
      stops: [],
      addColorStop(offset, color) { this.stops.push({ offset, color }); }
    };
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    this._record('createRadialGradient', arguments);
    return {
      __isGradient: true,
      stops: [],
      addColorStop(offset, color) { this.stops.push({ offset, color }); }
    };
  }

  drawImage() { this._record('drawImage', arguments); }
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
  putImageData() { this._record('putImageData', arguments); }

  // Query helpers
  getCalls(methodName) {
    return this.calls.filter(c => c.method === methodName);
  }

  hasCall(methodName) {
    return this.calls.some(c => c.method === methodName);
  }

  hasStrokeWithWidth(targetWidth, tolerance = 0.1) {
    return this.calls.some(c => (c.method === 'stroke' || c.method === 'strokeRect') && Math.abs(c.lineWidth - targetWidth) <= tolerance);
  }

  hasFillStyle(colorOrPattern) {
    return this.calls.some(c => c.fillStyle === colorOrPattern || (c.fillStyle && c.fillStyle.__isPattern));
  }
}

// ============================================================================
// 2. CSS INSPECTOR
// ============================================================================
class CSSInspector {
  constructor(filePath = path.join(ROOT_DIR, 'styles.css')) {
    this.rawContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    this.variables = this._parseVariables();
  }

  _parseVariables() {
    const vars = {};
    const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(this.rawContent)) !== null) {
      vars['--' + match[1]] = match[2].trim();
    }
    return vars;
  }

  getVar(varName) {
    return this.variables[varName] || null;
  }

  hasVar(varName, expectedValuePattern = null) {
    const val = this.getVar(varName);
    if (!val) return false;
    if (!expectedValuePattern) return true;
    if (expectedValuePattern instanceof RegExp) return expectedValuePattern.test(val);
    return val.toLowerCase().includes(String(expectedValuePattern).toLowerCase());
  }

  hasSelector(selector) {
    const escaped = selector.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\}|\\{)\\s*${escaped}\\s*\\{`, 'm');
    return regex.test(this.rawContent);
  }

  contains(pattern) {
    if (pattern instanceof RegExp) return pattern.test(this.rawContent);
    return this.rawContent.includes(pattern);
  }
}

// ============================================================================
// 3. DOCUMENT AUDITOR
// ============================================================================
class DocAuditor {
  constructor(relativePath) {
    this.fullPath = path.join(ROOT_DIR, relativePath);
    this.exists = fs.existsSync(this.fullPath);
    this.content = this.exists ? fs.readFileSync(this.fullPath, 'utf8') : '';
  }

  hasHeading(level, titlePattern) {
    if (!this.exists) return false;
    const hashes = '#'.repeat(level);
    const regex = new RegExp(`^${hashes}\\s+.*${titlePattern instanceof RegExp ? titlePattern.source : titlePattern}`, 'im');
    return regex.test(this.content);
  }

  contains(pattern) {
    if (!this.exists) return false;
    if (pattern instanceof RegExp) return pattern.test(this.content);
    return this.content.includes(pattern);
  }

  extractNumbers(pattern) {
    if (!this.exists) return [];
    const matches = [];
    const regex = new RegExp(pattern, 'g');
    let m;
    while ((m = regex.exec(this.content)) !== null) {
      matches.push(m);
    }
    return matches;
  }
}

// ============================================================================
// 4. SAT COLLISION & GEOMETRY VERIFICATION ENGINE
// ============================================================================
const GeometryEngine = {
  degToRad(deg) {
    return (deg * Math.PI) / 180;
  },

  getItemPolygon(item) {
    const rot = (item.rot || 0) % 360;
    const w = item.w;
    const h = item.h;
    const minX = item.x !== undefined ? item.x : (item.minX || 0);
    const minY = item.y !== undefined ? item.y : (item.minY || 0);

    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const rad = this.degToRad(rot);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const halfW = w / 2;
    const halfH = h / 2;
    const local = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ];

    return local.map(p => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos
    }));
  },

  projectPolygon(axis, poly) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of poly) {
      const dot = p.x * axis.x + p.y * axis.y;
      if (dot < min) min = dot;
      if (dot > max) max = dot;
    }
    return { min, max };
  },

  polygonsIntersect(polyA, polyB) {
    const polys = [polyA, polyB];
    for (let i = 0; i < polys.length; i++) {
      const p = polys[i];
      for (let j = 0; j < p.length; j++) {
        const k = (j + 1) % p.length;
        const edge = { x: p[k].x - p[j].x, y: p[k].y - p[j].y };
        const len = Math.hypot(edge.x, edge.y);
        if (len === 0) continue;
        const axis = { x: -edge.y / len, y: edge.x / len };

        const projA = this.projectPolygon(axis, polyA);
        const projB = this.projectPolygon(axis, polyB);
        if (projA.max < projB.min || projB.max < projA.min) {
          return false;
        }
      }
    }
    return true;
  },

  // 3-Tone Cel Shading calculation
  compute3ToneCelShading(normal, sunVector = { x: 0.577, y: -0.577, z: 0.577 }) {
    // Normalize sun vector
    const lenL = Math.hypot(sunVector.x, sunVector.y, sunVector.z) || 1;
    const L = { x: sunVector.x / lenL, y: sunVector.y / lenL, z: sunVector.z / lenL };

    // Normalize normal
    const lenN = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const N = { x: normal.x / lenN, y: normal.y / lenN, z: normal.z / lenN };

    const dot = N.x * L.x + N.y * L.y + N.z * L.z;

    // 3-tone quantization
    if (dot > 0.45) return { tone: 'sunlight', dot, factor: 1.15 };
    if (dot > -0.15) return { tone: 'midtone', dot, factor: 0.95 };
    return { tone: 'shadow', dot, factor: 0.65 };
  },

  // 2D Poché double-line calculation
  computeWallPocheBounds(room) {
    const t = room.wallThickness || 14;
    return {
      outer: { x: -t, y: -t, w: room.w + 2 * t, h: room.h + 2 * t },
      inner: { x: 0, y: 0, w: room.w, h: room.h },
      thickness: t
    };
  }
};

// ============================================================================
// 5. TEST RUNNER & ASSERTION ENGINE
// ============================================================================
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.currentSuite = 'General';
  }

  suite(name) {
    this.currentSuite = name;
  }

  test(id, title, fn) {
    this.tests.push({
      id,
      suite: this.currentSuite,
      title,
      fn
    });
  }

  async run(filterOptions = {}) {
    const { tier = null, feature = null } = filterOptions;
    this.results = [];

    const startTime = Date.now();

    for (const t of this.tests) {
      if (tier && !t.id.startsWith(`T${tier}.`)) continue;
      if (feature && !t.id.includes(`.${feature}.`)) continue;

      const tStart = Date.now();
      try {
        await t.fn();
        this.results.push({
          id: t.id,
          suite: t.suite,
          title: t.title,
          status: 'pass',
          durationMs: Date.now() - tStart,
          error: null
        });
      } catch (err) {
        this.results.push({
          id: t.id,
          suite: t.suite,
          title: t.title,
          status: 'fail',
          durationMs: Date.now() - tStart,
          error: err
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;

    return {
      total: this.results.length,
      passed,
      failed,
      durationMs,
      results: this.results
    };
  }

  printReport(summary) {
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';

    console.log(`\n${bold}${cyan}================================================================================${reset}`);
    console.log(`${bold}${cyan} SIMPLECAD SYNTHETIC CHECKS — NOT APP E2E VERIFICATION${reset}`);
    console.log('Scope: mocked drawing, separate geometry, and source/document inspection; app.js is not executed.');
    console.log(`${bold}${cyan}================================================================================${reset}\n`);

    let currentSuite = '';
    for (const r of summary.results) {
      if (r.suite !== currentSuite) {
        currentSuite = r.suite;
        console.log(`\n${bold}${yellow}▸ [${currentSuite}]${reset}`);
      }

      if (r.status === 'pass') {
        console.log(`  ${green}✓ PASS${reset}  ${dim}${r.id.padEnd(8)}${reset} ${r.title} ${dim}(${r.durationMs}ms)${reset}`);
      } else {
        console.log(`  ${red}✗ FAIL${reset}  ${bold}${r.id.padEnd(8)}${reset} ${r.title}`);
        console.log(`         ${red}${r.error ? (r.error.stack || r.error.message) : 'Unknown error'}${reset}`);
      }
    }

    console.log(`\n${bold}${cyan}--------------------------------------------------------------------------------${reset}`);
    console.log(`${bold}SUMMARY STATISTICS:${reset}`);
    console.log(`  Total Assertions Executed : ${bold}${summary.total}${reset}`);
    console.log(`  Passed                    : ${green}${bold}${summary.passed}${reset}`);
    console.log(`  Failed                    : ${summary.failed > 0 ? red : green}${bold}${summary.failed}${reset}`);
    console.log(`  Total Suite Duration      : ${summary.durationMs} ms`);
    console.log(`${bold}${cyan}================================================================================${reset}\n`);

    if (summary.failed === 0) {
      console.log(`${green}${bold}>>> ALL TEST TIERS AND VERIFICATION CRITERIA PASSED (Exit Code: 0) <<<${reset}\n`);
    } else {
      console.log(`${red}${bold}>>> TEST VERIFICATION DETECTED ${summary.failed} FAILURE(S) (Exit Code: 1) <<<${reset}\n`);
    }
  }
}

// Fluent expect assertions
function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to deep-equal ${JSON.stringify(expected)}`);
    },
    toBeTruthy() {
      assert.ok(Boolean(actual), `Expected ${JSON.stringify(actual)} to be truthy`);
    },
    toBeFalsy() {
      assert.ok(!Boolean(actual), `Expected ${JSON.stringify(actual)} to be falsy`);
    },
    toBeGreaterThan(expected) {
      assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected) {
      assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(actual <= expected, `Expected ${actual} <= ${expected}`);
    },
    toBeCloseTo(expected, delta = 0.001) {
      assert.ok(Math.abs(actual - expected) <= delta, `Expected ${actual} close to ${expected} (+/- ${delta})`);
    },
    toContain(item) {
      if (typeof actual === 'string') {
        assert.ok(actual.includes(item), `Expected "${actual}" to contain "${item}"`);
      } else if (Array.isArray(actual)) {
        assert.ok(actual.includes(item), `Expected array to contain ${JSON.stringify(item)}`);
      } else {
        assert.ok(item in actual, `Expected object to contain key ${item}`);
      }
    },
    toMatch(regex) {
      assert.ok(regex.test(String(actual)), `Expected "${actual}" to match ${regex}`);
    },
    toThrow(regex = null) {
      assert.throws(actual, regex);
    }
  };
}

module.exports = {
  ROOT_DIR,
  MockCanvas2D,
  CSSInspector,
  DocAuditor,
  GeometryEngine,
  TestRunner,
  expect
};
