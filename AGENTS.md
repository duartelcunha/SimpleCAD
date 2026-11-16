# SimpleCAD

Read `STATUS.md` before continuing and update it at meaningful handoffs. `README.md` covers running and building the app.

## Code map

- `app.js`: editor state, interaction, 2D/3D rendering, project import/export and local persistence.
- `default-room.js`: factory project and furniture definitions.
- `index.html`, `styles.css`: UI and style tokens.
- `native/`: Rust WebView2 host, embedded assets and NSIS installer.
- `tests/`, `benchmarks/`, `projects/`: synthetic checks and proposal fixtures, not browser end-to-end coverage.

## Verification

Run JavaScript syntax checks and the relevant existing scripts listed in the README. For user-facing changes, exercise the actual app in an isolated headless browser: editing, undo/redo, view switching, JSON round trip and mobile panels. Record what was actually checked and any limitations.

The native binary embeds the web files at build time. Rebuild it after changing those files or the icons; rebuild the installer after the binary. Local binaries are ignored by Git and do not update published releases.

The current data model is one rectangular room. The v3 wall/layer/building documents and fixtures are proposals; do not describe them as implemented or use synthetic benchmark results as application frame-rate evidence.
