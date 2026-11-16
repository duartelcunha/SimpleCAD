# Estado do projeto

**Em uma frase:** planear a disposição dos móveis de um quarto, em 2D e 3D, sem depender de serviços externos.

**Estado:** motor herdado revisto e corrigido; validação concluída no browser e no executável Windows. Falta fundir o PR com o OK do Duarte.

**Última atualização:** 2026-11-16, Codex.

## Onde está
- Ramo: `chore/resume-antigravity-cleanup`; [PR #1](https://github.com/duartelcunha/SimpleCAD/pull/1).
- A recuperação anterior preservou o trabalho herdado e repôs a marca escolhida a partir dos originais, com ícones Windows correspondentes.
- Pedido atual: rever o motor e corrigir os problemas encontrados, incluindo o alerta do glib.

## Corrigido e verificado
- Importar um ficheiro inválido já não altera parcialmente o projeto nem o histórico. Valores numéricos com HTML são recusados antes de chegarem à interface. Opções e cores dos cabos sobrevivem à exportação e reimportação.
- Ficheiros v3, estruturas não suportadas e dimensões fora dos limites são recusados; não são convertidos com perda silenciosa de informação.
- Um arrasto seguido de pinça conserva a gravação e o desfazer. Redimensionar um lado preserva a outra dimensão; Shift conserva as proporções.
- Interromper uma animação conserva o destino da operação e o histórico. A última disposição não pode ser apagada; projetos antigos com disposições vazias são recuperados.
- Exportar PNG já não altera a seleção 3D nem inclui os controlos de edição. Sombras e rodapé corrigidos.
- A pré-visualização não substitui o projeto guardado. Dados guardados ilegíveis são preservados; falhas de gravação têm aviso persistente para exportar JSON.
- Suite permanente de browser: 20 casos passaram com a aplicação real, perfis isolados e dados fictícios. Sintaxe JavaScript e suite sintética anterior passaram. Revisão independente concluída; os problemas encontrados nessa revisão foram corrigidos e voltaram a ser testados.
- Tao substituído por Winit; funcionalidades Unix desnecessárias do Wry desativadas. O lock já não contém glib/GTK. Compilação Rust release, Clippy e formatação passaram.
- Executável final recompilado e usado com WebView2 numa secretária invisível: abertura, redimensionamento, edição, desfazer/refazer, 2D/3D, JSON, PNG, fecho e persistência após reiniciar passaram. Nenhum ecrã ou perfil do utilizador foi usado.
- Instalador NSIS recompilado a partir desse executável; os ficheiros fonte permaneceram iguais entre a compilação, o teste e o empacotamento.

## Próximo passo
Fundir o PR apenas com o OK do Duarte, pelo processo de merge da máquina. O [alerta glib](https://github.com/duartelcunha/SimpleCAD/security/dependabot/1) continua aberto na main: a dependência foi removida neste ramo, sem ocultar o alerta. Confirmar o estado no GitHub depois do merge.

## Decisões e limites
- O editor continua a ter uma divisão retangular. Edifícios, pisos, camadas e paredes interiores dos documentos e exemplos v3 são propostas.
- Os testes antigos e os benchmarks são sintéticos; não medem o desempenho da aplicação no browser.
- A verificação nativa decorreu numa secretária invisível; não foi comparada visualmente com a secretária normal. O instalador não foi executado e nenhuma release foi publicada.
- Os binários locais são ignorados pelo Git; não se apagaram projetos, propostas nem histórico.
