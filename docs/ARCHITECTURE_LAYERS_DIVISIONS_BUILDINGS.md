# SimpleCAD Architectural Specification: Layers, Topological Wall Graph, Autonomous Room Divisions, and Whole-Building Hierarchy

- **Document Version**: 3.0.0-DRAFT
- **Status**: Proposal; approval and implementation are not established by this document.
- **Target Release**: SimpleCAD Scope Expansion (v3.0.0)
- **Proposed successor to**: SimpleCAD v2 Flat-Room Schema (`default-room.js`)

This retained design draft describes a possible v3 model. The current app still uses
the single rectangular room model; it does not implement this wall graph, building
hierarchy, layer system, or migration. Examples and checklists below are design
material, not evidence of implemented or verified behavior.

---

## 1. Executive Summary & Architectural Vision

SimpleCAD began as a responsive, dependency-free vanilla web application wrapped in an ultra-lightweight native desktop shell (~766 KB). In Version 2, the application successfully proved the viability of centimeter-accurate 2D floor plans, live SAT polygon collisions, and custom software axonometric 3D projection without third-party graphics engines.

However, Version 2's core data model is intrinsically bounded to a **single rectangular room box** (`state.room = { w, h, wallThickness }`). Users cannot draw freeform interior walls, partition a floor into multiple spaces, construct L-shaped or T-shaped structures, or model multi-story buildings. Openings (doors, windows) and outlets are bound to perimeter walls by text-based wall identifiers (`'top'`, `'bottom'`, `'left'`, `'right'`).

This specification establishes the architectural foundation for **SimpleCAD v3 Scope Expansion**, upgrading the system to a professional, publication-grade CAD platform capable of:
1. **Multi-Story Whole-Building Hierarchy**: An organized structural tree spanning Project $\to$ Site $\to$ Buildings $\to$ Storeys $\to$ Layers, Wall Graph, Spaces, Openings, Equipment, MEP, and Annotations.
2. **Topological Planar Wall Graph ($G = (V, E)$)**: Freeform wall modeling composed of discrete `WallNode` vertices and `WallSegment` edges supporting variable thicknesses, materials, and arbitrary planar angles.
3. **Autonomous Space Polygon Detection (Left-Face Walk)**: Algorithmic extraction of enclosed room polygons from the wall graph using Euler planar graph traversal, automatically calculating floor areas ($m^2$), perimeters, centroids, and boundary loops.
4. **Parametric Hosted Openings**: Doors, windows, and passages defined parametrically along wall segment centerlines ($t \in [0, 1]$), automatically generating geometric wall cutouts in both 2D and 3D.
5. **AIA/ISO 13567-Compliant CAD Layer System**: Rigorous layer visibility, locking, line-weight, color, and depth-ordering controls.
6. **Full Backward Compatibility**: Lossless, automated migration of all existing SimpleCAD v2 projects into valid v3 topological graphs.

---

## 2. Whole-Building Hierarchical Taxonomy

The SimpleCAD v3 object model adopts an explicit hierarchical decomposition modeled after modern BIM (IFC4) principles while maintaining JSON serialization simplicity and zero runtime dependencies.

```
Project (Metadata, Units, Georeference, Global Settings)
  │
  ├── CadLayers [] (AIA/ISO standard layer definitions: A-WALL, A-DOOR, A-FURN...)
  │
  └── Buildings []
        │
        ├── BuildingProperties (Footprint, StructureType, FoundationElevation)
        │
        └── Storeys / Levels [] (Index, Name, ElevationZ, StoryHeight, SlabThickness)
              │
              ├── WallGraph (Planar Topological Subdivision)
              │     ├── WallNodes [] (id, x, y, elevationZ)
              │     └── WallSegments [] (id, startNodeId, endNodeId, thickness, height, type, material, layerId)
              │
              ├── Spaces [] (Autonomous Room Cycles: name, number, finish, areaM2, perimeterM, boundaryPolygon)
              │
              ├── Openings [] (Parametric Cutouts: wallSegmentId, tOffset, width, height, sillHeight, type, swing)
              │
              ├── Furniture / Equipment [] (id, archetype, x, y, z, rotation, dimensions, layerId, spaceId)
              │
              ├── MEP / CableNetworks [] (id, runType, nodes, terminations, maxMeters, voltage, layerId)
              │
              └── Annotations [] (Dimensions, Witness Lines, Text Stamps, Area Labels, Elevation Tags)
```

### 2.1 Entity Relationship Cardinality
- A **Project** has one or more **Buildings** ($1..*$) and a shared collection of **CadLayers** ($1..*$).
- A **Building** contains one or more **Storeys** ($1..*$) ordered monotonically by elevation $Z$.
- Each **Storey** encapsulates its own **WallGraph**, **Spaces**, **Openings**, **Furniture**, **MEP**, and **Annotations**.
- A **WallSegment** references exactly two distinct **WallNodes** ($2$), belongs to one **CadLayer**, and hosts zero or more **Openings** ($0..*$).
- A **Space** is bounded by an ordered cycle of three or more directed **WallSegments** ($\ge 3$).
- A **Furniture** item references one **CadLayer** and may optionally resolve an association to a containing **Space** via point-in-polygon spatial testing.

---

## 3. Planar Topological Wall Graph Specification

### 3.1 Mathematical Formulation
The structural layout of each building storey is represented as an embedded planar undirected graph $G = (V, E)$:
- **Vertices $V$ (`WallNodes`)**: Points in the 2D plane $p = (x, y) \in \mathbb{R}^2$ expressed in centimeters ($cm$).
- **Edges $E$ (`WallSegments`)**: Straight line segments connecting unordered pairs $\{u, v\}$ where $u, v \in V, u \neq v$.

To prevent self-intersecting edge anomalies, every intersection between two wall segments must be represented by a shared `WallNode`. When a user draws a new wall crossing an existing segment, the intersection point $p_{\text{intersect}}$ is computed, creating a new node $v_{\text{new}}$ and splitting the existing segment into two contiguous segments.

### 3.2 Data Structure Definitions

#### WallNode
```typescript
interface WallNode {
  /** Unique immutable identifier (UUIDv4 or prefixed string, e.g., 'node-a7f2') */
  id: string;
  /** X coordinate in project centimeters relative to storey origin */
  x: number;
  /** Y coordinate in project centimeters relative to storey origin */
  y: number;
  /** Optional vertical offset for sloped or split-level framing (default 0) */
  elevationOffset?: number;
}
```

#### WallSegment
```typescript
type WallType = 'exterior' | 'interior' | 'partition' | 'curtain' | 'retaining' | 'virtual';

interface WallSegment {
  /** Unique immutable identifier (e.g., 'wall-3b19') */
  id: string;
  /** Starting vertex ID */
  startNodeId: string;
  /** Ending vertex ID */
  endNodeId: string;
  /** Total physical structural thickness in centimeters (e.g., 20.0 for exterior, 10.0 for partition) */
  thickness: number;
  /** Vertical clear height in centimeters (defaults to Storey clear height, e.g., 280.0) */
  height: number;
  /** Classification of the wall assembly */
  type: WallType;
  /** Material key mapping to architectural rendering and poché fills */
  material: 'brick_cavity' | 'concrete_cast' | 'gypsum_stud' | 'glass_mullion' | 'timber_framing';
  /** Reference to CAD layer (typically 'A-WALL-EXTR' or 'A-WALL-INTR') */
  layerId: string;
  /** Structural load-bearing flag */
  loadBearing: boolean;
}
```

### 3.3 Geometric Wall Join Synthesis (Miters, Bevels, and Caps)
Unlike schematic single-line CAD tools, SimpleCAD v3 models **physical wall volume**. A wall segment has thickness $w$, extending $\pm \frac{w}{2}$ perpendicularly from its centerline.

When multiple wall segments connect at a shared `WallNode` $V_i$:
1. **Degree 1 (Dead End / Terminal Cap)**: The wall terminates with a square end-cap perpendicular to the segment vector $\vec{v} = v_2 - v_1$.
2. **Degree 2 (Corner Join)**: Two segments meeting at angle $\alpha$.
   - The interior and exterior contour lines are offset by $\pm \frac{w_1}{2}$ and $\pm \frac{w_2}{2}$.
   - The intersection of the offset lines forms a **miter point**.
   - If $\alpha < 30^\circ$ (acute pinch), a miter cutoff threshold is applied, beveling the acute tip to prevent extreme geometric protrusion.
3. **Degree $\ge 3$ (T-Junctions and Cross-Intersections)**:
   - For T-intersections (a partition wall terminating into a continuous exterior wall), the through-wall maintains its continuous outer boundary lines.
   - The terminating segment's boundary lines are clipped flush against the face of the through-wall.
   - The poché fill algorithms merge coplanar assemblies with identical materials into a contiguous solid polygon fill using 2D boolean union operations.

---

## 4. Autonomous Room / Space Cycle Detection (Euler Left-Face Walk)

### 4.1 Theoretical Foundation
In architectural floor plans, rooms are not manually drawn as isolated polygons. Instead, rooms are the **natural topological faces** formed by the planar arrangement of wall segments.

By Euler's planar graph formula:
$$V - E + F = 2$$
where $V$ is the number of vertices (`WallNodes`), $E$ is the number of non-overlapping edges (`WallSegments`), and $F$ is the number of planar faces. Exactly one face is the unbounded **exterior face** representing the outdoor universe; all other $F - 1$ bounded faces represent interior **Rooms / Spaces** (or inner enclosed voids/courtyards).

### 4.2 The Left-Face Walk Algorithm (DCEL Traversal)

To extract all enclosed room boundaries deterministically in $O(E \log E)$ time, SimpleCAD constructs a Doubly Connected Edge List (DCEL) with directed half-edges.

```
        Node u
          ▲
          │   Half-Edge (v -> u)
          │   [Face Left]
          │   [Face Right]
          │   Half-Edge (u -> v)
          ▼
        Node v
```

#### Step-by-Step Traversal Protocol:

1. **Half-Edge Construction**:
   - For every undirected `WallSegment` connecting $u$ and $v$, generate two directed half-edges: $e_{u \to v}$ and $e_{v \to u}$.
   - Each half-edge has an origin vertex, a target vertex, an angle $\theta = \operatorname{atan2}(v.y - u.y, v.x - u.x) \in [-\pi, \pi]$, and a boolean visited flag initialized to `false`.

2. **Angular Sorting around Vertices**:
   - For every `WallNode` $V_i$, collect all incoming half-edges ending at $V_i$.
   - Sort these half-edges in counter-clockwise order by their incoming angle $\theta_{\text{in}}$.
   - For each incoming half-edge $e_{a \to V_i}$, its "next" counter-clockwise half-edge in the left-face cycle is the half-edge $e_{V_i \to b}$ immediately following $e_{a \to V_i}^{\text{twin}}$ in angular sequence. Turning sharpest left guarantees traversal along the inner boundary of the incident face.

3. **Cycle Extraction**:
   - Iterate through all unvisited directed half-edges.
   - Trace the sequence $e_0 \to e_1 \to e_2 \to \dots \to e_k$ where $e_{i+1} = \operatorname{nextLeft}(e_i)$ until returning to $e_0$.
   - Mark all traversed half-edges as `visited = true`.
   - Record the sequence of vertices $\{V_0, V_1, \dots, V_k\}$.

4. **Winding Order and Face Classification (Shoelace Formula)**:
   - Compute the signed polygon area using the Shoelace formula:
     $$A_{\text{signed}} = \frac{1}{2} \sum_{i=0}^{k-1} (x_i y_{i+1} - x_{i+1} y_i)$$
   - **Counter-Clockwise Winding ($A_{\text{signed}} > 0$)**: The face lies to the left of the directed boundary. This constitutes a valid **Interior Room/Space**.
   - **Clockwise Winding ($A_{\text{signed}} < 0$)**: The cycle traverses the perimeter of the entire building clockwise. This constitutes the **Exterior Bounding Face** and is discarded from room generation (or preserved as the building envelope boundary).

5. **Space Identity Preservation**:
   - When the wall graph is modified (e.g., adding or moving a wall), newly extracted room polygons compare their centroids $(\bar{x}, \bar{y})$ against prior spaces.
   - If a prior room's centroid falls inside the new polygon, the room's user-assigned metadata (`name`, `roomNumber`, `floorFinish`, `occupancyType`) is preserved, avoiding disruptive metadata erasure.

```typescript
interface Space {
  /** Unique space identifier */
  id: string;
  /** Display name (e.g., 'Master Suite', 'Conference Room A') */
  name: string;
  /** Room designation code (e.g., '101', 'B-204') */
  number: string;
  /** Ordered list of wall segment IDs enclosing this room */
  boundarySegmentIds: string[];
  /** Exact polygon vertices in centimeters for floor rendering */
  polygon: Array<{ x: number; y: number }>;
  /** Calculated floor net area in square meters (m²) */
  areaM2: number;
  /** Calculated room perimeter in linear meters (m) */
  perimeterM: number;
  /** Visual centroid for label placement */
  centroid: { x: number; y: number };
  /** Architectural floor material and texture finish */
  floorMaterial: 'white_oak_plank' | 'herringbone_parquet' | 'polished_concrete' | 'terrazzo_slate' | 'porcelain_tile' | 'commercial_carpet';
  /** Floor fill color tint */
  fillColor: string;
}
```

---

## 5. Parametric Opening Model

### 5.1 Centerline Parameterization ($t \in [0, 1]$)
In SimpleCAD v2, doors and windows were tied to discrete rectangular walls (`'top'`, `'bottom'`). In v3, openings are **hosted parametric entities** tied to a specific `wallSegmentId`.

The opening's position along the wall centerline is defined by a normalized scalar $t \in [0, 1]$:
$$P(t) = P_{\text{start}} + t \cdot (P_{\text{end}} - P_{\text{start}})$$

```
P_start                                                         P_end
   ●───────────────────────────[==== DOOR ====]──────────────────●
   t = 0.0                     t_center = 0.65                  t = 1.0
                               |<-- width -->|
```

The geometric interval occupied by the opening along the segment length $L = \|P_{\text{end}} - P_{\text{start}}\|$ is:
$$t_{\min} = t - \frac{\text{width}}{2L}, \quad t_{\max} = t + \frac{\text{width}}{2L}$$

### 5.2 Opening Entity Schema
```typescript
type OpeningType =
  | 'door_single_swing'
  | 'door_double_swing'
  | 'door_sliding'
  | 'door_pocket'
  | 'door_bifold'
  | 'window_fixed'
  | 'window_casement'
  | 'window_double_hung'
  | 'window_sliding'
  | 'portal_opening'; // cased opening without door leaf

interface Opening {
  id: string;
  /** ID of host wall segment */
  wallSegmentId: string;
  /** Normalized centerline position along host segment (0.0 to 1.0) */
  t: number;
  /** Clear width of the opening in centimeters */
  width: number;
  /** Clear height of the opening in centimeters */
  height: number;
  /** Elevation of the sill above finished floor level in centimeters (0 for doors) */
  sillHeight: number;
  /** Opening categorization */
  type: OpeningType;
  /** Door hinge placement */
  hinge: 'left' | 'right';
  /** Swing trajectory */
  swing: 'inward' | 'outward';
  /** Open angle for 2D/3D visualization (typically 90° for 2D floor plans) */
  swingAngleDeg: number;
  /** Glazing parameters for windows and glazed doors */
  glazing?: {
    paneCount: number;
    mullionThicknessCm: number;
    glassTint: string;
  };
}
```

### 5.3 Geometric Wall Cutout Synthesis
When rendering 2D walls and 3D solids:
1. **2D Cutout**: The continuous wall polygon is boolean-subtracted or partitioned at the $[t_{\min}, t_{\max}]$ boundary.
   - For **doors**, the wall cavity is completely cut away, exposing the floor finish below, bounded by jamb lines.
   - For **windows**, the wall sill is rendered with lightweight exterior and interior edge lines, and central double lines represent the glass pane and mullion assembly.
   - For **door swings**, an architectural quarter-circle arc (radius = leaf width) and a 45° or 90° leaf line are rendered with a 0.18mm fine line weight.
2. **3D Cutout**: The 3D wall mesh splits into three volumetric components:
   - Below opening: Sill wall solid from $z = 0$ to $z = \text{sillHeight}$ (for windows).
   - Beside opening: Left and right full-height wall solids.
   - Above opening: Lintel / header wall solid from $z = \text{sillHeight} + \text{height}$ to $z = \text{wallHeight}$.

---

## 6. Comprehensive CAD Layer System

SimpleCAD v3 implements a full standard CAD layer management architecture conforming to the **AIA CAD Layer Guidelines** and **ISO 13567-1/2**.

### 6.1 Layer Data Structure
```typescript
interface CadLayer {
  /** Standard Layer ID, e.g., 'A-WALL-EXTR' */
  id: string;
  /** Human-readable layer name */
  name: string;
  /** Default display color (Hex string) */
  color: string;
  /** Standard architectural pen weight in millimeters (0.13, 0.18, 0.25, 0.35, 0.50, 0.70) */
  lineWeightMm: number;
  /** Dash pattern: 'solid' | 'dashed' | 'dotted' | 'center' | 'phantom' */
  lineType: 'solid' | 'dashed' | 'dotted' | 'center' | 'phantom';
  /** Global visibility flag */
  visible: boolean;
  /** Edit protection flag (locked layers cannot be transformed) */
  locked: boolean;
  /** Include layer in 2D PNG / PDF exports */
  printable: boolean;
  /** Rendering order index (lower draws first, higher draws on top) */
  zOrder: number;
}
```

### 6.2 Standard Built-in Architectural Layers Table

| Layer ID | Layer Name | AIA / ISO Code | Default Color | Pen Weight | Dash Pattern | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `A-FLOR-SLAB` | Floor Slab & Grid | A-FLOR-OTLN | `#28425d` | 0.25 mm | `solid` | Floor finishes, concrete slabs, and architectural grid |
| `A-WALL-EXTR` | Exterior Walls | A-WALL-EXTR | `#EAE7DF` | 0.70 mm | `solid` | Structural perimeter cut walls, thermal boundary |
| `A-WALL-INTR` | Interior Partitions| A-WALL-INTR | `#b0aca2` | 0.50 mm | `solid` | Interior partition walls, demising walls |
| `A-DOOR` | Doors & Swings | A-DOOR | `#c8a96e` | 0.25 mm | `solid` | Door frames, leaves, and 90° swing trajectory arcs |
| `A-GLAZ` | Windows & Glazing | A-GLAZ | `#5a8cb2` | 0.25 mm | `solid` | Window frames, mullions, and insulated glazing panes |
| `A-FURN` | Furniture & Fixtures| A-FURN | `#d99b26` | 0.25 mm | `solid` | Desks, seating, cabinetry, sanitary fixtures |
| `E-POWR` | Electrical & Cables| E-POWR-CABL | `#4ecdc4` | 0.35 mm | `solid` | Receptacles, outlets, cable routes, junction boxes |
| `A-ANNO-DIMS` | Dimension Lines | A-ANNO-DIMS | `#c8a96e` | 0.18 mm | `solid` | Dimension witness lines, ticks, and measurement text |
| `A-ANNO-TEXT` | Room Stamps & Labels| A-ANNO-TEXT | `#EAE7DF` | 0.25 mm | `solid` | Room titles, area stamps ($m^2$), level markers |
| `A-CLG-GRID` | Reflected Ceiling | A-CLG-GRID | `#505565` | 0.13 mm | `dashed` | Ceiling tile grid, light fixtures, soffits |

---

## 7. Complete TypeScript & JSON Schema Definitions

### 7.1 Master TypeScript Interface Specification

```typescript
/**
 * SimpleCAD Master Project Schema v3.0.0
 */
export interface SimpleCadProjectV3 {
  /** Schema specification version */
  version: 3;
  /** Application origin identifier */
  app: 'SimpleCAD';
  /** ISO 8601 UTC creation timestamp */
  createdAt: string;
  /** ISO 8601 UTC last modified timestamp */
  updatedAt: string;

  /** Project-level metadata and global preferences */
  project: {
    id: string;
    name: string;
    author: string;
    client?: string;
    units: 'cm' | 'mm' | 'm' | 'in' | 'ft';
    gridStepCm: number;
    majorGridStepCm: number;
    activeBuildingId: string;
    activeStoreyId: string;
    activeLayoutId: string;
  };

  /** Global layer table */
  layers: CadLayer[];

  /** Building hierarchy */
  buildings: Building[];

  /** Multi-layout management (preserves furniture configuration alternatives) */
  layouts: ProjectLayout[];
}

export interface Building {
  id: string;
  name: string;
  description?: string;
  storeys: Storey[];
}

export interface Storey {
  id: string;
  name: string;
  index: number;
  elevationZ: number;
  storyHeight: number;
  slabThickness: number;

  /** Topological wall network */
  wallGraph: {
    nodes: WallNode[];
    segments: WallSegment[];
  };

  /** Detected room faces */
  spaces: Space[];

  /** Parametric openings */
  openings: Opening[];

  /** Furniture and equipment elements */
  furniture: FurnitureItem[];

  /** Electrical, communication, and cabling networks */
  cables: CableRun[];

  /** Architectural annotations */
  annotations: AnnotationItem[];
}

export interface FurnitureItem {
  id: string;
  name: string;
  archetype: string;
  layerId: string;
  spaceId?: string;
  /** Placement origin X in centimeters */
  x: number;
  /** Placement origin Y in centimeters */
  y: number;
  /** Z offset above storey floor slab in centimeters */
  z: number;
  /** Planar rotation in degrees (0 to 359.9) */
  rotation: number;
  /** Width along local X axis */
  w: number;
  /** Depth along local Y axis */
  h: number;
  /** Height along local Z axis */
  zHeight: number;
  /** Visual color theme key or hex code */
  color: string;
  /** Collision exclusion flag */
  ignoreCollision: boolean;
  /** Aspect ratio or dimension lock */
  lockedDims: boolean;
  /** Visibility toggle */
  visible: boolean;
}

export interface CableRun {
  id: string;
  name: string;
  layerId: string;
  fromId: string;
  toId: string;
  maxMeters: number;
  warnMeters: number;
  routingMode: 'direct' | 'orthogonal' | 'wall_perimeter';
  color: string;
  visible: boolean;
}

export interface AnnotationItem {
  id: string;
  layerId: string;
  type: 'dimension' | 'leader_text' | 'room_stamp' | 'section_marker';
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSizePx?: number;
}

export interface ProjectLayout {
  id: string;
  name: string;
  builtIn: boolean;
  placements: Record<string, {
    minX: number;
    minY: number;
    rot: number;
    w: number;
    h: number;
    zHeight: number;
    visible: boolean;
  }>;
}
```

### 7.2 JSON Schema (Draft 2020-12 Compatible)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://simplecad.app/schemas/project-v3.json",
  "title": "SimpleCAD Project Schema v3",
  "type": "object",
  "required": ["version", "app", "project", "layers", "buildings"],
  "properties": {
    "version": {
      "type": "integer",
      "const": 3
    },
    "app": {
      "type": "string",
      "const": "SimpleCAD"
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "project": {
      "type": "object",
      "required": ["id", "name", "units", "gridStepCm", "activeBuildingId", "activeStoreyId"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "author": { "type": "string" },
        "units": { "type": "string", "enum": ["cm", "mm", "m", "in", "ft"] },
        "gridStepCm": { "type": "number", "minimum": 1 },
        "majorGridStepCm": { "type": "number", "minimum": 5 },
        "activeBuildingId": { "type": "string" },
        "activeStoreyId": { "type": "string" },
        "activeLayoutId": { "type": "string" }
      }
    },
    "layers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "color", "lineWeightMm", "lineType", "visible", "locked", "printable", "zOrder"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "color": { "type": "string" },
          "lineWeightMm": { "type": "number" },
          "lineType": { "type": "string", "enum": ["solid", "dashed", "dotted", "center", "phantom"] },
          "visible": { "type": "boolean" },
          "locked": { "type": "boolean" },
          "printable": { "type": "boolean" },
          "zOrder": { "type": "integer" }
        }
      }
    },
    "buildings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "storeys"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "storeys": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "name", "elevationZ", "storyHeight", "wallGraph", "spaces", "openings", "furniture"],
              "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "elevationZ": { "type": "number" },
                "storyHeight": { "type": "number", "minimum": 100 },
                "slabThickness": { "type": "number", "minimum": 5 },
                "wallGraph": {
                  "type": "object",
                  "required": ["nodes", "segments"],
                  "properties": {
                    "nodes": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": ["id", "x", "y"],
                        "properties": {
                          "id": { "type": "string" },
                          "x": { "type": "number" },
                          "y": { "type": "number" }
                        }
                      }
                    },
                    "segments": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": ["id", "startNodeId", "endNodeId", "thickness", "height", "type", "material", "layerId"],
                        "properties": {
                          "id": { "type": "string" },
                          "startNodeId": { "type": "string" },
                          "endNodeId": { "type": "string" },
                          "thickness": { "type": "number", "minimum": 1 },
                          "height": { "type": "number", "minimum": 1 },
                          "type": { "type": "string", "enum": ["exterior", "interior", "partition", "curtain", "retaining", "virtual"] },
                          "material": { "type": "string" },
                          "layerId": { "type": "string" },
                          "loadBearing": { "type": "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 8. Proposed Migration Algorithm and Backward Compatibility Requirements

### 8.1 Bidirectional Compatibility Architecture
The proposed v3 loader would need the following behavior, with preservation of user projects verified before release:
1. **Automated Detection**: The loader checks `project.version`.
   - If `version === 2` (or undefined), it invokes `migrateV2ToV3(v2Project)`.
   - If `version === 3`, it loads directly.
2. **Lossless Conversion**: Every dimension, door, window, outlet, furniture piece, and layout placement from v2 is deterministically mapped to the new graph model.
3. **Legacy Export**: When exporting for older clients, an export adapter extracts the bounding envelope of the active storey into a v2-compliant rectangular projection.

### 8.2 The v2 to v3 Migration Transformation (`migrateV2ToV3`)

```javascript
/**
 * Proposed migration transformer: SimpleCAD v2 -> SimpleCAD v3 (not integrated or verified)
 * @param {Object} v2 - The legacy SimpleCAD v2 project object
 * @returns {SimpleCadProjectV3} - Fully populated v3 project graph
 */
function migrateV2ToV3(v2) {
  const room = v2.room || { w: 440, h: 380, wallThickness: 14, doors: [], windows: [], outlets: [] };
  const W = Number(room.w) || 440;
  const H = Number(room.h) || 380;
  const th = Number(room.wallThickness) || 14;
  const nowIso = new Date().toISOString();

  // 1. Create standard CAD Layers
  const defaultLayers = [
    { id: 'A-FLOR-SLAB', name: 'Floor Slab', color: '#28425d', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 0 },
    { id: 'A-WALL-EXTR', name: 'Exterior Walls', color: '#EAE7DF', lineWeightMm: 0.70, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 10 },
    { id: 'A-WALL-INTR', name: 'Interior Walls', color: '#b0aca2', lineWeightMm: 0.50, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 15 },
    { id: 'A-DOOR',      name: 'Doors & Swings', color: '#c8a96e', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 20 },
    { id: 'A-GLAZ',      name: 'Windows & Glazing', color: '#5a8cb2', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 25 },
    { id: 'A-FURN',      name: 'Furniture', color: '#d99b26', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 30 },
    { id: 'E-POWR',      name: 'Electrical & Cable', color: '#4ecdc4', lineWeightMm: 0.35, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 40 },
    { id: 'A-ANNO-DIMS', name: 'Dimensions', color: '#c8a96e', lineWeightMm: 0.18, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 50 },
    { id: 'A-ANNO-TEXT', name: 'Room Stamps', color: '#EAE7DF', lineWeightMm: 0.25, lineType: 'solid', visible: true, locked: false, printable: true, zOrder: 60 }
  ];

  // 2. Synthesize 4 WallNodes forming the rectangular perimeter
  // Coordinate system origin (0,0) is top-left
  const nodes = [
    { id: 'node-tl', x: 0, y: 0 },
    { id: 'node-tr', x: W, y: 0 },
    { id: 'node-br', x: W, y: H },
    { id: 'node-bl', x: 0, y: H }
  ];

  // 3. Synthesize 4 perimeter WallSegments
  const segments = [
    { id: 'wall-top',    startNodeId: 'node-tl', endNodeId: 'node-tr', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-right',  startNodeId: 'node-tr', endNodeId: 'node-br', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-bottom', startNodeId: 'node-br', endNodeId: 'node-bl', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true },
    { id: 'wall-left',   startNodeId: 'node-bl', endNodeId: 'node-tl', thickness: th, height: 280, type: 'exterior', material: 'brick_cavity', layerId: 'A-WALL-EXTR', loadBearing: true }
  ];

  // Map legacy wall name string to segment ID and segment length
  const wallSegmentMap = {
    top:    { id: 'wall-top',    length: W },
    right:  { id: 'wall-right',  length: H },
    bottom: { id: 'wall-bottom', length: W },
    left:   { id: 'wall-left',   length: H }
  };

  // 4. Migrate Doors to Parametric Openings
  const openings = [];
  (room.doors || []).forEach((d, idx) => {
    const wallInfo = wallSegmentMap[d.wall] || wallSegmentMap.bottom;
    const segLen = wallInfo.length;
    const width = Number(d.width) || 90;
    const offset = Number(d.offset) || 0;
    // Compute normalized centerline parameter t in [0, 1]
    const tCenter = Math.max(0.05, Math.min(0.95, (offset + width / 2) / segLen));

    openings.push({
      id: d.id || `door-${idx + 1}`,
      wallSegmentId: wallInfo.id,
      t: tCenter,
      width: width,
      height: 210,
      sillHeight: 0,
      type: 'door_single_swing',
      hinge: d.hinge === 'right' ? 'right' : 'left',
      swing: d.swing === 'outward' ? 'outward' : 'inward',
      swingAngleDeg: 90
    });
  });

  // 5. Migrate Windows to Parametric Openings
  (room.windows || []).forEach((w, idx) => {
    const wallInfo = wallSegmentMap[w.wall] || wallSegmentMap.top;
    const segLen = wallInfo.length;
    const width = Number(w.width) || 120;
    const offset = Number(w.offset) || 0;
    const tCenter = Math.max(0.05, Math.min(0.95, (offset + width / 2) / segLen));

    openings.push({
      id: w.id || `win-${idx + 1}`,
      wallSegmentId: wallInfo.id,
      t: tCenter,
      width: width,
      height: 140,
      sillHeight: 90,
      type: 'window_casement',
      hinge: 'left',
      swing: 'outward',
      swingAngleDeg: 45,
      glazing: { paneCount: 2, mullionThicknessCm: 4, glassTint: '#5a8cb2' }
    });
  });

  // 6. Migrate Outlets to Annotations / MEP Nodes
  const annotations = [];
  (room.outlets || []).forEach((o, idx) => {
    annotations.push({
      id: o.id || `T${idx + 1}`,
      layerId: 'E-POWR',
      type: 'leader_text',
      x1: Number(o.x) || 0,
      y1: Number(o.y) || 0,
      text: o.name || `Outlet ${o.id || idx + 1}`,
      fontSizePx: 12
    });
  });

  // 7. Form Initial Autonomous Space
  const initialSpace = {
    id: 'space-main',
    name: room.name || 'Studio Room',
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
  };

  // 8. Migrate Furniture Items
  const activeLayout = (v2.layouts || []).find(l => l.id === v2.activeLayoutId) || v2.layouts?.[0];
  const placements = activeLayout?.placements || {};

  const furniture = (v2.catalog || []).map(item => {
    const pl = placements[item.id] || {};
    return {
      id: item.id,
      name: item.name || item.id,
      archetype: item.type || 'generic',
      layerId: 'A-FURN',
      spaceId: 'space-main',
      x: pl.minX !== undefined ? pl.minX : 50,
      y: pl.minY !== undefined ? pl.minY : 50,
      z: 0,
      rotation: pl.rot || 0,
      w: pl.w || item.w || 100,
      h: pl.h || item.h || 100,
      zHeight: pl.zHeight || item.zHeight || 75,
      color: item.color || 'zinc',
      ignoreCollision: Boolean(item.ignoreCollision),
      lockedDims: Boolean(item.lockedDims),
      visible: pl.visible !== undefined ? pl.visible : (item.visible !== undefined ? item.visible : true)
    };
  });

  // 9. Migrate Cables
  const cables = (v2.cables || []).map(c => ({
    id: c.id,
    name: c.name || 'Cable Run',
    layerId: 'E-POWR',
    fromId: c.fromId,
    toId: c.toId,
    maxMeters: c.maxMeters || 5.0,
    warnMeters: c.warnMeters || 4.2,
    routingMode: c.routingMode === 'wall' ? 'wall_perimeter' : 'direct',
    color: c.color || '#4ecdc4',
    visible: c.visible !== undefined ? c.visible : true
  }));

  // 10. Construct Final Unified v3 Project Object
  return {
    version: 3,
    app: 'SimpleCAD',
    createdAt: v2.createdAt || nowIso,
    updatedAt: nowIso,
    project: {
      id: 'proj-default',
      name: room.name || 'Migrated Project',
      author: 'SimpleCAD User',
      units: 'cm',
      gridStepCm: 10,
      majorGridStepCm: 50,
      activeBuildingId: 'bldg-1',
      activeStoreyId: 'lvl-1',
      activeLayoutId: v2.activeLayoutId || 'opt1'
    },
    layers: defaultLayers,
    buildings: [
      {
        id: 'bldg-1',
        name: 'Main Building',
        storeys: [
          {
            id: 'lvl-1',
            name: 'Ground Floor (Level 0)',
            index: 0,
            elevationZ: 0,
            storyHeight: 280,
            slabThickness: 20,
            wallGraph: {
              nodes: nodes,
              segments: segments
            },
            spaces: [initialSpace],
            openings: openings,
            furniture: furniture,
            cables: cables,
            annotations: annotations
          }
        ]
      }
    ],
    layouts: v2.layouts || []
  };
}
```

---

## 9. Proposed Implementation & Verification Checklist

- [ ] **Planar Graph Formalism**: Wall nodes and segments replace rigid rectangle boundaries.
- [ ] **Euler Traversal**: Algorithmic cycle detection (Left-Face Walk) extracts room polygons automatically with signed area classification.
- [ ] **Parametric Openings**: Standardized $[0, 1]$ parameterization along wall segments with automated 2D and 3D cutout rules.
- [ ] **Whole-Building Hierarchy**: Scalable tree model spanning Site $\to$ Building $\to$ Storey $\to$ Graph / Spaces / Objects.
- [ ] **Standard CAD Layers**: Verify conformance with AIA/ISO layer conventions, including colors, pen weights, and visibility.
- [ ] **Lossless Migration**: Verify backward compatibility with SimpleCAD v2 JSON files via `migrateV2ToV3`.
