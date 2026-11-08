# JH3 Dimensões — Calculadora de Orçamentos

Calculadora para impressão 3D com interface simples, feita para uso diário da equipe JH3 em celular ou computador.

## Como usar

1. No primeiro acesso, confira os valores de **Custos fixos** e toque em **Salvar meus custos**.
2. Abra o Bambu Studio e informe o peso total de filamento, quantidade de peças e tempo total do trabalho.
3. Toque em **Calcular meu preço**. O resultado mostra o preço sugerido, o custo de produção e o lucro estimado.
4. Toque em **Compartilhar orçamento**, **Copiar mensagem** ou **Baixar imagem**.

O orçamento do cliente **não mostra** custos internos, reserva de falhas ou margem de lucro.

## O que entra no cálculo

- Filamento utilizado + percentual opcional de perda adicional.
- Energia = horas de impressão × watts médios ÷ 1000 × tarifa em R$/kWh.
- Desgaste da máquina = horas × custo de desgaste por hora.
- Reserva de falhas sobre os custos diretos de impressão.
- Mão de obra manual = minutos de acabamento × valor da hora.
- Extras por pedido (embalagem, argolas etc.).
- Taxas sobre o preço de venda.
- Margem de lucro desejada **sobre a venda** e preço mínimo opcional.

Fórmula do preço sugerido (antes do mínimo): custo ÷ [1 − (margem + taxa) ÷ 100]. Resultado arredondado para cima em centavos. A tela de detalhes permite revisar cada custo.

**Atenção:** o custo do rolo, da luz, o consumo médio, o desgaste e outros valores iniciais são **somente exemplos**, não estimativas oficiais da impressora nem preços reais de compra. Configure de acordo com os seus próprios custos.

## Privacidade e dados

Projeto estático (HTML/CSS/JavaScript). Sem contas, servidor, banco de dados ou acesso à sua conta do GitHub em tempo de uso. Custos, dados preenchidos e até oito orçamentos recentes ficam no armazenamento local **do próprio aparelho**. Eles não são sincronizados entre celular e computador ou entre diferentes membros da família. Limpar os dados do navegador pode apagá-los.

O nome do modelo pode ser identificado de um link de MakerWorld, mas o peso e o tempo devem ser extraídos manualmente do fatiamento feito para a sua impressora.

## Instalação e publicação

O repositório é adequado para GitHub Pages sem etapa de compilação. Em **Settings → Pages → Build and deployment**, use **Deploy from a branch**, branch **main**, pasta **/(root)**. Com a publicação ativada, o endereço será:

https://heliohonorio.github.io/jh3-dimensoes/

No iPhone, abra pelo Safari e use **Compartilhar → Adicionar à Tela de Início**. Os custos são salvos na versão web da máquina em que foram cadastrados.

## Testes

Execute: node --test tests/*.test.mjs

O fluxo do GitHub Actions verifica a matemática e a sintaxe sempre que há alteração na branch principal. Para testar visualmente no computador, sirva o diretório localmente com python3 -m http.server 8000.
