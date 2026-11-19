# Estado do projeto

**Em uma frase:** planear a disposição dos móveis de um quarto retangular, em 2D e 3D (modos `Solid` e `Sketch`), 100% offline e com sincronização instantânea para telemóvel via QR Code.

**Estado:** ramo `main` consolidado e publicado com suporte completo a telemóvel e acesso online sem servidores pagos (**PWA no GitHub Pages** + **Sincronização Ao Vivo PC ↔ Telemóvel por QR Code** embutida no `SimpleCAD.exe` `v1.2.0`), captura de fotografia com 1 toque no móvel selecionado, limites do quarto em `100–2000 cm`, layout responsivo verificado em `768×1024` e `390×844` e suite real de browser com 25 casos.

**Última atualização:** 2026-11-19.

## Onde está
- Ramo ativo e publicado: `main`.
- Web App Online & PWA instalável (100% grátis, sem servidor): `https://duartelcunha.github.io/SimpleCAD/` (`manifest.webmanifest` + Service Worker offline-first `sw.js`).
- Distribuição Windows: executável portátil standalone `SimpleCAD.exe` publicado no GitHub Releases (`v1.2.0`), com todos os ativos web e o servidor local de sincronização Wi-Fi embebidos em tempo de compilação.
- Identidade visual unificada: ícone de planos espaciais + logótipo vetorial (`icon.svg`, `icon.ico`, `native/icon_64.rgba`, cabeçalho em `index.html` e banner `docs/assets/brand-banner.svg`).

## Corrigido e verificado
- **Telemóvel, QR Code, Câmara 1-Toque & PWA Online (`native/src/main.rs`, `app.js`, `index.html`, `manifest.webmanifest`, `sw.js`)**:
  - **Em Casa (Ao Vivo com o PC ligado)**: `SimpleCAD.exe` levanta automaticamente um servidor local (`std::net::TcpListener`, zero crates extra) em `0.0.0.0:4173` com token de sessão e estado partilhado em `%LOCALAPPDATA%\SimpleCAD\shared-project.json`. O botão `#btn-mobile-qr` abre um QR Code gerado 100% offline em SVG que liga o telemóvel à planta do PC em tempo real.
  - **Em Qualquer Lugar (4G/5G ou PC desligado)**: o separador **4G/5G** do modal `#qr-dialog` comprime a planta inteira com `CompressionStream('deflate-raw')` num link/QR Code `https://duartelcunha.github.io/SimpleCAD/#p=...` que abre a planta em qualquer rede móvel sem servidores intermédios.
  - **Fotografia de móveis no telemóvel com 1 toque**: além do anexo rápido ao criar móveis, o inspetor do móvel selecionado inclui agora o botão direto **Fotografar / Trocar Foto** (`#inp-sel-photo` com `capture="environment"`), que comprime a foto localmente e a sincroniza de imediato com o PC.
- **Dimensões do quarto unificadas (`100–2000 cm`)**: os campos numéricos `#room-w` e `#room-h` em `index.html` e os respetivos limites em `app.js` aceitam `100–2000 cm`, alinhados com a validação estrita de `project-data.js`.
- **Responsividade em tablet e mobile (`768×1024` e `390×844`)**: eliminados o scroll horizontal e o corte de botões em `#main-toolbar` e na barra flutuante `#object-hud` (`.hud-actions`), mantido o badge `#cursor-coords` visível em `.bottom-readout` e posicionado o bloco de escala 2D (`ESCALA 1:50 | SIMPLECAD ARCH`) com margem limpa acima de `.bottom-readout`.
- **Oclusão e ordenação 3D (`app.js`)**: `addBox3D` guarda os limites projetados no ecrã (`sMinX..sMaxY`) e `comparePrisms3D` ignora pares disjuntos no ecrã e exige consenso entre todos os eixos separadores antes de impor ordem topológica, eliminando ciclos que faziam a mesinha traseira e os puxadores traseiros atravessarem o roupeiro na vista 3D.
- **Suite real no browser (`tests/browser-engine.cjs`)**: 25 casos verificados (incluindo oclusão 3D `Solid`/`Sketch`, limite `2000 cm`, invariantes responsivas em `768×1024` e `390×844`, geração de QR Code SVG + round-trip/rejeição segura de links comprimidos `#p=` e sincronização bidirecional PC ↔ Telemóvel `/api/project` com captura de fotografia), somando validação de sintaxe JS e a suite sintética anterior (`tests/verify-all.js`, 93 asserções).
- **Host nativo Windows (`native/`)**: usa `winit` + `wry` (WebView2) + `std::net` sem `glib`/GTK; verificações Rust (`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`) e compilação release (`--locked`) de `SimpleCAD.exe` executadas sobre os ativos web finais.

## Decisões e limites
- O editor modela apenas uma divisão retangular (`100–2000 cm` tanto na validação como nos controlos da barra lateral). Os ficheiros v3 em `docs/` e `projects/` continuam a ser propostas não implementadas.
- Os testes antigos (`tests/verify-all.js`) e os ficheiros em `benchmarks/` usam fixtures sintéticas e não medem FPS reais do browser.
- A sincronização ao vivo com fotos em tempo real (`?sync=...`) funciona diretamente na rede local (Wi-Fi) enquanto o `SimpleCAD.exe` estiver aberto no PC; para acesso fora de casa em 4G/5G sem servidor, o QR Code / link `#p=...` transporta a geometria completa da planta comprimida no próprio URL (excluindo fotos base64 para manter o código QR compacto e legível).
- A distribuição Windows é disponibilizada diretamente como executável portátil standalone (`SimpleCAD.exe`), sem necessidade de instalador NSIS (`SimpleCAD-Setup.exe`); binários locais `.exe` continuam ignorados pelo `.gitignore`. Como o executável não tem assinatura digital comercial (Authenticode), o Windows SmartScreen pode mostrar o aviso habitual no primeiro arranque.
