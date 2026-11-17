# SimpleCAD

An offline room planner for working out where your furniture fits before you move it. Draw one room to scale, try a few arrangements and keep the one with enough space for the door to open and enough cable to reach the desk.

[Download for Windows](https://github.com/duartelcunha/SimpleCAD/releases/latest) · [Run in a browser](#try-it) · [Build from source](#technical-details)

<p align="center">
  <a href="docs/assets/studio-plan.png"><img src="docs/assets/studio-plan.png" width="410" alt="Measured plan of a studio bedroom. A 90 cm door swings inward and a 2.33 m cable runs from the desk to the north wall." /></a>
  <a href="docs/assets/studio-cutaway.png"><img src="docs/assets/studio-cutaway.png" width="410" alt="The same bedroom in 3D, with a folding screen between the oak desk and the bed." /></a>
</p>

*Studio bedroom, 4.40 × 3.80 m.* The plan shows the door swing and the cable route. Switch to 3D to see how much of the bed the folding screen hides. Open either drawing for a closer look.

## Try it

**Windows.** The [v1.0.0 release](https://github.com/duartelcunha/SimpleCAD/releases/tag/v1.0.0) offers an installer (`SimpleCAD-Setup.exe`) and a standalone app (`SimpleCAD.exe`). Both use Microsoft Edge WebView2. The screenshots and instructions here follow the current source, which includes changes made after that release.

**Browser.** Download or clone this repository, then open `index.html`. The demo bedroom is ready to edit, and the interface is in Portuguese. If you prefer to serve it locally, run `python -m http.server 4173 --bind 127.0.0.1` in the project folder and open [localhost:4173](http://127.0.0.1:4173).

### Try a desk by the window

1. Under **Adicionar Móvel**, enter `Mesa 120x60x75` and press Enter. The desk is 120 cm wide, 60 cm deep and 75 cm tall.
2. In **2D**, drag the desk under the window. Try a spot by the door as well and check the swing before you settle on a layout.
3. Switch to **3D** and drag to turn the room. Save the arrangement with **Guardar disposição** before trying another position.

The editor saves on this device. Export **JSON** to take an editable copy to another computer or **PNG** to share a drawing. If a storage warning appears, export JSON before closing.

## Technical details

The browser editor uses plain JavaScript and Canvas. The Windows app embeds the same files in a Rust host built with Winit, Wry and WebView2. Projects describe a single rectangular room with sides from 1 to 20 m. The v3 buildings and layers in the design notes are proposals.

<details>
<summary><strong>Build the Windows app</strong></summary>

Install the Rust MSVC toolchain. From the repository root, run

```powershell
cargo build --manifest-path .\native\Cargo.toml --release --locked
Copy-Item .\native\target\release\simplecad.exe .\SimpleCAD.exe -Force
```

To make the installer, run `makensis .\native\installer.nsi` with NSIS available on your path. Rebuild the executable after changing embedded web assets.

</details>

<details>
<summary><strong>Run the browser tests</strong></summary>

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:browser
```

The [Playwright suite](tests/browser-engine.cjs) runs the actual editor headlessly. It checks gestures, geometry, undo, project storage and exports. Use Playwright’s installed Chromium or set `SIMPLECAD_BROWSER_PATH` to an installed Chromium-based browser. Set `SIMPLECAD_PLAYWRIGHT_MODULE` to an absolute module directory to reuse an existing Playwright installation.

The [older checks](tests/verify-all.js) and [benchmarks](benchmarks/) use synthetic fixtures and models. Their timings do not measure browser frame rates.

</details>

[Project status](STATUS.md) · [Contributor notes](AGENTS.md) · [MIT license](LICENSE)
