# SimpleCAD

Read `STATUS.md` before continuing and update it at meaningful handoffs. `README.md` covers running and building the app.

## Code map

- `app.js`: editor state, interaction, 2D/3D rendering, project import/export and local persistence.
- `project-data.js`: validation of imported and persisted project data before state changes.
- `default-room.js`: factory project and furniture definitions.
- `index.html`, `styles.css`: UI and style tokens.
- `native/`: Rust WebView2 host, embedded assets and NSIS installer.
- `tests/browser-engine.cjs`: headless regression checks of the real application through its UI.
- Other `tests/` scripts, `benchmarks/`, `projects/`: synthetic checks and proposal fixtures.

## Verification

Run JavaScript syntax checks and `npm.cmd run test:browser` as documented in the README. For user-facing changes, also exercise affected flows not covered by the suite, including responsive panels. Record what was actually checked and any limitations. Invalid imports must leave the open project, saved project and undo history untouched.

The native binary embeds the web files at build time. Rebuild it after changing those files or the icons; rebuild the installer after the binary. Local binaries are ignored by Git and do not update published releases.

The current data model is one rectangular room. The v3 wall/layer/building documents and fixtures are proposals; do not describe them as implemented or use synthetic benchmark results as application frame-rate evidence.
