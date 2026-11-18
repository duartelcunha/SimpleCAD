# Estado do projeto

**Em uma frase:** planear a disposição dos móveis de um quarto retangular, em 2D e 3D (modos `Solid` e `Sketch`), 100% offline.

**Estado:** ramo `main` limpo e consolidado após o merge do PR #1, com a marca final aplicada, o erro de ordenação/oclusão 3D resolvido, ativos obsoletos removidos, vistas do README regeneradas, auditoria independente e suite de browser verificada (21 casos).

**Última atualização:** 2026-11-18.

## Onde está
- Ramo ativo e publicado: `main`. O ramo `chore/resume-antigravity-cleanup` (que deu origem ao [PR #1](https://github.com/duartelcunha/SimpleCAD/pull/1)) teve o seu diff verificado como totalmente integrado em `main` e foi removido localmente e do remoto.
- Identidade visual unificada: ícone de planos espaciais + logótipo vetorial (`icon.svg`, `icon.ico`, `native/icon_64.rgba`, cabeçalho em `index.html` e banner `docs/assets/brand-banner.svg`).

## Corrigido e verificado
- **Oclusão e ordenação 3D (`app.js`)**: `addBox3D` guarda os limites projetados no ecrã (`sMinX..sMaxY`) e `comparePrisms3D` ignora pares disjuntos no ecrã e exige consenso entre todos os eixos separadores antes de impor ordem topológica, eliminando ciclos que faziam a mesinha traseira e os puxadores traseiros atravessarem o roupeiro na vista 3D.
- **Limpeza do repositório**: removidos os ficheiros mortos `docs/assets/preview-2d.png` e `docs/assets/preview-3d.png`, corrigido o comentário desatualizado `(360×420 cm)` em `default-room.js`, uniformizados os parâmetros `?v=35` em `index.html` e restaurado `docs/assets/brand-banner.svg` em `README.md` com capturas atualizadas (`docs/assets/studio-plan.png` e `docs/assets/studio-cutaway.png`).
- **Motor e importação (PR #1)**: validação estrita antes de alterar o estado em `project-data.js`, preservação de dados guardados ilegíveis e avisos persistentes de quota, cancelamento seguro de animações com desfazer/refazer e exclusão de controlos/seleção na exportação PNG.
- **Suite real no browser (`tests/browser-engine.cjs`)**: 21 casos verificados (incluindo regressão com controlos positivo/oculto para mesinha traseira e puxadores do roupeiro nos modos 3D `Solid` e `Sketch`), somando validação de sintaxe JS e a suite sintética anterior (`tests/verify-all.js`, 93 asserções).
- **Verificação visual no browser (desktop + responsivo)**: validados em HTTP local `2D Solid`, `2D Sketch`, `Cabos`, `3D Solid` (padrão + órbita traseira), `3D Sketch` (padrão + órbita), `docs/assets/brand-banner.svg`, tablet (`768×1024`) e mobile (`390×844` com abertura/fecho de `#btn-mobile-sheet`), com 0 erros de consola/rede.
- **Host nativo Windows (`native/`)**: usa `winit` + `wry` sem `glib`/GTK; verificações Rust (`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`) e compilação release de `SimpleCAD.exe` executadas sobre os ativos web finais.

## Decisões e limites
- O editor modela apenas uma divisão retangular (`100–2000 cm` na validação; os campos numéricos da barra lateral limitam atualmente a entrada direta até `1500 cm`). Os ficheiros v3 em `docs/` e `projects/` continuam a ser propostas não implementadas.
- Os testes antigos (`tests/verify-all.js`) e os ficheiros em `benchmarks/` usam fixtures sintéticas e não medem FPS reais do browser.
- Em viewports estreitos pré-existentes (`768×1024` e `390×844`), a barra de ferramentas superior e a barra flutuante de seleção recorrem a scroll horizontal (podendo encobrir o botão mais à direita até deslizar) e o bloco de escala Sketch em `768×1024` aproxima-se do badge inferior esquerdo de coordenadas.
- `makensis.exe` (NSIS) não está instalado neste ambiente, pelo que o instalador `SimpleCAD-Setup.exe` não foi recompilado nesta ronda (binários locais `.exe` são ignorados pelo `.gitignore`; a release publicada no GitHub permanece na `v1.0.0`).
