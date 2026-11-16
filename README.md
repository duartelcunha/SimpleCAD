<p align="center">
  <img src="./docs/assets/brand-banner.svg" alt="SimpleCAD: 2D and 3D Architectural Floorplan Studio" width="100%" />
</p>

## What it is

SimpleCAD is an offline room planner for trying furniture arrangements before moving things around. Edit a rectangular room in 2D, inspect it in 3D, check clearances and cable lengths, and save the arrangement as a project file.

The editor supports rotated furniture, articulated dividers, centimeter snapping, doors, windows, outlets, undo/redo, saved layouts, JSON import/export and PNG export. It runs as a static web page or in a small Windows WebView2 shell.

<p align="center">
  <img src="./docs/assets/preview-2d.png" alt="SimpleCAD 2D floorplan" width="100%" />
  <img src="./docs/assets/preview-3d.png" alt="SimpleCAD 3D view" width="100%" />
</p>

## Try it

For Windows, see the [published releases](https://github.com/duartelcunha/SimpleCAD/releases). Release downloads can lag behind the source branch. The desktop app requires Microsoft Edge WebView2 Runtime.

To try the source, open `index.html` in a browser, or serve the repository locally:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. Try entering `Desk 120x60x75` in the quick-add field, switch between 2D and 3D, and use the JSON dialog to save a portable copy. The editor also saves to the browser's local storage; the desktop app uses its own WebView2 profile.

The current editor has one rectangular room, with each side limited to 100–2000 cm on import. Invalid files, unsupported versions and dimensions outside this range are rejected before replacing the open project. Multi-room buildings, editable wall graphs and layers are proposals; the synthetic v3 projects in `projects/` are not supported by the editor.

If browser storage is unavailable or full, the editor displays a persistent warning: export JSON before closing to keep your work. An unreadable saved project is preserved instead of being overwritten by the demo; a valid import or an explicitly confirmed demo reset enables saving again. Preview links with `?pure=1` never change the saved project.

## Technical details

Read [STATUS.md](STATUS.md) for the current handoff and [AGENTS.md](AGENTS.md) for repository guidance. The app uses plain JavaScript, CSS and Canvas; the Windows-only native shell uses Rust, `winit` and `wry`. Wry's optional Unix features are disabled; the lockfile contains no GTK or glib packages. The source is available under the [MIT license](LICENSE).

Build on Windows with Rust's MSVC toolchain. NSIS is needed only for the installer:

```powershell
cargo build --manifest-path .\native\Cargo.toml --release --locked
Copy-Item .\native\target\release\simplecad.exe .\SimpleCAD.exe -Force
makensis .\native\installer.nsi
```

Run the real browser regression suite with an existing Chromium installation:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:browser
```

By default it uses Playwright's installed Chromium. Set `SIMPLECAD_BROWSER_PATH` to the absolute path of an existing Chromium-based browser if needed. To reuse an existing Playwright installation without installing packages, set `SIMPLECAD_PLAYWRIGHT_MODULE` to its absolute module directory. The suite runs headlessly with isolated profiles and synthetic data. It covers resizing, touch gestures, collisions, imports, persistence and PNG exports through the actual UI.

Syntax and older synthetic checks:

```powershell
node --check .\app.js
node --check .\default-room.js
node --check .\project-data.js
node .\tests\verify-all.js
node .\benchmarks\validate-projects.js
node .\benchmarks\cad-benchmark.js
```

The older `verify-all` and benchmark scripts check source text, documents, synthetic fixtures and separate algorithm prototypes. They do not run the application in a browser. The benchmark uses a simulated canvas, so its throughput figures do not establish browser frame rates or application performance guarantees.

`app.js` contains the editor and renderers, `project-data.js` validates imports and saved projects, `default-room.js` contains the factory scene and furniture definitions, and `native/` contains the Windows host and installer. The architecture and performance documents in `docs/` describe proposed work; their status notes distinguish that work from the current editor.
