# JH3 Dimensões · Orçamentos

Calculadora de impressão 3D em português. A interface e a geração de imagem funcionam no navegador. As preferências ficam no aparelho.

## Publicação

Copie o conteúdo deste diretório para a raiz de um repositório. Em Settings → Pages, selecione Deploy from a branch, a branch principal e /(root). O próprio GitHub Pages exibirá a URL após a publicação.

Para testar em um computador, rode `python3 -m http.server 8000` neste diretório e abra http://localhost:8000/.

## Uso

1. Salve os custos do rolo, energia, potência média, desgaste por hora e margem em Configurações.
2. Informe peso e tempo totais do lote fatiado e a quantidade de peças.
3. Calcule e compartilhe a imagem com o cliente. O arquivo inclui a marca e o preço, sem custos internos.

O preço é custo dividido por um menos a margem, com arredondamento para centavos. Para URLs públicas de modelos do MakerWorld, a interface lê o nome disponível no endereço e oferece um atalho para a página. Peso e tempo são preenchidos com os valores do perfil fatiado.
