# SimpleCAD Comprehensive UX Audit Report & Usability Redesign Blueprints

- **Audit Date**: 2026-11-15
- **Document Version**: 2.0.0
- **Scope**: SimpleCAD Desktop / Web Engine (All Primary Workflows)
- **Evaluation Framework**: Nielsen-Norman Group 10 Usability Heuristics & Architectural CAD Ergonomics Standards
- **Status**: Historical design review and proposals, not a current acceptance report.

This review predates later rendering and branding edits. Its source line references
and current-state descriptions may be stale; the current renderer includes wall
cavities and double outlines. Ratings are design judgments, not measured user-study
results. The proposed flows below are not implemented or approved by this document.

---

## 1. Executive Summary & Audit Methodology

SimpleCAD supports basic single-room space planning, centimeter-based object snapping, and software axonometric 3D projection. Startup time and browser frame rate were not measured by this review.

However, an exhaustive evaluation of user journeys against professional architectural CAD expectations reveals severe usability barriers. Most critically, **the inability to draw or modify walls directly on the canvas (rated 2/10)** forces users into a rigid 4-walled rectangular container, preventing real-world architectural design. Furthermore, openings (doors and windows) can only be placed through sidebar numeric inputs, object selection is strictly single-element without multi-select or alignment tools, and the floating item HUD frequently obscures adjacent objects during editing.

This audit evaluates all seven primary user workflows, assigns rigorous usability ratings (1–10) and severity classifications, and provides concrete, publication-grade redesign blueprints to transform SimpleCAD into a professional-grade drafting experience.

---

## 2. Comprehensive Workflow Usability Evaluation

### 2.1 Workflow 1: Project Setup, Canvas Navigation & Viewport Control
- **User Goal**: Establish project parameters, scale, zoom, pan, and orient oneself on the drafting grid.
- **Current Implementation**:
  - Pan via middle mouse drag or left drag with Pan tool active (`app.js:2460-2520`).
  - Zoom via mouse wheel (`zoomAt`, `app.js:1062-1085`) centered on cursor.
  - Background grid renders minor 10cm lines and major 50cm lines (`drawGrid`, `app.js:1120-1149`).
  - Dark mode canvas background (`#0d0e10`).
- **Heuristic Evaluation**:
  - *Visibility of System Status*: Good zoom percentage display and mouse coordinate indicator in status bar. However, there is no visual graphic scale bar (e.g., 1m / 5m reference bar) on the canvas.
  - *Match between System and Real World*: Units default to metric centimeters ($cm$), which matches European architectural interior conventions. However, there is no unit toggle for millimeters ($mm$), meters ($m$), or architectural imperial feet/inches ($ft\text{-}in$).
  - *Flexibility & Efficiency*: Pressing and holding `Spacebar` to temporarily engage pan mode (standard in AutoCAD, Revit, Figma, Photoshop) is missing; users must manually switch to the Hand tool in the toolbar.
- **Usability Rating**: **7.5 / 10**
- **Severity**: Minor

---

### 2.2 Workflow 2: Wall Creation & Planar Layout Modification
- **User Goal**: Draw exterior perimeter walls, partition rooms, create hallways, and model non-rectangular footprints.
- **Current Implementation**:
  - Room dimensions are governed exclusively by two numeric input fields in the left sidebar: `#room-w` (Width) and `#room-h` (Height) (`app.js:4070-4170`).
  - Walls are rendered as a single outer rectangle via `targetCtx.strokeRect(ox, oy, rw, rh)` (`app.js:1235`).
  - Wall thickness is defined in state (`wallThickness: 14`) but is not rendered as a physical double-line cavity in 2D.
- **Heuristic Evaluation**:
  - *Flexibility & Efficiency*: **Catastrophic failure**. Users cannot interactively click or drag on the canvas to draw a wall. The application is permanently restricted to an isolated 4-sided box.
  - *User Control & Freedom*: Users cannot split a wall, add interior partition walls, create L-shaped or T-shaped rooms, or construct multi-room floor plans.
  - *Architectural Authenticity*: Walls lack physical thickness, cavity poché fills, and corner miters. The plan resembles a schematic cardboard box rather than an architectural construction drawing.
- **Usability Rating**: **2.0 / 10**
- **Severity**: **CRITICAL (Primary Architectural Blocker)**

---

### 2.3 Workflow 3: Openings Insertion & Configuration (Doors, Windows, Portals)
- **User Goal**: Place doors and windows on walls, position them relative to corners, set clear widths, and configure door swing direction and hinge placement.
- **Current Implementation**:
  - Doors and windows cannot be placed directly on the canvas.
  - Users must open the sidebar accordion, click "+ Nova Porta" or "+ Nova Janela", select the wall from a dropdown (`'top'`, `'bottom'`, `'left'`, `'right'`), and manually type numeric centimeter offsets into an `<input data-field="offset">` field (`app.js:4080-4165`).
  - Once placed, clicking an opening on the canvas selects it, but it cannot be freely dragged along the wall with the cursor.
- **Heuristic Evaluation**:
  - *Recognition Rather Than Recall*: Users must calculate wall offsets in their head (e.g., "the wall is 440cm wide, so to center a 90cm door, I must type $440 / 2 - 90 / 2 = 175$").
  - *Direct Manipulation*: Complete violation of direct manipulation principles. Dragging an opening along a wall is standard in 100% of modern architectural CAD tools.
  - *Error Prevention*: Typing an offset greater than the wall length causes the opening to render partially outside the room boundary or disappear.
  - *Ergonomics*: Flipping door swing (inward/outward) or hinge (left/right) requires clicking tiny dropdown menus in the sidebar rather than a quick canvas handle or `Spacebar` / `F` shortcut.
- **Usability Rating**: **3.5 / 10**
- **Severity**: **MAJOR**

---

### 2.4 Workflow 4: Furniture Placement, Manipulation & Selection
- **User Goal**: Insert furniture elements, arrange layouts, rotate, resize, verify clearances, and coordinate room flow.
- **Current Implementation**:
  - Furniture items are dragged from catalog or added via Quick-Add natural language search (`parseQuickAddText`, `default-room.js:195-252`).
  - Selection displays an active bounding box with 8 resize handles and 1 top rotation handle (`app.js:2750-2810`).
  - Live clearance dimensions (`computeClearances`, `app.js:671-700`) dynamically project distance arrows to nearest obstacles.
  - A floating contextual HUD appears directly adjacent to the selected item with action buttons (Rotate 90°, Flip, Lock, Duplicate, Delete, Layer).
- **Heuristic Evaluation**:
  - *Direct Manipulation*: Extremely strong for single items. Resize handles, 15° rotation snap, and clearance guides provide immediate, intuitive feedback.
  - *Visual Clarity & Occlusion*: The floating HUD is anchored directly above or below the selected item. For small items (nightstands, chairs) or items placed near room corners, the HUD covers adjacent furniture, blocking selection and obscuring clearance dimension numbers.
  - *Selection Limitations*: **Zero multi-selection support**. Users cannot drag a selection marquee (box select) or Shift-click multiple items. Grouping, collective moving, or collective rotation of a dining table with chairs or desk with monitors is impossible.
  - *Alignment & Distribution*: Lack of CAD alignment tools (Align Left, Center, Align Wall, Distribute Evenly). Users must manually nudge items centimeter by centimeter.
- **Usability Rating**: **6.5 / 10**
- **Severity**: **MAJOR**

---

### 2.5 Workflow 5: Electrical, Cabling & MEP Routing
- **User Goal**: Position electrical outlets, route data/power cables from furniture to outlets, and verify cable length safety thresholds.
- **Current Implementation**:
  - Outlets are placed on walls via sidebar numeric positions (`outlets: [{ wall, pos }]`).
  - Cables are defined between two entities (`fromId`, `toId`) in a modal dialog (`#cable-dialog`).
  - Routing modes support direct point-to-point lines or perimeter wall following (`routingMode: 'wall' | 'direct'`).
  - Cable lengths are calculated in real time and color-coded (Green = safe, Yellow = warning threshold, Red = exceeded max length).
- **Heuristic Evaluation**:
  - *Visibility of System Status*: Outstanding safety feedback. The visual warning when a cable exceeds `warnMeters` or `maxMeters` is immediate and informative.
  - *Direct Manipulation*: Outlets cannot be dragged interactively along walls. Cabling cannot be routed through intermediate junction points or split into multi-drop daisy chains.
  - *Flexibility*: Routing mode is binary (direct vs perimeter wall). It does not support arbitrary conduit paths, floor raceways, or ceiling grid drops.
- **Usability Rating**: **5.5 / 10**
- **Severity**: Minor

---

### 2.6 Workflow 6: 2D / 3D Mode Switching & Spatial Comprehension
- **User Goal**: Switch seamlessly between 2D technical floor plans and 3D volumetric visualization to evaluate spatial volume and aesthetics.
- **Current Implementation**:
  - Toolbar toggle switches between 2D plan and 3D axonometric view (`setMode('2d' | '3d')`).
  - Custom software axonometric projection running directly in Canvas 2D (`drawScene3D`, `app.js:1487-2078`).
  - Smooth camera orbit (yaw and pitch) via right-click or left-click drag.
  - Procedural 3D models for all 17 furniture archetypes.
  - 3D floor plane unprojection allows dragging furniture directly inside the 3D view.
- **Heuristic Evaluation**:
  - *Aesthetic and Minimalist Design*: Remarkably lightweight and impressive technical achievement without WebGL dependencies.
  - *Spatial Occlusion*: In 3D, full-height exterior walls frequently block the view of interior furniture depending on camera angle. Currently, cutaways are hardcoded to specific compass walls rather than dynamically clipping walls facing the camera viewpoint.
  - *Lighting & Depth Perception*: 3D shading is currently basic flat shading with limited depth cues. Contact shadows (ground ambient occlusion) are absent, making furniture appear to float above the floor slab.
- **Usability Rating**: **7.0 / 10**
- **Severity**: Minor

---

### 2.7 Workflow 7: Export, Presentation & Documentation
- **User Goal**: Export floor plans for client review, contractor execution, printing, and digital sharing.
- **Current Implementation**:
  - Export to 2x Retina PNG via offscreen canvas render (`exportRetinaPng`, `app.js:3688-3715`).
  - Blueprint export style toggle (light background, pale blue floor, dark ink lines).
  - Bottom architectural title block with project name, timestamp, and SimpleCAD branding.
  - JSON project import/export dialog (`#json-dialog`).
- **Heuristic Evaluation**:
  - *Match between System and Real World*: The 2x Retina PNG export with architectural title block looks sharp and professional.
  - *Professional Documentation Deficits*:
    - No vector export (SVG or PDF), limiting large-format plotting (A3, A2, A1, Arch D).
    - No scale calibration (e.g., 1:50, 1:100, 1/4" = 1'-0").
    - No automatic room area schedules or furniture equipment inventory tables.
- **Usability Rating**: **6.0 / 10**
- **Severity**: Minor

---

## 3. Usability Scorecard & Severity Matrix

| Workflow ID | Workflow Area | Usability Rating (1–10) | Severity | Primary Pain Point |
| :--- | :--- | :---: | :--- | :--- |
| **WF-1** | Project Setup & Navigation | **7.5** | Minor | Missing temporary Spacebar pan; lack of metric/imperial unit toggle |
| **WF-2** | Wall Creation & Layout | **2.0** | **CRITICAL** | Zero interactive canvas wall drawing; locked to single 4-sided box |
| **WF-3** | Openings Insertion | **3.5** | **MAJOR** | Form-only numeric inputs; cannot drag doors/windows on canvas |
| **WF-4** | Furniture Manipulation | **6.5** | **MAJOR** | No multi-select or box-select; floating HUD occludes nearby objects |
| **WF-5** | Electrical & Cabling | **5.5** | Minor | Outlets cannot be dragged on walls; no multi-point conduit routing |
| **WF-6** | 2D / 3D Visualization | **7.0** | Minor | Camera-facing wall occlusion; lack of contact AO ground shadows |
| **WF-7** | Export & Documentation | **6.0** | Minor | Raster PNG only; missing vector PDF/SVG and drawing scale ratios |
| **OVERALL** | **Application Usability Score** | **5.4 / 10** | **MAJOR** | **High potential bottlenecked by structural editing limitations** |

---

## 4. Concrete Usability Redesign Blueprints

### 4.1 Blueprint 1: Interactive Canvas Wall Drawing Tool (`WallTool`)

#### Interaction Flow & State Machine
1. **Activation**: User selects the Wall Tool (`W` key or clicks Wall icon in toolbar). Cursor transforms to a precision crosshair (`crosshair`) accompanied by a floating coordinate badge.
2. **First Click (Node Placement)**:
   - User clicks anywhere on canvas to establish $V_{\text{start}} = (x_1, y_1)$.
   - If cursor is within 15px of an existing `WallNode`, the tool magnetically snaps to the node, displaying a glowing ochre vertex halo.
3. **Interactive Tracking (Rubber-Banding)**:
   - As cursor moves to $(x_2, y_2)$, a live preview wall segment is rendered with double-line thickness and 50% opacity poché fill.
   - **Orthogonal Lock**: Holding `Shift` constrains the segment angle to $0^\circ, 45^\circ, 90^\circ, 135^\circ, 180^\circ$.
   - **Real-time HUD Pill**: A floating dimension pill follows the segment midpoint, displaying live length in centimeters (`340.0 cm`) and angle (`90.0°`).
   - **Direct Distance Entry**: While drawing, user can type numeric digits (e.g., typing `350` followed by `Enter` locks the segment length to exactly 350 cm along the current trajectory).
4. **Subsequent Clicks (Chained Drawing)**:
   - Clicking sets $V_{\text{next}}$ and instantly begins the next contiguous segment.
   - **Auto-Closure Detection**: If user clicks on the initial starting node $V_{\text{start}}$, the wall loop closes, the tool commits the cycle, the Left-Face Walk algorithm automatically detects the new enclosed **Space**, and the tool smoothly exits.
5. **Termination**: Pressing `Escape` or double-clicking commits the drawn chain without closing.

```
       [Start Node]
            ●────────────────────────────────────────────► (Cursor: x2, y2)
            │      Length: 350.0 cm | Angle: 0.0°         ▲
            │      [Pill: Type number + Enter to lock]    │ Wall Thickness: 14cm
            ▼                                             │
```

---

### 4.2 Blueprint 2: Direct Manipulation Parametric Openings (`OpeningTool`)

#### Interaction Flow & Ergonomics
1. **Drag-and-Drop Placement**:
   - User drags a Door or Window icon from the left architectural asset panel directly onto the canvas.
   - As the cursor hovers over any `WallSegment`, the opening snaps magnetically to the wall centerline with its normalized coordinate $t = \frac{\operatorname{proj}(P_{\text{cursor}})}{\|P_{\text{end}} - P_{\text{start}}\|}$.
   - The opening orientation automatically aligns with the host wall's normal vector.
2. **Dynamic Clearance Dimensions**:
   - Two live witness dimension lines project along the wall, showing exact distances from the opening jambs to the nearest corner nodes or adjacent openings:
     `|<- 25.0 cm ->[ DOOR 90cm ]<------- 215.0 cm ------->|`
3. **Instant Ergonomic Hotkeys**:
   - Pressing `Spacebar` toggles **Swing Direction** (`inward` $\leftrightarrow$ `outward`).
   - Pressing `F` toggles **Hinge Position** (`left` $\leftrightarrow$ `right`).
   - Pressing `Tab` focuses the width input box for direct numeric typing.
4. **Interactive Repositioning**:
   - Clicking and dragging an existing door or window slides it smoothly along the host wall, updating $t$ in real time while respecting boundary stops at wall endpoints.

---

### 4.3 Blueprint 3: Multi-Selection, Marquee Box Select & Alignment Toolbar

#### Interaction Flow
1. **Marquee Box Selection**:
   - Clicking and dragging on empty canvas space initializes a rectangular selection marquee.
   - Drawn with dashed Harbour Blue outline (`#5a8cb2`) and translucent fill (`rgba(40, 66, 93, 0.15)`).
   - Any furniture, opening, or annotation whose bounding box intersects the marquee is added to the selection set.
2. **Modifier Keys**:
   - `Shift + Click`: Add / remove individual item to current selection set.
   - `Ctrl + A`: Select all elements on the active layer.
3. **Collective Transformation**:
   - Multi-item selection displays a unified bounding box with corner scale handles and a collective rotation anchor.
   - Dragging moves all selected items as a rigid body.
4. **CAD Alignment & Distribution Toolbar**:
   - When $\ge 2$ items are selected, a compact architectural alignment ribbon appears in the top header:
     - **Align Left** (`Alt + A`)
     - **Align Center Horizontal** (`Alt + C`)
     - **Align Right** (`Alt + D`)
     - **Align Top** (`Alt + W`)
     - **Align Center Vertical** (`Alt + E`)
     - **Align Bottom** (`Alt + S`)
     - **Distribute Horizontally** (`Alt + H`)
     - **Distribute Vertically** (`Alt + V`)

---

### 4.4 Blueprint 4: Non-Occluding Contextual Inspector (HUD Redesign)

#### Pain Point Resolution
- **Problem**: In SimpleCAD v2, the floating HUD rendered directly adjacent to the active item, covering nearby handles and furniture.
- **Solution**: Replace the unconstrained floating popup with a **Smart Anchored Contextual Header**:
  - The inspector docks smoothly to the top center of the canvas viewport or right sidebar dock.
  - Displays selected item name, width, depth, height, layer badge, and rotation in a single, compact horizontal pill.
  - Buttons for Rotate 90°, Flip, Duplicate, Layer, and Delete are clearly visible and never overlap canvas geometry.

```
+-----------------------------------------------------------------------------------------------+
| [Selected: Queen Bed]  W: 200 cm  H: 155 cm  Rot: 180°  | [↺ 90°] [⇅ Flip] [📋 Dup] [🗑 Del] |
+-----------------------------------------------------------------------------------------------+
```

---

## 5. Architectural Unified Keyboard Shortcut Matrix

Standardizing SimpleCAD's keyboard shortcuts to align with professional CAD conventions (AutoCAD, Revit, SketchUp, Figma):

| Category | Shortcut | Action | Scope |
| :--- | :--- | :--- | :--- |
| **Tools** | `V` / `Esc` | Activate Select / Pointer Tool | Global |
| | `W` | Activate Wall Drawing Tool | 2D Plan |
| | `D` | Activate Door Placement Tool | 2D Plan |
| | `N` | Activate Window Placement Tool | 2D Plan |
| | `F` | Focus Furniture Catalog / Quick-Add | Global |
| | `C` | Activate Cable / Conduit Tool | Global |
| | `M` | Activate Measure / Dimension Tool | Global |
| | `T` | Activate Text / Room Stamp Tool | Global |
| | `H` | Activate Hand / Pan Tool | Global |
| **Manipulation**| `Spacebar` (Hold) | Temporary Pan Viewport | Canvas Drag |
| | `Spacebar` (Press) | Toggle Door Swing / Flip Active Item | When entity selected |
| | `F` | Toggle Door Hinge (Left/Right) | Door selected |
| | `Shift` (Hold) | Orthogonal Lock (0°, 45°, 90°) / Constrain Proportions | Drag / Wall Tool |
| | `Alt` (Hold) | Duplicate on Drag | Dragging item |
| | `R` | Rotate Selected Item 90° Clockwise | Item selected |
| | `Delete` / `Backspace` | Delete Selected Item(s) | Entity selected |
| | `Arrow Keys` | Nudge Selection by 1 cm | Entity selected |
| | `Shift + Arrows` | Nudge Selection by 10 cm | Entity selected |
| **Views** | `1` | Switch to 2D Floor Plan Mode | Global |
| | `2` | Switch to 3D Axonometric Mode | Global |
| | `0` | Fit View / Zoom All (`zoomToFit`) | Global |
| | `+` / `-` | Zoom In / Zoom Out | Global |
| | `G` | Toggle Floor Grid Display | Canvas |
| **History & Files**| `Ctrl + Z` | Undo Last Action | Global |
| | `Ctrl + Y` / `Ctrl+Shift+Z` | Redo Action | Global |
| | `Ctrl + S` | Save Project (`localStorage`) | Global |
| | `Ctrl + E` | Open Export Modal (PNG / PDF / JSON) | Global |
| | `Ctrl + O` | Open Project JSON Import | Global |

---

## 6. Harbour Blue & Ochre UI Component Architecture

In alignment with the user-approved visual design identity:
1. **Palette Integration**:
   - Canvas Workspace: `#0a0b0d` (Deep Obsidian Black).
   - Sidebar & Panels: `#121316` surface, `#262933` borders.
   - Primary Accent & Focus: `#d99b26` (Architectural Ochre-Yellow), hover highlight `#f0ad2c`.
   - Structural Framing & Glazing Glaze: `#28425d` / `#5a8cb2` (Harbour Blue).
   - Drafting Ink & High-Contrast Labels: `#EAE7DF` (Warm Drafting Cream).
2. **Typography**:
   - Application Shell, Toolbars, and Menus: Modern clean architectural sans (`-apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`) with 0.05em uppercase letter spacing.
   - Dimensions, Coordinates, and Numeric Inputs: High-legibility architectural tabular monospace (`"JetBrains Mono", Consolas, monospace`).
3. **Status Bar Layout**:
   - Anchored at bottom edge of screen:
     `[Mode: 2D Plan] | [Scale: 1:50] | [Snap: 1cm (Grid 10/50)] | Cursor: (X: 320.0, Y: 180.0 cm) | Selection: 1 Item (Bed) | 60 FPS`
