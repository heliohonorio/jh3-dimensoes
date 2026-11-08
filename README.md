# JH3 Dimensões — Calculadora de Orçamentos

Calculadora de impressão 3D para uso diário da família JH3, em celular ou computador, com tema escuro e instalação como PWA.

## Primeiro acesso

Abra a guia **Meus custos** e revise os valores da empresa: rolo, energia, desgaste, taxas e outros itens. Salve uma única vez. As preferências são guardadas no navegador desse aparelho.

## Novo orçamento

1. Opcionalmente, abra **Importar projeto** e escolha um arquivo **.gcode.3mf** ou **.gcode** já fatiado no Bambu Studio/Orca. Peso, tempo, material, impressora e placas são extraídos quando constam do arquivo. O usuário deve conferir a quantidade de peças.
2. Ou informe os gramas, o tempo e a quantidade manualmente.
3. Selecione **um lucro desejado** por orçamento: **25%, 50%, 75%, 100%, 150% ou Personalizado**.
4. Calcule o preço, confira o resultado e compartilhe com o cliente.

**100% e 150% são acréscimos sobre o custo, não margens de lucro sobre o preço de venda.** Fórmula: preço base = custo × (1 + percentual ÷ 100) ÷ (1 − taxa ÷ 100). Por exemplo, R$ 10,00 de custo + 100% de acréscimo = R$ 20,00 sem taxas. Com taxa de venda, o cálculo preserva o lucro sobre o custo. O sistema aplica um eventual preço mínimo configurado.

O cálculo também considera filamento, perda adicional, eletricidade, desgaste, reserva de falhas, acabamento e demais custos informados.

## MakerWorld e outros sites

- Um **link de página** do MakerWorld pode identificar o nome do modelo. Mas uma página pública não fornece necessariamente os dados fatiados para a **A1 Mini**. O aplicativo não inventa números.
- Um **link HTTPS direto** para arquivo fatiado pode ser importado automaticamente caso o site permita download pelo navegador (CORS). Links de páginas HTML não são a mesma coisa que arquivos de impressão.
- Para importar **peso e tempo com segurança**, abra o projeto no **Bambu Studio**, selecione o perfil **A1 Mini**, fatie e use **Export plate sliced file**. No site, escolha esse arquivo no campo **Importar projeto**.
- STL, OBJ e arquivos 3MF não fatiados contêm geometria, mas não resultados confiáveis de tempo e gramas. Arquivos destinados a outra impressora exigem novo fatiamento.
- O importador soma o consumo de múltiplas placas quando todas contêm dados completos. Não altera a quantidade de peças automaticamente, porque essa informação pode ser ambígua.

A leitura dos arquivos é local e não envia arquivos para um servidor.

## Privacidade

O projeto usa HTML, CSS e JavaScript estáticos, sem banco de dados. Custos, rascunhos e os últimos oito orçamentos são armazenados apenas no aparelho e não sincronizam com outros celulares ou computadores. O orçamento enviado ao cliente não revela os custos internos nem o lucro.

## Publicação

GitHub Pages: https://heliohonorio.github.io/jh3-dimensoes/

Repositório: https://github.com/heliohonorio/jh3-dimensoes

No iPhone, abra pelo Safari e escolha **Compartilhar → Adicionar à Tela de Início** para instalar.

## Testes

Os testes unitários, de navegação móvel e de importação são executados no GitHub Actions.

- Cálculo e arquivos: `node --test tests/calc.test.mjs tests/currency.test.mjs tests/project-import.test.mjs`
- Aplicativo com navegador: `node tests/browser.test.mjs` (requer Playwright e Chromium)
