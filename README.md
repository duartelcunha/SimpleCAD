<p align="center">
  <img src="./docs/assets/brand-banner.svg" alt="SimpleCAD — 2D & 3D Floorplan Studio" width="100%" />
</p>

<p align="center">
  <strong>Offline 2D &amp; 3D interior floorplan studio — built for centimeter accuracy, furniture collision detection, cable routing, and zero-dependency Windows distribution.</strong>
</p>

<p align="center">
  <a href="https://github.com/duartelcunha/SimpleCAD/releases/latest">Download Windows Installer</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#build-from-source">Build from Source</a>
</p>

---

## Preview

| 2D Architectural Floorplan | 3D Isometric Studio |
| :---: | :---: |
| ![SimpleCAD 2D Floorplan View](./docs/assets/preview-2d.png) | ![SimpleCAD 3D Isometric View](./docs/assets/preview-3d.png) |

---

## Features

- **Centimeter-Exact 2D CAD Engine** — Drag, rotate, snap to walls/edges (`5 cm` or `1 cm` grids), lock proportions, measure distances live, and export high-DPI architectural PNGs.
- **SAT Polygon Collision & Clearance Detection** — Real-time Separating Axis Theorem collision checking across rotated items, door swing arcs, and folding dividers, plus live wall/item clearance guides.
- **Interactive 4-Panel Articulated Dividers in 2D & 3D** — Grab any of the 5 vertical hinge joints directly in either 2D plan view or 3D isometric orbit to shape screens cleanly (`Straight`, `Zig-Zag`, `L-Corner`, `Arc`, `U-Wrap`) with automatic perimeter preservation.
- **17 Parametric Furniture Archetypes** — Beds, nightstands, wardrobes, desks, chairs, sofas, TV consoles, workstations, shelving, easels, mirrors, floor lamps, plants, appliances, rugs, dividers, and generic volumes render distinct CAD symbols in 2D and multi-part architectural geometry in 3D.
- **Cable Routing & Telemetry** — Trace HDMI, DisplayPort, Ethernet, or power paths directly or along room walls, track exact cable lengths (`m`) against warning/maximum thresholds, and inspect electrical outlet placement.
- **Offline Quick-Add Parser** — Create items from plain text dimensions (e.g., `Secretária 140x65x75`, `Mesa 1.2m x 0.6m`) completely offline with zero external APIs.
- **Portable JSON Projects** — Switch between saved room layouts (`opt1`, `opt2`, custom presets) or import/export full floorplan JSON files (`room`, `items`, `catalog`, `layouts`, `cables`).
- **Lightweight Win32 Shell (`~760 KB` Binary)** — Embedded offline assets served via custom WebView2 protocol inside a pure Rust (`tao` + `wry`) executable with no Node/Electron runtime overhead.

---

## Visual System

Designed with an obsidian-and-brass architectural drafting palette built for long planning sessions without visual noise:

| Token | Hex | Role |
| :--- | :--- | :--- |
| **Obsidian Mate** | `#0D0E10` / `#121316` | Primary canvas & flat tonal panels |
| **Architectural Bone** | `#EDEAE4` / `#9A9891` | Drafting ink, geometry outlines & primary actions |
| **Brushed Brass** | `#C8A96E` | Active CAD states, hinge joints & selected geometry |

---

## Quick Start

### Windows App (Recommended)

1. Download **`SimpleCAD-Setup.exe`** (installer, ~300 KB) or standalone **`SimpleCAD.exe`** (~762 KB) from the [latest release](https://github.com/duartelcunha/SimpleCAD/releases/latest).
2. Run **SimpleCAD** — requires only Microsoft Edge WebView2 Runtime (built into Windows 10/11).
3. Use the **`.JSON`** modal button in the top toolbar to import, export, or back up your own room layouts at any time.

### Web / Browser Mode

Open [`index.html`](./index.html) via any static local server:

```bash
python -m http.server 4173
# Open http://localhost:4173
```

---

## Architecture

```text
SimpleCAD/
├── index.html              # Application shell, toolbar, inspector & native dialogs
├── styles.css              # Obsidian/Bone/Brass CSS design system & responsive layouts
├── default-room.js         # Neutral Estúdio Demo (360×420 cm), 17 archetypes & offline parser
├── app.js                  # 2D SAT engine, 3D painter's projection, cables, undo/redo & JSON I/O
├── icon.svg / icon.ico     # 04 Folded Screen brand mark assets
├── docs/assets/            # Vector banner & verified UI previews
└── native/                 # Rust Win32 WebView2 host + NSIS installer script
    ├── Cargo.toml
    ├── build.rs            # Embeds multi-resolution app icon & Windows metadata
    ├── installer.nsi       # NSIS LZMA silent/interactive Windows installer
    └── src/main.rs         # Single-instance custom-protocol WebView2 host
```

---

## Build from Source

### Prerequisites

- **Rust toolchain** (`cargo` with MSVC `x86_64-pc-windows-msvc` target)
- **NSIS 3.x** (`makensis.exe`, optional, for packaging `SimpleCAD-Setup.exe`)

### Compile Binary & Installer

```powershell
# 1. Build optimized Win32 executable (~760 KB)
cargo build --manifest-path .\native\Cargo.toml --release
Copy-Item .\native\target\release\SimpleCAD.exe .\SimpleCAD.exe -Force

# 2. (Optional) Build NSIS setup package
makensis .\native\installer.nsi
```

---

## JSON Project Format

Rooms can be shared, versioned, or loaded locally via the JSON modal (`room`, `cables`, `items` or `catalog`, `layouts`):

```json
{
  "version": 2,
  "app": "SimpleCAD",
  "room": { "name": "Studio", "w": 360, "h": 420, "wallThickness": 14, "doors": [], "windows": [], "outlets": [] },
  "cables": [],
  "items": [],
  "layouts": []
}
```

---

## License

MIT © [Duarte Cunha](https://github.com/duartelcunha)
