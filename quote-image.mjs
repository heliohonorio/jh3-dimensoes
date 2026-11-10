// Modelo oficial JH3 Dimensões — imagem enviada ao cliente.
// A imagem exibe somente projeto, quantidade e preço de venda.
const W = 1122, H = 1402;
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
});

function rounded(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
function linear(ctx, x1, y1, x2, y2, stops) {
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [position, color] of stops) grad.addColorStop(position, color);
  return grad;
}
function radial(ctx, x, y, inner, outer, a, b) {
  const grad = ctx.createRadialGradient(x, y, inner, x, y, outer);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  return grad;
}
async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  if (typeof img.decode === 'function') {
    await img.decode();
  } else {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  }
  return img;
}
function glowLine(ctx, callback, color = '#04dff5', blur = 18, width = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  callback();
  ctx.stroke();
  ctx.restore();
}
function hexagons(ctx) {
  ctx.save();
  ctx.globalAlpha = .28;
  ctx.strokeStyle = '#11aaf5';
  ctx.lineWidth = 2;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 7; col++) {
      const cx = 17 + col * 48 + (row % 2 ? 24 : 0);
      const cy = 14 + row * 43;
      const r = 27;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}
function cube(ctx, x, y, size, stroke = '#48eaff', width = 9) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 2;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, -s * .51);
  ctx.lineTo(s, s * .5);
  ctx.lineTo(0, s);
  ctx.lineTo(-s, s * .5);
  ctx.lineTo(-s, -s * .51);
  ctx.closePath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, s);
  ctx.moveTo(0, 0);
  ctx.lineTo(s, -s * .51);
  ctx.moveTo(0, 0);
  ctx.lineTo(-s, -s * .51);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s);
  ctx.stroke();
  ctx.restore();
}
function layers(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#93eaf4';
  ctx.lineWidth = 7;
  for (let level = 0; level < 3; level++) {
    const yy = level * 19;
    ctx.beginPath();
    ctx.moveTo(0, yy - 24);
    ctx.lineTo(33, yy - 11);
    ctx.lineTo(0, yy + 5);
    ctx.lineTo(-33, yy - 11);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
function priceTag(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#75e7fa';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  rounded(ctx, -46, -37, 92, 74, 11);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-27, -19, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawDetailsText(ctx, value, opts) {
  const { x, y, maxWidth, centerY = y, preferredSize = 48, minSize = 24,
    maxLines = 3, lineHeight = 1.16, align = 'left', color = '#f9fdff', weight = 750 } = opts;
  const title = String(value ?? '').trim().replace(/\s+/g, ' ') || 'Peça impressa em 3D';
  function wrap(size) {
    ctx.font = weight + ' ' + size + 'px system-ui, sans-serif';
    const result = [];
    let current = '';
    for (const token of title.split(' ')) {
      let word = token;
      // Evita cortar um nome grande sem espaços.
      while (ctx.measureText(word).width > maxWidth && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxWidth) cut--;
        if (current) { result.push(current); current = ''; }
        result.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = current ? current + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
      else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
    return result;
  }
  let size = preferredSize;
  let lines = wrap(size);
  while ((lines.length > maxLines || lines.length * size * lineHeight > 106) && size > minSize) {
    size -= 2;
    lines = wrap(size);
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = weight + ' ' + size + 'px system-ui, sans-serif';
  const height = size * lineHeight;
  const firstY = centerY - (lines.length - 1) * height / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, firstY + i * height, maxWidth);
  }
  ctx.restore();
}
function background(ctx) {
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, '#020d18'], [.6, '#001626'], [1, '#00111e']]);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = radial(ctx, 72, 240, 0, 470, 'rgba(0,145,214,.26)', 'rgba(0,40,65,0)');
  ctx.fillRect(0, 0, W, 600);
  hexagons(ctx);
  ctx.save();
  ctx.strokeStyle = '#fe9e19';
  ctx.lineWidth = 18;
  ctx.shadowColor = '#ed6b00';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(512, 210, 273, 140, -.2, .1, 5.65);
  ctx.stroke();
  ctx.restore();
  // Faixa luminosa atrás do título, como no modelo aprovado.
  glowLine(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-80, 458);
    ctx.bezierCurveTo(100, 335, 214, 344, 389, 376);
  }, '#13cdff', 19, 4);
  ctx.strokeStyle = '#005d96';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-90, 480);
  ctx.bezierCurveTo(105, 365, 240, 367, 405, 399);
  ctx.stroke();
}
async function drawPrinter(ctx) {
  try {
    const response = await fetch('./assets/printer-art.base64', { cache: 'force-cache' });
    if (!response.ok) throw new Error('arte indisponível');
    const encoded = (await response.text()).trim();
    const printer = await loadImage('data:image/webp;base64,' + encoded);
    const off = document.createElement('canvas');
    off.width = 392;
    off.height = 446;
    const p = off.getContext('2d');
    p.drawImage(printer, 0, 0, 392, 446);
    p.globalCompositeOperation = 'destination-in';
    p.fillStyle = linear(p, 0, 0, 180, 0, [
      [0, 'rgba(0,0,0,0)'], [.5, 'rgba(0,0,0,.7)'], [1, '#000']
    ]);
    p.fillRect(0, 0, 392, 446);
    p.fillStyle = linear(p, 0, 310, 0, 446, [
      [0, '#000'], [1, 'rgba(0,0,0,0)']
    ]);
    p.fillRect(0, 0, 392, 446);
    ctx.drawImage(off, 730, 0, 392, 446);
  } catch {
    // A ausência do detalhe decorativo nunca impede o envio do orçamento.
  }
}
async function drawBrand(ctx) {
  try {
    const logo = await loadImage('./logo.webp');
    // Fundo escuro do logo original integrado ao painel superior.
    ctx.save();
    ctx.shadowColor = '#00a9e9';
    ctx.shadowBlur = 6;
    ctx.drawImage(logo, 313, 22, 391, 391);
    ctx.restore();
  } catch {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5faff';
    ctx.font = 'bold 86px system-ui';
    ctx.fillText('JH3 DIMENSÕES', 526, 240);
  }
}
function drawHeader(ctx) {
  cube(ctx, 242, 525, 93, '#17ecff', 9);
  ctx.strokeStyle = '#36eaff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(327, 459);
  ctx.lineTo(327, 582);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 12;
  ctx.textAlign = 'left';
  ctx.font = '800 55px system-ui, sans-serif';
  ctx.fillStyle = '#f7fbff';
  ctx.fillText('ORÇAMENTO DE', 365, 509);
  ctx.fillStyle = linear(ctx, 0, 515, 0, 570, [[0, '#11eefa'], [1, '#00bddd']]);
  ctx.font = '900 66px system-ui, sans-serif';
  ctx.fillText('IMPRESSÃO 3D', 365, 576, 670);
  ctx.restore();
}
function drawCard(ctx, result) {
  const card = linear(ctx, 70, 635, 1000, 1260, [
    [0, '#001624'], [.5, '#011a2a'], [1, '#00101c']
  ]);
  ctx.save();
  ctx.shadowColor = '#00bde1';
  ctx.shadowBlur = 18;
  rounded(ctx, 49, 616, 1024, 647, 47);
  ctx.fillStyle = card;
  ctx.fill();
  ctx.strokeStyle = '#50e6ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Plaqueta de identificação, em cima dos dados reais do cliente.
  rounded(ctx, 340, 646, 432, 65, 21);
  ctx.fillStyle = linear(ctx, 350, 645, 750, 713, [
    [0, '#079cc1'], [.5, '#08769f'], [1, '#084875']
  ]);
  ctx.fill();
  ctx.strokeStyle = '#83eafa';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#f5ffff';
  ctx.font = 'bold 34px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PROJETO / PEÇA', 556, 690);

  cube(ctx, 204, 771, 77, '#f1fcff', 6);
  ctx.strokeStyle = '#66d2e8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(286, 733);
  ctx.lineTo(286, 811);
  ctx.stroke();

  // Nome: ajustado para evitar cortes e ficar legível mesmo em títulos longos.
  drawDetailsText(ctx, result.name, {
    x: 343, y: 774, centerY: 770, maxWidth: 661,
    preferredSize: 52, minSize: 24, maxLines: 3
  });
  ctx.strokeStyle = '#5289a4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(115, 841);
  ctx.lineTo(986, 841);
  ctx.stroke();

  layers(ctx, 208, 892);
  ctx.strokeStyle = '#55b6d6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(287, 863);
  ctx.lineTo(287, 937);
  ctx.stroke();
  const quantity = Number(result.quantity);
  const countLabel = quantity === 1 ? '1 peça' : quantity.toLocaleString('pt-BR') + ' peças';
  ctx.textAlign = 'left';
  ctx.font = '43px system-ui, sans-serif';
  ctx.fillStyle = '#f7fdff';
  ctx.fillText('Quantidade: ' + countLabel, 342, 918, 632);

  // Destaque do valor final: a única informação financeira enviada ao cliente.
  rounded(ctx, 97, 971, 910, 236, 34);
  ctx.fillStyle = linear(ctx, 100, 971, 100, 1207, [
    [0, '#086c96'], [.13, '#043955'], [.65, '#00243a'], [1, '#014a64']
  ]);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#16dffd';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#49dffd';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  priceTag(ctx, 205, 1090);
  ctx.beginPath();
  ctx.moveTo(298, 1008);
  ctx.lineTo(298, 1163);
  ctx.strokeStyle = '#36b2cf';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = 'bold 38px system-ui';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8feff';
  ctx.fillText('VALOR TOTAL', 347, 1045);
  const price = money.format(result.price);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = linear(ctx, 350, 1070, 350, 1168, [
    [0, '#28f1ff'], [1, '#00b7d9']
  ]);
  let fontSize = 102;
  while (fontSize > 38) {
    ctx.font = '900 ' + fontSize + 'px system-ui, sans-serif';
    if (ctx.measureText(price).width <= 629) break;
    fontSize -= 3;
  }
  ctx.fillText(price, 348, 1155, 630);
  ctx.restore();
}
function footerWave(ctx) {
  ctx.save();
  const light = linear(ctx, 0, 1280, W, 1410, [
    [0, '#005084'], [.25, '#00cfee'], [.65, '#005b9b'], [1, '#00c9e9']
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 1310);
  ctx.bezierCurveTo(230, 1265, 390, 1345, 630, 1347);
  ctx.bezierCurveTo(860, 1360, 1050, 1298, W, 1279);
  ctx.lineTo(W, 1383);
  ctx.bezierCurveTo(870, 1380, 610, 1393, 385, 1366);
  ctx.bezierCurveTo(155, 1338, 70, 1380, 0, 1394);
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();
  glowLine(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(0, 1310);
    ctx.bezierCurveTo(230, 1265, 390, 1345, 630, 1347);
    ctx.bezierCurveTo(860, 1360, 1050, 1298, W, 1279);
  }, '#09e2fc', 18, 4);
  ctx.restore();
}
export async function buildQuoteImage(result) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem do orçamento.');
  background(ctx);
  await drawPrinter(ctx);
  await drawBrand(ctx);
  drawHeader(ctx);
  drawCard(ctx, result);
  footerWave(ctx);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível salvar a imagem do orçamento.');
  return new File([blob], 'JH3-Dimensoes-Orcamento.png', { type: 'image/png' });
}
