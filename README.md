# JH3 Dimensões — Calculadora de Orçamentos

Calculadora de impressão 3D para uso diário da família JH3, em celular ou computador, com tema escuro e instalação como PWA.

## Tela inicial

O aplicativo começa **somente com duas opções grandes**:

- **Importar projeto:** abre uma página própria para escolher um arquivo do celular ou colar um link. Quando conseguir ler dados, aparece **Continuar com este projeto**. Só então o formulário do orçamento é aberto, com o nome, peso e tempo preenchidos quando disponíveis.
- **Novo orçamento:** abre diretamente o formulário manual com os dados da peça, outros gastos e lucro, **sem mostrar a área de importação**.

A engrenagem discreta no cabeçalho abre **Meus custos**. Na primeira utilização, configure o preço do rolo, conta de luz, desgaste e demais valores. Os custos ficam salvos somente no navegador do aparelho.

## Como calcular

1. Escolha **Novo orçamento** ou **Importar projeto** na tela inicial.
2. Confira ou preencha os gramas, o tempo e a quantidade da impressão.
3. Escolha **um lucro desejado** para esse pedido: **25%, 50%, 75%, 100%, 150% ou Personalizado**.
4. Toque em **Calcular e somar tudo**. O resultado apresenta custo por peça, lucro por peça e a soma final.
5. Confira e compartilhe com o cliente ou salve a imagem. Só essas ações registram o orçamento no histórico. Recalcular, editar o preço ou copiar a mensagem não salva o orçamento.

**Ajustar o preço final:** depois de calcular, **toque na caneta ao lado do valor total** para abrir o campo de edição. Digite apenas números: `4300` vira **R$ 43,00**, `4200` vira **R$ 42,00**. Ao confirmar, o custo de produção não muda; o lucro é recalculado e a imagem do orçamento, os valores por peça passam a usar o preço escolhido. O histórico é atualizado somente se você compartilhar ou salvar a imagem. Caso o preço fique abaixo do custo, o sistema informa o prejuízo. A mensagem enviada ao cliente continua sem preços; somente a imagem mostra os valores.

O botão **Voltar ao início** permite mudar de caminho. **Limpar dados** inicia outro formulário sem apagar os custos configurados ou o histórico.

**O lucro é um acréscimo sobre o custo, não uma margem sobre o preço de venda.** O campo Personalizado não tem teto percentual predefinido: aceita 1.000%, 2.500%, 10.000% e outros percentuais que possam ser calculados com segurança. Fórmula: preço = custo × (1 + percentual ÷ 100) ÷ (1 − taxa ÷ 100). Exemplo sem taxas: custo R$ 10,00 + 100% = venda R$ 20,00; + 1.000% = R$ 110,00; + 2.500% = R$ 260,00. Com taxas, o cálculo preserva o acréscimo escolhido sobre o custo. O preço mínimo opcional também continua válido.

O cálculo também considera filamento, perda adicional, eletricidade, desgaste, reserva de falhas, acabamento e demais custos informados.

O custo de produção é calculado para **a impressão inteira** e dividido pela quantidade apenas para mostrar a média por peça. O lucro é calculado sobre esse custo, separadamente. Na soma final, os componentes são apresentados em centavos e ajustados apenas na exibição para sempre fechar exatamente o valor total. Médias por peça podem ter um centavo de diferença ao serem multiplicadas devido ao arredondamento; o total do pedido é a referência.

## MakerWorld e outros sites

- Um **link de página** do MakerWorld pode identificar o nome do modelo. Mas uma página pública não fornece necessariamente os dados fatiados para a **A1 Mini**. O aplicativo não inventa números.
- Um **link HTTPS direto** para arquivo fatiado pode ser importado automaticamente caso o site permita download pelo navegador (CORS). Links de páginas HTML não são a mesma coisa que arquivos de impressão.
- Para importar **peso e tempo com segurança**, abra o projeto no **Bambu Studio**, selecione o perfil **A1 Mini**, fatie e use **Export plate sliced file**. No site, escolha esse arquivo no campo **Importar projeto**.
- STL, OBJ e arquivos 3MF não fatiados contêm geometria, mas não resultados confiáveis de tempo e gramas. Arquivos destinados a outra impressora exigem novo fatiamento.
- O importador soma o consumo de múltiplas placas quando todas contêm dados completos. Não altera a quantidade de peças automaticamente, porque essa informação pode ser ambígua.

A leitura dos arquivos é local e não envia arquivos para um servidor.

## Orçamento enviado ao cliente

A imagem oficial segue a identidade visual JH3 DIMENSÕES: fundo escuro, impressão 3D e destaque ciano para o total. A imagem é montada para cada pedido, com o nome real do projeto, a quantidade e o preço final. Nenhum custo interno nem lucro é exibido.

A mensagem enviada junto à imagem contém **somente**:

> JH3 DIMENSÕES
>
> Segue orçamento do seu Projeto 3D.

Os valores e a quantidade aparecem apenas na imagem, nunca no texto compartilhado. O mesmo vale para copiar a mensagem.

## Privacidade

O projeto usa HTML, CSS e JavaScript estáticos, sem banco de dados. Custos e os últimos oito orçamentos são armazenados apenas no aparelho e não sincronizam com outros celulares ou computadores. Novos acessos começam sempre na tela inicial, sem recuperar automaticamente um orçamento em andamento. O orçamento enviado ao cliente não revela os custos internos nem o lucro.

## Publicação

GitHub Pages: https://heliohonorio.github.io/jh3-dimensoes/

Repositório: https://github.com/heliohonorio/jh3-dimensoes

No iPhone, abra pelo Safari e escolha **Compartilhar → Adicionar à Tela de Início** para instalar.

## Testes

Os testes unitários, de navegação móvel e de importação são executados no GitHub Actions.

- Cálculo e arquivos: `node --test tests/calc.test.mjs tests/currency.test.mjs tests/project-import.test.mjs`
- Aplicativo com navegador: `node tests/browser.test.mjs` (requer Playwright e Chromium)
