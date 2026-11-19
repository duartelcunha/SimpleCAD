# Estado do projeto

**Em uma frase:** planear a disposição dos móveis de um quarto retangular, em 2D e 3D (modos `Solid` e `Sketch`), 100% offline.

**Estado:** ramo `main` consolidado e pronto para a release standalone `v1.1.0` (`SimpleCAD.exe`), com limites de dimensão do quarto unificados em `100–2000 cm`, layout responsivo corrigido em `768×1024` e `390×844`, oclusão 3D verificada, auditoria independente e suite real de browser com 23 casos.

**Última atualização:** 2026-11-19.

## Onde está
- Ramo ativo e publicado: `main` (com o histórico do [PR #1](https://github.com/duartelcunha/SimpleCAD/pull/1) integrado e ramos temporários removidos).
- Distribuição Windows: executável portátil standalone `SimpleCAD.exe` publicado no GitHub Releases (`v1.1.0`), com todos os ativos web embebidos em tempo de compilação.
- Identidade visual unificada: ícone de planos espaciais + logótipo vetorial (`icon.svg`, `icon.ico`, `native/icon_64.rgba`, cabeçalho em `index.html` e banner `docs/assets/brand-banner.svg`).

## Corrigido e verificado
- **Dimensões do quarto unificadas (`100–2000 cm`)**: os campos numéricos `#room-w` e `#room-h` em `index.html` e os respetivos limites em `app.js` aceitam agora `100–2000 cm`, alinhados com a validação estrita de `project-data.js`.
- **Responsividade em tablet e mobile (`768×1024` e `390×844`)**: eliminados o scroll horizontal e o corte de botões em `#main-toolbar` e na barra flutuante `#object-hud` (`.hud-actions`), mantido o badge `#cursor-coords` visível em `.bottom-readout` e posicionado o bloco de escala 2D (`ESCALA 1:50 | SIMPLECAD ARCH`) com margem limpa acima de `.bottom-readout`.
- **Oclusão e ordenação 3D (`app.js`)**: `addBox3D` guarda os limites projetados no ecrã (`sMinX..sMaxY`) e `comparePrisms3D` ignora pares disjuntos no ecrã e exige consenso entre todos os eixos separadores antes de impor ordem topológica, eliminando ciclos que faziam a mesinha traseira e os puxadores traseiros atravessarem o roupeiro na vista 3D.
- **Limpeza do repositório**: removidos os ficheiros mortos `docs/assets/preview-2d.png` e `docs/assets/preview-3d.png`, corrigido o comentário desatualizado `(360×420 cm)` em `default-room.js`, uniformizados os parâmetros `?v=36` em `index.html` e restaurado `docs/assets/brand-banner.svg` em `README.md` com capturas atualizadas (`docs/assets/studio-plan.png` e `docs/assets/studio-cutaway.png`).
- **Motor e importação (PR #1)**: validação estrita antes de alterar o estado em `project-data.js`, preservação de dados guardados ilegíveis e avisos persistentes de quota, cancelamento seguro de animações com desfazer/refazer e exclusão de controlos/seleção na exportação PNG.
- **Suite real no browser (`tests/browser-engine.cjs`)**: 23 casos verificados (incluindo oclusão 3D `Solid`/`Sketch`, limite `2000 cm` nos controlos do quarto e invariantes responsivas sem corte/scroll em `768×1024` e `390×844`), somando validação de sintaxe JS e a suite sintética anterior (`tests/verify-all.js`, 93 asserções).
- **Verificação visual no browser (desktop + responsivo)**: validados em HTTP local desktop (`1440×900` em `2D Solid`, `2D Sketch`, `Cabos`, `3D Solid`, `3D Sketch`), tablet (`768×1024`) e mobile (`390×844` com abertura/fecho da gaveta `#btn-mobile-sheet`), com 0 erros de consola/rede.
- **Host nativo Windows (`native/`)**: usa `winit` + `wry` (WebView2) sem `glib`/GTK; verificações Rust (`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`) e compilação release (`--locked`) de `SimpleCAD.exe` executadas sobre os ativos web finais.

## Decisões e limites
- O editor modela apenas uma divisão retangular (`100–2000 cm` tanto na validação como nos controlos da barra lateral). Os ficheiros v3 em `docs/` e `projects/` continuam a ser propostas não implementadas.
- Os testes antigos (`tests/verify-all.js`) e os ficheiros em `benchmarks/` usam fixtures sintéticas e não medem FPS reais do browser.
- A distribuição Windows é disponibilizada diretamente como executável portátil standalone (`SimpleCAD.exe`), sem necessidade de instalador NSIS (`SimpleCAD-Setup.exe`); binários locais `.exe` continuam ignorados pelo `.gitignore`. Como o executável não tem assinatura digital comercial (Authenticode), o Windows SmartScreen pode mostrar o aviso habitual no primeiro arranque.
