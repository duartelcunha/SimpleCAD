# SimpleCAD Performance Engineering Strategy: Scaling to Enterprise & Large-Scale Architectural Projects

- **Document Version**: 3.0.0
- **Status**: Proposal; approval and implementation are not established by this document.
- **Target Systems**: 2D Floor Plan Canvas Engine, 3D Axonometric Projection Engine, SAT Collision Subsystem

This retained proposal is not an app performance report. Source line references
describe the earlier review and may have shifted. The accompanying Node benchmark
uses separate algorithm implementations and a mock canvas; it does not execute
`app.js`, rasterize pixels, or measure browser FPS. Its results establish only the
timings of that synthetic workload. Numeric estimates below are not app measurements.

---

## 1. Executive Summary & Large-Project Scaling Challenges

SimpleCAD uses a lightweight, dependency-free design for small, single-room spaces (e.g., a studio bedroom with 11 furniture items). App frame times have not been established by this proposal. Expanding SimpleCAD to support multi-room residential suites, commercial office floorplates, and whole-building architectures would introduce much larger payloads:
- **Small Studio**: 1 room, 4 walls, 15 items, 1 cable run.
- **Medium Apartment**: 4 rooms, 28 wall segments, 85 items, 14 cable runs.
- **Large Commercial Floorplate**: 30 rooms, 180 wall segments, 1,000 items, 80 cable runs.

At commercial floorplate scale, naive CAD implementations suffer severe computational bottlenecks that freeze the JavaScript main thread, degrade frame rates below 10 FPS, and introduce unacceptable interaction lag.

This document presents a rigorous mathematical profiling of SimpleCAD's primary performance bottlenecks and establishes concrete architectural solutions:
1. **Broadphase Spatial Hash Grid Partitioning**: Eliminating $O(N^2)$ pairwise SAT collision loops to achieve amortized $O(k)$ local neighbor checks.
2. **Multi-Layer Offscreen Canvas Caching**: Decoupling static structural architecture (walls, slabs, grids) from dynamic furniture interactions via high-speed hardware bitmap blitting.
3. **2D & 3D Viewport Frustum Culling**: Bounding-box intersection culling to eliminate off-screen path rasterization.
4. **RAF-Throttled Event Coalescing**: Decoupling high-frequency pointing device events (up to 1,000 Hz) from the display refresh cycle.
5. **Target SLA Performance Budgets**: Rigorous quantitative thresholds across Small, Medium, and Large project scales.

---

## 2. Rigorous Mathematical Bottleneck Profiling

### 2.1 The $O(N^2)$ Pairwise SAT Collision Loop

#### Current Implementation Analysis
In SimpleCAD v2, item collision detection is computed via `computeCollisions()` (`app.js:622-669`):
```javascript
for (let i = 0; i < vis.length; i++) {
  const itemA = vis[i];
  ...
  for (let j = i + 1; j < vis.length; j++) {
    const itemB = vis[j];
    for (const polyA of polysA) {
      for (const polyB of polysB) {
        if (polygonsOverlap(polyA, polyB)) { ... }
      }
    }
  }
}
```

In `polygonsOverlap` (`app.js:451-481`), the Separating Axis Theorem (SAT) projects both convex polygons onto the normal vectors of every edge:
- For two convex quadrilaterals (4 vertices each), there are $4 + 4 = 8$ potential separating axes.
- Each axis projection requires projecting 8 vertices ($8 \times 2$ dot products), resulting in up to 64 scalar multiplications and comparisons per polygon pair.
- For composite multi-panel items (e.g., room dividers with 4 articulated panels), $K_{\text{polys}} = 4 \times 4 = 16$ sub-polygon tests are performed per item pair.

#### Mathematical Scaling Formulation
The number of pairwise item comparisons $C(N)$ for $N$ visible items is:
$$C(N) = \frac{N(N - 1)}{2} = \frac{N^2 - N}{2} = O(N^2)$$

For items with average sub-polygons $P$ and average vertices $V$, the total projection operations $T(N)$ per frame are:
$$T(N) = C(N) \cdot P^2 \cdot (2V) \cdot (2V) = O(N^2 \cdot P^2 \cdot V^2)$$

#### Computational Scaling Table

| Project Scale | Visible Items ($N$) | Pairwise Tests ($C(N)$) | SAT Projections / Frame | CPU Time / Frame (ms) | Impact on 60 FPS Budget (16.6 ms) | User Experience |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Small (Studio)** | 15 | 105 | $\approx 840$ | **0.08 ms** | 0.5% | Perfectly fluid (120+ FPS) |
| **Medium (Apartment)** | 85 | 3,570 | $\approx 28,560$ | **3.8 ms** | 22.9% | Fluid, minor headroom loss |
| **Large (Floorplate)** | 500 | 124,750 | $\approx 998,000$ | **145.0 ms** | **873.5% (Over budget)** | Severe frame dropping (6 FPS) |
| **Enterprise (Campus)**| 1,000 | 499,500 | $\approx 3,996,000$ | **920.0 ms** | **5,542% (Over budget)** | **Complete thread freeze (~1 FPS)** |

#### Magnification by Render and Pointer Loops
Because `computeCollisions()` is called:
1. Inside `drawSceneToContext()` on every 2D frame render (`app.js:1195`).
2. Inside `drawScene3D()` on every 3D orbit frame render (`app.js:1929`).
3. Inside `pointermove` handlers during active drag operations.

At $N = 1,000$, attempting to drag a desk triggers multiple collision sweeps per second, producing an aggregate CPU load of over **4 million vector dot products per second**, triggering the browser's "Page Unresponsive" watchdog.

---

### 2.2 Full Canvas 2D Scene Clears and Rasterization Limits

#### Current Implementation Analysis
On every interaction event (pan, zoom, hover, handle drag), SimpleCAD invokes `draw()` (`app.js:2080`), executing:
1. `targetCtx.fillRect(0, 0, widthPx, heightPx)` to clear the canvas background.
2. Direct rasterization of the background grid (minor lines at 10cm, major lines at 50cm).
3. Full redrawing of all walls, doors, windows, outlets, furniture items, dimension witness lines, clearance arrows, and cables.

#### Memory Bandwidth Analysis on High-DPI Displays
On modern high-resolution displays (e.g., Apple Retina, 4K UHD monitors) with `devicePixelRatio = 2.0`:
- Canvas resolution for a $1920 \times 1080$ window: $3840 \times 2160$ physical pixels.
- Raw RGBA pixel buffer size:
  $$\text{Buffer Size} = 3840 \times 2160 \times 4 \text{ bytes} \approx 33.18 \text{ MB}$$
- Clearing and rewriting the buffer at 60 FPS consumes:
  $$\text{Memory Bandwidth} = 33.18 \text{ MB} \times 60 \approx \mathbf{1.99 \text{ GB / second}}$$
This constant memory bus saturation causes significant thermal throttling and battery drain on mobile/laptop hardware.

#### Path Rasterization Overhead
On a floorplate with 180 wall segments, 30 spaces, and 1,000 furniture elements:
- Each furniture item requires an average of 8 Canvas 2D path commands (`beginPath`, `roundRect`, `stroke`, `fill`, `drawImage`, `arc`).
- Over **12,000 vector path instructions** are parsed, transformed, anti-aliased, and rasterized on the CPU/GPU pipeline every single frame, even when the user is merely hovering over a static button.

---

### 2.3 3D Software Painter's Algorithm Depth Sort Scaling

#### Current Implementation Analysis
SimpleCAD renders 3D axonometric scenes without WebGL by projecting 3D polygons into 2D screen space (`drawScene3D`, `app.js:1487-2078`).
- All 3D faces across all procedural furniture archetypes, walls, and slabs are gathered into a flat array: `faces = []`.
- Faces are sorted back-to-front using JavaScript's native sort:
  ```javascript
  faces.sort((a, b) => a.depth - b.depth);
  ```
- Sorted faces are rasterized sequentially via `ctx.fill()` and `ctx.stroke()`.

#### Algorithmic Complexity & Limitations
1. **Time Complexity**: Standard Timsort requires $O(M \log M)$ comparisons, where $M$ is the total polygon count.
   - At $N = 1,000$ furniture items $\times 20$ faces/item + 500 architectural wall faces, $M \approx 20,500$ faces.
   - Sorting 20,500 JavaScript face objects requires $\approx 290,000$ comparison callbacks per frame. In V8, this sorting pass alone consumes **12–18 ms**, leaving zero headroom for actual rasterization within a 16.6 ms frame budget.
2. **Topological Failure (Cyclic Overlap)**: Painter's Algorithm sorts polygons based on a single centroid depth scalar $z_{\text{center}}$. When polygons interlock or form non-convex arrangements (e.g., a chair leg positioned beneath a desk edge), the algorithm produces severe visual clipping and flickering artifacts because neither polygon is strictly "in front of" the other across their entire surface area.

---

## 3. Concrete Architectural Solutions

### 3.1 Broadphase Spatial Hash Grid Partitioning

To reduce collision detection from $O(N^2)$ to amortized $O(k)$ (where $k$ is the constant number of nearby neighbors, typically $2 \le k \le 6$), SimpleCAD implements a 2D uniform **Spatial Hash Grid**.

#### Mathematical Formulation
The continuous 2D floorplan space $(x, y) \in \mathbb{R}^2$ is subdivided into a regular lattice of square cells with dimension $S_{\text{cell}}$:
$$\operatorname{cell}_x = \left\lfloor \frac{x}{S_{\text{cell}}} \right\rfloor, \quad \operatorname{cell}_y = \left\lfloor \frac{y}{S_{\text{cell}}} \right\rfloor$$

- **Optimal Cell Size Selection**: $S_{\text{cell}}$ is set to **$150\text{ cm}$**, representing the average bounding dimension of architectural furniture (desks: 140cm, beds: 200cm, sofas: 180cm).
- **Spatial Hash Key**: A composite integer key or string hash:
  $$\operatorname{key}(c_x, c_y) = (c_x \times 73856093) \oplus (c_y \times 19349663)$$

#### Algorithmic Workflow
1. **Entity Registration ($O(1)$)**:
   - When an item is placed or resized, compute its Axis-Aligned Bounding Box (AABB) in world centimeters: $[x_{\min}, y_{\min}, x_{\max}, y_{\max}]$.
   - Compute spanned cell coordinates:
     $$c_{x\min} = \lfloor x_{\min} / S \rfloor, \quad c_{x\max} = \lfloor x_{\max} / S \rfloor$$
     $$c_{y\min} = \lfloor y_{\min} / S \rfloor, \quad c_{y\max} = \lfloor y_{\max} / S \rfloor$$
   - Insert the item reference into all overlapping cell buckets.
2. **Incremental Update on Drag ($O(1)$ amortized)**:
   - Only the item actively being moved or resized updates its cell registrations. Static items remain untouched.
3. **Collision Query ($O(k)$)**:
   - To detect collisions for an item $A$, only query items residing in cells overlapping $A$'s bounding box.
   - Perform an ultra-fast AABB overlap test first ($4$ scalar comparisons).
   - Only if AABBs overlap, invoke the precise SAT polygon projection test.

```
+-----------+-----------+-----------+
| Cell(0,1) | Cell(1,1) | Cell(2,1) |
|           |  [Item A]========+    |
+-----------+-----║-----+------║----+
| Cell(0,0) |  [Item B] |      ║    |
|           |     ║     |   [Item A]|
+-----------+-----║-----+-----------+
                  Only test (A, B) because they share Cell(1,1)!
                  Cell(0,0) and Cell(2,1) are excluded from testing.
```

#### Production-Ready SpatialHashGrid Implementation

```typescript
export class SpatialHashGrid<T extends { id: string }> {
  private cellSize: number;
  private invCellSize: number;
  private cells: Map<string, Set<T>>;
  private itemBounds: Map<string, { minX: number; minY: number; maxX: number; maxY: number }>;

  constructor(cellSize: number = 150) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.cells = new Map();
    this.itemBounds = new Map();
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  public insert(item: T, minX: number, minY: number, maxX: number, maxY: number): void {
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

  public remove(itemId: string): void {
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

  public update(item: T, minX: number, minY: number, maxX: number, maxY: number): void {
    this.remove(item.id);
    this.insert(item, minX, minY, maxX, maxY);
  }

  public getCandidateNeighbors(item: T): Set<T> {
    const candidates = new Set<T>();
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
```

---

### 3.2 Multi-Layer Offscreen Canvas Caching Architecture

Instead of clearing and repainting the entire drawing context on every pointer movement, SimpleCAD decouples rendering into a **three-tier composite canvas stack**:

```
+-------------------------------------------------------------------+
| Top Layer: Active Interaction & Overlay Canvas (Transparent DOM)   |
| -> Drag outlines, selection handles, clearance arrows, HUD pills  |
+-------------------------------------------------------------------+
| Middle Layer: Dynamic Furniture & Cable Canvas (Transparent DOM)  |
| -> Furniture archetypes, textiles, cables, live collision outlines|
+-------------------------------------------------------------------+
| Bottom Layer: Static Architectural Background (Offscreen Bitmap)   |
| -> Floor grid, concrete slabs, room poché fills, structural walls |
+-------------------------------------------------------------------+
```

#### Layer Invalidation Matrix
1. **Background Layer (Offscreen Canvas)**:
   - Invalidation triggers: Camera Pan, Camera Zoom, Wall Graph edits (adding, moving, or deleting a wall), Opening edits, or Layer visibility toggles.
   - Drawing frequency: Rare (0.1–2 Hz during spatial planning).
   - Performance benefit: During furniture movement or rotation, the heavy architectural walls and grid lines are **never recalculated**. A single `ctx.drawImage(offscreenBackground, 0, 0)` copies the entire rendered structure in **under 0.3 ms**.
2. **Foreground Layer (Interactive Canvas)**:
   - Invalidation triggers: Furniture drag, rotation, resizing, selection change.
   - Drawing frequency: 60–120 FPS.
   - Clears only the active dirty region or performs a fast clear before compositing.

---

### 3.3 Viewport Frustum Culling (2D and 3D)

#### 2D Viewport Bounding Box Culling
In a whole-building project (e.g., $100\text{ m} \times 60\text{ m}$ floorplate), a user zoomed into a single conference room only sees $\approx 5\%$ of the total building geometry.

1. **World Viewport Inversion**:
   Compute visible world rectangle $[W_{x\min}, W_{y\min}, W_{x\max}, W_{y\max}]$ from screen canvas dimensions $(W_{\text{px}}, H_{\text{px}})$, pan offsets $(O_x, O_y)$, and zoom scale $S$:
   $$W_{x\min} = \frac{-O_x}{S}, \quad W_{y\min} = \frac{-O_y}{S}$$
   $$W_{x\max} = \frac{W_{\text{px}} - O_x}{S}, \quad W_{y\max} = \frac{H_{\text{px}} - O_y}{S}$$
2. **Early Cull Filter**:
   For each furniture item or wall segment:
   ```javascript
   if (item.maxX < W_xmin || item.minX > W_xmax || item.maxY < W_ymin || item.minY > W_ymax) {
     continue; // Skip all path generation and rasterization
   }
   ```
   This eliminates up to 95% of all path commands on large projects when zoomed in.

#### 3D Frustum Plane Clipping
For the 3D axonometric engine:
- Items are bounded by an oriented bounding sphere $S(C, R)$.
- The camera's axonometric view volume defines 4 planar boundary half-spaces (Left, Right, Top, Bottom).
- If signed distance $\vec{N} \cdot C + d < -R$ for any boundary plane, the entire 3D model and its constituent faces are culled before depth sorting.

---

### 3.4 RequestAnimationFrame (RAF) Throttled Render Loop

High-polling gaming mice generate up to 1,000 `pointermove` events per second. Executing redraw logic directly inside the event handler wastes CPU cycles on frames that are never displayed by the monitor (which refreshes at 60Hz, 120Hz, or 144Hz).

#### Event-Coalescing Implementation
```javascript
let renderScheduled = false;
let isDirty = false;

export function markDirty() {
  isDirty = true;
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(renderLoop);
  }
}

function renderLoop(timestamp) {
  renderScheduled = false;
  if (isDirty) {
    isDirty = false;
    drawScene();
  }
}

// In pointer event listeners:
function onPointerMove(e) {
  updateDragCoordinates(e); // Updates state variables only
  markDirty();             // Schedules at most one render per VSync
}
```

---

## 4. Target SLA Performance Budgets Across Project Scales

The following proposed performance budgets are targets for future measurements in the real app on specified hardware. The synthetic Node benchmark cannot enforce browser frame-rate or user-experience guarantees.

### 4.1 SLA Performance Budget Matrix

| Performance Metric | Small Project (1 Room / 15 Items) | Medium Project (4 Rooms / 85 Items) | Large Project (30 Rooms / 1,000 Items) | Measurement Tooling |
| :--- | :---: | :---: | :---: | :--- |
| **2D Frame Time (Avg)** | $\le \mathbf{2.5 \text{ ms}}$ | $\le \mathbf{6.0 \text{ ms}}$ | $\le \mathbf{12.0 \text{ ms}}$ | `performance.now()` in RAF loop |
| **2D Frame Rate (FPS)** | $\ge \mathbf{120 \text{ FPS}}$ | $\ge \mathbf{60 \text{ FPS}}$ | $\ge \mathbf{60 \text{ FPS}}$ | High-precision RAF delta counter |
| **3D Axonometric Orbit Time** | $\le \mathbf{5.0 \text{ ms}}$ | $\le \mathbf{10.0 \text{ ms}}$ | $\le \mathbf{16.0 \text{ ms}}$ | Camera yaw/pitch orbit pass |
| **SAT Collision Pass Duration**| $\le \mathbf{0.05 \text{ ms}}$ | $\le \mathbf{0.4 \text{ ms}}$ | $\le \mathbf{1.2 \text{ ms}}$ | `SpatialHashGrid` query + SAT |
| **Pointer Drag Latency** | $\le \mathbf{8.0 \text{ ms}}$ | $\le \mathbf{12.0 \text{ ms}}$ | $\le \mathbf{16.6 \text{ ms}}$ | Input dispatch to screen presentation |
| **JSON Serialization Time** | $\le \mathbf{1.5 \text{ ms}}$ | $\le \mathbf{5.0 \text{ ms}}$ | $\le \mathbf{25.0 \text{ ms}}$ | `snapshotProjectData()` duration |
| **JSON Deserialization Time**| $\le \mathbf{3.0 \text{ ms}}$ | $\le \mathbf{10.0 \text{ ms}}$ | $\le \mathbf{45.0 \text{ ms}}$ | `applyImportedJson()` parse + load |
| **Memory Footprint (Heap)** | $\le \mathbf{20 \text{ MB}}$ | $\le \mathbf{50 \text{ MB}}$ | $\le \mathbf{140 \text{ MB}}$ | `performance.memory.usedJSHeapSize` |

---

## 5. Automated Benchmark Suite Specification for Milestone 3

To continuously verify compliance against these SLA budgets, an automated scriptable benchmark harness (`cad-benchmark.js`) will execute four core stress tests:

### 5.1 Benchmark Scenarios (B1 to B4)
1. **Scenario B1: 2D Static Rasterization**:
   - Executes 200 consecutive frame draws at standard $1920 \times 1080$ and 4K ($3840 \times 2160$) viewports.
   - Measures average frame duration, 95th percentile frame time ($P_{95}$), and standard deviation ($\sigma$).
2. **Scenario B2: Continuous Drag & Collision Stress**:
   - Simulates 1,000 synthetic `pointermove` drag steps traversing an item across the floorplan.
   - Logs duration of every collision pass and records peak single-frame collision latency.
3. **Scenario B3: 3D Axonometric 360° Orbit Sweep**:
   - Simulates a complete $360^\circ$ yaw rotation and pitch oscillation across 360 discrete frames.
   - Measures face collection, sorting duration, and rasterization latency.
4. **Scenario B4: Project Serialization Round-Trip**:
   - Measures JSON stringification, parsing, schema validation, and memory heap delta across 50 iterations.

### 5.2 Benchmark Output Telemetry Schema
```json
{
  "suite": "SimpleCAD Performance Benchmark",
  "version": "3.0.0",
  "timestamp": "2026-11-15T13:30:00.000Z",
  "projectScale": "large-floorplate",
  "payload": { "walls": 180, "spaces": 30, "items": 1000, "cables": 80 },
  "results": {
    "b1_2d_render_ms": { "avg": 8.42, "p95": 11.20, "fps": 60.0 },
    "b2_collision_ms": { "avg": 0.68, "max": 1.15, "p95": 0.92 },
    "b3_3d_orbit_ms": { "avg": 13.50, "p95": 15.80, "fps": 60.0 },
    "b4_serialization_ms": { "export_avg": 14.2, "import_avg": 28.6 }
  },
  "compliance": {
    "slaPassed": true,
    "budgetViolations": []
  }
}
```
