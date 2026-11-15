<p align="center">
  <img src="./docs/assets/brand-banner.svg" alt="SimpleCAD: 2D and 3D Architectural Floorplan Studio" width="100%" />
</p>

<p align="center">
  Offline 2D &amp; 3D floorplan planner with centimeter grid snapping, polygon collision detection, cable routing, and a lightweight Win32 WebView2 shell (~766 KB).
</p>

<p align="center">
  <a href="https://github.com/duartelcunha/SimpleCAD/releases/latest"><strong>Download Windows (.exe)</strong></a> ·
  <a href="#build">Build from Source</a> ·
  <a href="./LICENSE">MIT License</a>
</p>

### 2D Floorplan

<p align="center">
  <img src="./docs/assets/preview-2d.png" alt="SimpleCAD 2D Floorplan" width="100%" />
</p>

### 3D Isometric View

<p align="center">
  <img src="./docs/assets/preview-3d.png" alt="SimpleCAD 3D Isometric View" width="100%" />
</p>

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>2D CAD &amp; SAT Collisions</strong><br/>
      Snap to <code>1 cm</code> / <code>5 cm</code> grids or walls, lock proportions, measure live distances, inspect clearance guides, and detect rotated polygon + door-swing collisions.
    </td>
    <td width="50%" valign="top">
      <strong>4-Panel Articulated Dividers</strong><br/>
      Drag any of the 5 hinge joints directly in both 2D plan view and 3D orbit with presets (<code>Straight</code>, <code>Zig-Zag</code>, <code>L-Corner</code>, <code>Arc</code>, <code>U-Wrap</code>).
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>17 Parametric Furniture Archetypes</strong><br/>
      Distinct 2D symbols and multi-part 3D geometry, plus an offline text parser (e.g. <code>Desk 140x65x75</code>, <code>Rug 2m x 1.4m</code>).
    </td>
    <td width="50%" valign="top">
      <strong>Cable &amp; Outlet Telemetry</strong><br/>
      Route cables directly or along walls, track exact length (<code>m</code>) vs threshold limits, and place wall outlets.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>Portable I/O &amp; Layouts</strong><br/>
      Switch saved room layouts, import/export <code>.json</code> project files, or export <code>2×</code> Retina <code>.png</code> plans.
    </td>
    <td width="50%" valign="top">
      <strong>Lightweight Native Shell</strong><br/>
      Compiles into a standalone <code>~766 KB</code> Win32 Edge WebView2 binary with an optional NSIS installer, or runs statically in any browser.
    </td>
  </tr>
</table>

## Run

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>Windows Desktop</strong><br/>
      Download <a href="https://github.com/duartelcunha/SimpleCAD/releases/latest"><code>SimpleCAD-Setup.exe</code></a> (installer) or standalone <code>SimpleCAD.exe</code>. Uses the built-in Edge WebView2 runtime on Windows 10/11.
    </td>
    <td width="50%" valign="top">
      <strong>Static Browser</strong><br/>
      Serve the repository root with any local HTTP server (<code>python -m http.server 4173</code>) and open <code>http://localhost:4173</code>.
    </td>
  </tr>
</table>

## Build

Requires Rust (`x86_64-pc-windows-msvc`) and optionally NSIS 3.x (`makensis.exe`):

```powershell
cargo build --manifest-path .\native\Cargo.toml --release
Copy-Item .\native\target\release\SimpleCAD.exe .\SimpleCAD.exe -Force

# Optional installer
makensis .\native\installer.nsi
```

## Project Layout

| Path | Role |
| :--- | :--- |
| `index.html`, `styles.css`, `app.js`, `default-room.js` | Offline CAD engine, 2D/3D canvas renderers, and editor UI |
| `native/` | Rust (`tao` + `wry`) custom-protocol WebView2 host (`src/main.rs`, `build.rs`, `installer.nsi`) |
| `icon.svg`, `icon.ico`, `docs/assets/` | `04 Folded Screen` brand identity and README media |
