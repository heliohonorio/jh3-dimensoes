import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { chromium } from 'playwright';

const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Cria um 3MF fatiado mínimo de teste, sem acessar serviços externos.
function zipOne(name, text, compressed = false) {
  const nameBytes = Buffer.from(name);
  const content = Buffer.from(text);
  const packed = compressed ? deflateRawSync(content) : content;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  if (compressed) local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  if (compressed) central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const localLength = local.length + nameBytes.length + packed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(localLength, 16);
  return Buffer.concat([local, nameBytes, packed, central, nameBytes, end]);
}
let browser;
try {
  await pause(1200);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Registra exatamente os textos desenhados na imagem PNG do orçamento.
  await page.addInitScript(() => {
    window.__quoteCanvasTexts = [];
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.__quoteCanvasTexts.push(String(text));
      return draw.call(this, text, ...args);
    };
    // Captura o compartilhamento sem abrir o diálogo do sistema operacional.
    Object.defineProperty(navigator, 'canShare', {
      configurable: true, value: () => true
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true, value: async data => { window.__sharedQuote = data; }
    });
  });
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });

  assert.equal(await page.locator('#home-view').isVisible(), true, 'abre só a tela inicial');
  assert.equal(await page.locator('#quote-view').isVisible(), false, 'campos ficam ocultos antes da escolha');
  assert.equal(await page.locator('#import-view').isVisible(), false, 'importação começa fechada');
  assert.equal(await page.locator('.home-tile').count(), 2, 'exatamente dois botões principais');
  assert.equal(await page.locator('#home-import').isVisible(), true);
  assert.equal(await page.locator('#home-new-quote').isVisible(), true);
  assert.equal(await page.locator('#tab-settings').isVisible(), true, 'engrenagem discreta acessível');
  const gear = await page.locator('#tab-settings').boundingBox();
  assert.ok(gear && gear.width <= 48 && gear.height <= 48, 'engrenagem pequena no cabeçalho');
  assert.equal(await page.locator('#tab-settings').getAttribute('aria-label'),
    'Configurar meus custos');
  await page.locator('#home-import').click();
  assert.equal(await page.locator('#import-view').isVisible(), true, 'Importar abre caminho próprio');
  assert.equal(await page.locator('#quote-view').isVisible(), false, 'sem campos do orçamento na importação');
  const importSummary = page.locator('#project-import > summary');
  assert.equal(await importSummary.evaluate(node => getComputedStyle(node).backgroundColor),
    'rgb(60, 198, 135)', 'importação aberta permanece verde');
  assert.ok(await importSummary.evaluate(node => node.getBoundingClientRect().height >= 70),
    'área de importação grande');
  assert.equal(await page.locator('#project-import').getAttribute('open'), '',
    'importação já abre sem exigir segundo toque');
  await importSummary.click();
  assert.equal(await page.locator('#project-import').getAttribute('open'), null);
  await importSummary.click();
  assert.equal(await page.locator('#project-import').getAttribute('open'), '');
  assert.equal(await page.locator('#import-continue').isVisible(), false,
    'não é possível continuar antes de ler um projeto');
  await page.locator('#import-back').click();
  assert.equal(await page.locator('#home-view').isVisible(), true);
  await page.locator('#home-new-quote').click();
  assert.equal(await page.locator('#quote-view').isVisible(), true, 'Novo orçamento abre campos');
  assert.equal(await page.locator('#import-view').isVisible(), false, 'Novo orçamento NÃO mostra importação');
  assert.equal(await page.locator('#project-import').isVisible(), false);
  assert.equal(await page.locator('#quote-form .stage-card').count(), 3,
    'formulário contém apenas dados, outros gastos e lucro');
  assert.equal(await page.locator('#step-details').textContent(), 'Dados da peça');
  assert.equal(await page.locator('#step-profit').textContent(), 'Escolha seu lucro');
  assert.equal(await page.locator('#first-setup').isVisible(), true,
    'primeiro orçamento avisa sobre custos');
  assert.equal(await page.locator('#clear').isVisible(), true);
  assert.equal(await page.locator('#hours').inputValue(), '');
  assert.equal(await page.locator('#minutes').inputValue(), '');
  assert.equal(await page.locator('#grams').inputValue(), '');

  // Reproduz o defeito observado no PWA: antes, a engrenagem desaparecia ao rolar.
  await page.evaluate(() => window.scrollTo(0, 850));
  await page.waitForTimeout(160);
  const headerAtScroll = await page.locator('.top').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      offset: parseFloat(getComputedStyle(node).top) || 0,
      bottom: rect.bottom,
      height: rect.height
    };
  });
  assert.ok(Math.abs(headerAtScroll.top - headerAtScroll.offset) <= 2,
    'o cabeçalho permanece fixo abaixo da área segura do iPhone');
  const gearAtScroll = await page.locator('#tab-settings').boundingBox();
  assert.ok(gearAtScroll && gearAtScroll.y >= 0 &&
    gearAtScroll.y + gearAtScroll.height < 844,
    'engrenagem permanece dentro da tela depois de rolar');
  await page.locator('#tab-settings').click();
  assert.equal(await page.locator('#settings-view').isVisible(), true,
    'a engrenagem pode ser usada mesmo depois da rolagem');
  await page.locator('#tab-settings').click();
  assert.equal(await page.locator('#quote-view').isVisible(), true,
    'a engrenagem permite retornar ao orçamento');

  assert.equal(await page.locator('dialog').count(), 0, 'sem modais nem rolagem dentro de pop-up');
  await page.locator('#setup-now').click();
  assert.equal(await page.locator('#settings-view').isVisible(), true, 'custos abrem em tela normal');
  assert.equal(await page.locator('#settings-form .stage-card').count(), 4,
    'custos divididos em quatro áreas claras');
  assert.equal(await page.locator('#cost-filament').textContent(), 'Seu filamento');
  assert.equal(await page.locator('#cost-energy').textContent(), 'Conta de luz');
  assert.equal(await page.locator('#quote-view').isVisible(), false);
  assert.equal(await page.locator('#tariff').inputValue(), 'R$ 0,96');
  assert.equal(await page.locator('#watts').inputValue(), '84');
  // Simula a digitação normal no teclado do celular.
  await page.locator('#rollPrice').fill('');
  await page.locator('#rollPrice').pressSequentially('1234');
  assert.equal(await page.locator('#rollPrice').inputValue(), 'R$ 12,34');
  await page.locator('#rollPrice').press('Backspace');
  assert.equal(await page.locator('#rollPrice').inputValue(), 'R$ 1,23');
  await page.locator('#rollPrice').fill('10000');
  assert.equal(await page.locator('#rollPrice').inputValue(), 'R$ 100,00');
  await page.locator('#rollGrams').fill('1000');
  await page.locator('#tariff').fill('096');
  await page.locator('#watts').fill('84');
  await page.locator('#wear').fill('150');
  await page.locator('#settings-form button[type="submit"]').click();

  assert.equal(await page.locator('#quote-view').isVisible(), true, 'salvar custos retorna ao orçamento');
  assert.equal(await page.locator('#first-setup').isVisible(), false);
  await page.locator('#tab-settings').click();
  assert.equal(await page.locator('#settings-view').isVisible(), true,
    'custos continuam disponíveis após primeiro uso');
  await page.locator('#tab-settings').click();
  assert.equal(await page.locator('#quote-view').isVisible(), true,
    'engrenagem também retorna ao orçamento');

  await page.locator('#hours').pressSequentially('2');
  assert.equal(await page.locator('#hours').inputValue(), '2',
    'digitar 2 nas horas não forma 02');
  await page.locator('#minutes').pressSequentially('35');
  assert.equal(await page.locator('#minutes').inputValue(), '35',
    'digitar 35 nos minutos não mantém zeros anteriores');
  await page.locator('#minutes').fill('');
  await page.locator('#piece').fill('Chaveiro JH3');
  await page.locator('#grams').fill('100');
  await page.locator('#quantity').fill('2');
  await page.locator('#hours').fill('2');
  await page.locator('#minutes').fill('');
  await page.locator('#quote-form details').filter({ hasText: 'Adicionar embalagem' }).locator('summary').click();
  await page.locator('#extras').fill('250');
  assert.equal(await page.locator('#extras').inputValue(), 'R$ 2,50');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price1 = await page.locator('#total').textContent();
  assert.match(price1, /R\$/, 'mostra valor em reais');
  await page.waitForFunction(() => !document.querySelector('#share').disabled, { timeout: 10000 });
  assert.equal(await page.evaluate(() => window.__quoteCanvasTexts.includes('Chaveiro JH3')), true,
    'o nome escolhido precisa aparecer na imagem de orçamento');
  assert.equal(await page.locator('#copy').isEnabled(), true, 'pode copiar orçamento');
  assert.equal(await page.evaluate(() => fetch('./assets/printer-art.base64').then(r => r.ok)),
    true, 'a imagem da impressora usada no modelo aprovado está publicada');
  await page.locator('#share').click();
  const shareData = await page.evaluate(async () => {
    const quote = window.__sharedQuote;
    if (!quote) return null;
    const file = quote.files?.[0];
    const bitmap = file ? await createImageBitmap(file) : null;
    return {
      text: quote.text,
      fileName: file?.name,
      mime: file?.type,
      width: bitmap?.width,
      height: bitmap?.height,
      bytes: file?.size
    };
  });
  assert.ok(shareData, 'botão compartilha a imagem com o texto');
  assert.equal(shareData.text,
    'JH3 DIMENSÕES\nSegue orçamento do seu Projeto 3D.',
    'mensagem contém só o nome da empresa e a saudação aprovada');
  assert.equal(shareData.mime, 'image/png', 'orçamento é uma imagem');
  assert.equal(shareData.width, 1122);
  assert.equal(shareData.height, 1402);
  assert.ok(shareData.bytes > 25000, 'a arte oficial foi gerada com conteúdo visual');
  assert.doesNotMatch(shareData.text, /Quantidade|R\$|Lucro|Filamento|Chaveiro/,
    'nenhuma quantidade ou preço deve aparecer na mensagem enviada');
  // Salva uma imagem real do orçamento gerada pelo navegador para inspeção visual.
  const png64 = await page.evaluate(async () => {
    const file = window.__sharedQuote.files[0];
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return dataUrl.split(',')[1];
  });
  await mkdir('screenshots', { recursive: true });
  await writeFile('screenshots/orcamento-oficial.png', Buffer.from(png64, 'base64'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'tela sem rolagem horizontal');
  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/mobile.png', fullPage: true });

  // Um preenchimento antigo não deve reaparecer ao abrir a calculadora.
  await page.evaluate(() => localStorage.setItem('jh3-draft-v2',
    JSON.stringify({ piece: 'Orçamento antigo', grams: '999', hours: '0', minutes: '0' })));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#home-view').isVisible(), true,
    'ao recarregar volta à tela com duas opções');
  await page.locator('#home-new-quote').click();
  assert.equal(await page.locator('#first-setup').isVisible(), false, 'custos permanecem salvos');
  assert.equal(await page.locator('#piece').inputValue(), '', 'não recupera nome do orçamento antigo');
  assert.equal(await page.locator('#grams').inputValue(), '', 'não recupera gramas do orçamento antigo');
  assert.equal(await page.locator('#hours').inputValue(), '', 'horas vazias após recarregar');
  assert.equal(await page.locator('#minutes').inputValue(), '', 'minutos vazios após recarregar');
  assert.equal(await page.evaluate(() => localStorage.getItem('jh3-draft-v2')), null,
    'rascunho anterior foi descartado sem apagar custos ou histórico');
  assert.equal(await page.locator('#history-section').isVisible(), true, 'histórico disponível');
  await page.locator('#history-list button').first().click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.equal(await page.locator('#piece').inputValue(), 'Chaveiro JH3');
  assert.equal(await page.locator('#extras').inputValue(), 'R$ 2,50');

  await page.locator('#tab-settings').click();
  assert.equal(await page.locator('#settings-view').isVisible(), true);
  await page.locator('#tariff').fill('200');
  assert.equal(await page.locator('#tariff').inputValue(), 'R$ 2,00');
  await page.locator('#settings-form button[type=submit]').click();
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price2 = await page.locator('#total').textContent();
  const parsePrice = text => Number(text.replace(/[^0-9,]/g, '').replace(',', '.'));
  assert.ok(parsePrice(price2) > parsePrice(price1), 'mudança da energia altera o preço');

  
  // Uma única opção selecionada e 100/150% tratados como acréscimo sobre custo.
  await page.locator('label.profit-choice:has(input[value="100"])').click();
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price100 = parsePrice(await page.locator('#total').textContent());
  const cost100 = await page.locator('#cost-label').textContent();
  await page.locator('label.profit-choice:has(input[value="150"])').click();
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price150 = parsePrice(await page.locator('#total').textContent());
  const cost150 = await page.locator('#cost-label').textContent();
  assert.ok(price150 > price100, '150% custa mais que 100%');
  assert.equal(cost150, cost100, 'o custo real não muda com a porcentagem de lucro');
  assert.match(await page.locator('#units').textContent(), /por peça/, 'preço unitário descrito como preço de venda');
  assert.match(await page.locator('.sum-note').textContent(), /custo da impressão não muda/,
    'explicação sobre custo fixo e lucro visível');
  assert.equal(await page.locator('#cost-per-piece').isVisible(), true,
    'custo individual fica separado');
  assert.equal(await page.locator('#profit-per-piece').isVisible(), true,
    'lucro individual fica separado');
  assert.equal(await page.locator('#sum-quantity').textContent(), 'Soma para as 2 peças');
  const sumCents = text => Math.round(parsePrice(text) * 100);
  const totalShown = sumCents(await page.locator('#total').textContent());
  const costShown = sumCents(await page.locator('#cost-label').textContent());
  const profitShown = sumCents(await page.locator('#profit-label').textContent());
  const feeShown = await page.locator('#fees-line').isVisible()
    ? sumCents(await page.locator('#fees-label').textContent()) : 0;
  assert.equal(costShown + profitShown + feeShown, totalShown,
    'custo + lucro + taxas é exatamente o total mostrado');
  await page.locator('label.profit-choice:has(input[value="custom"])').click();
  assert.equal(await page.locator('#custom-markup').isVisible(), true);
  await page.locator('#markup-custom').fill('85');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.equal(await page.locator('input[name=markup]:checked').inputValue(), 'custom');
  const smallCustom = parsePrice(await page.locator('#total').textContent());
  assert.equal(await page.locator('#markup-custom').getAttribute('max'), null,
    'sem limite fixo no campo personalizado');
  await page.locator('#markup-custom').fill('1.000');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price1000 = parsePrice(await page.locator('#total').textContent());
  assert.ok(price1000 > smallCustom, '1.000% aumenta o valor de venda');
  await page.locator('#markup-custom').fill('2.500,50');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price2500 = parsePrice(await page.locator('#total').textContent());
  assert.ok(price2500 > price1000, '2.500,50% também é aceito');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#home-view').isVisible(), true);
  await page.locator('#home-new-quote').click();
  assert.equal(await page.locator('input[name="markup"][value="50"]').isChecked(), true,
    'cada abertura começa com a opção padrão de lucro');
  assert.equal(await page.locator('#markup-custom').inputValue(), '',
    'percentual personalizado anterior não reaparece');
  assert.equal(await page.locator('#grams').inputValue(), '',
    'o orçamento anterior não reaparece');
  assert.equal(await page.locator('#hours').inputValue(), '',
    'horas continuam vazias após reabrir');
  await page.locator('#grams').fill('100');
  await page.locator('#hours').fill('2');
  await page.locator('#quantity').fill('2');

  // Nome grande também precisa ser integralmente desenhado, sem cortes.
  const longTitle = 'Organizador de Mesa Modular com Suporte para Celular e Porta Canetas Personalizado';
  await page.locator('#piece').fill(longTitle);
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  await page.waitForFunction(() => !document.querySelector('#share').disabled, { timeout: 10000 });
  const drawnTitle = await page.evaluate(() => {
    const text = window.__quoteCanvasTexts;
    const label = text.lastIndexOf('PROJETO / PEÇA');
    const quantity = text.findIndex((x, i) => i > label && x.startsWith('Quantidade:'));
    return text.slice(label + 1, quantity).join(' ');
  });
  assert.equal(drawnTitle, longTitle,
    'todas as palavras do nome longo aparecem na imagem compartilhada');

  // Fluxo de importação: link de página só identifica o nome, sem inventar peso.
  await page.locator('#back-home').click();
  assert.equal(await page.locator('#home-view').isVisible(), true);
  await page.locator('#home-import').click();
  assert.equal(await page.locator('#project-import').getAttribute('open'), '');
  await page.locator('#model-link').fill('https://makerworld.com/pt/models/123-suporte-para-celular');
  await page.locator('#identify').click();
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('não fornece peso'));
  assert.equal(await page.locator('#piece').inputValue(), 'Suporte para celular');
  assert.equal(await page.locator('#grams').inputValue(), '');
  assert.equal(await page.locator('#hours').inputValue(), '');
  assert.equal(await page.locator('#import-continue').isVisible(), true,
    'link reconhecido pode continuar para preenchimento manual');
  await page.locator('#import-continue').click();
  assert.equal(await page.locator('#quote-view').isVisible(), true);
  assert.equal(await page.locator('#import-view').isVisible(), false,
    'a importação NÃO aparece entre as etapas do orçamento');
  assert.match(await page.locator('#imported-note').textContent(), /peso e o tempo/);
  await page.locator('#grams').fill('10');
  await page.locator('#hours').fill('1');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);

  // Projeto fatiado: gramas e tempo são preenchidos e revisados no orçamento.
  await page.locator('#back-home').click();
  await page.locator('#home-import').click();
  assert.equal(await page.locator('#model-link').inputValue(), '', 'novo caminho começa limpo');
  const sliceInfo = [
    '<config><plate>',
    '<metadata key="index" value="1"/>',
    '<metadata key="prediction" value="3900"/>',
    '<metadata key="weight" value="22.75"/>',
    '<metadata key="printer_model_id" value="Bambu Lab A1 mini"/>',
    '<filament id="1" type="PLA" used_g="22.75"/>',
    '</plate></config>'
  ].join('');
  await page.locator('#project-file').setInputFiles({
    name: 'Suporte_A1.gcode.3mf',
    mimeType: 'application/octet-stream',
    buffer: zipOne('Metadata/slice_info.config', sliceInfo, true)
  });
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('fatiamento carregados'));
  assert.equal(await page.locator('#grams').inputValue(), '22,75');
  assert.equal(await page.locator('#hours').inputValue(), '1');
  assert.equal(await page.locator('#minutes').inputValue(), '5');
  assert.equal(await page.locator('#quantity').inputValue(), '1',
    'o importador não altera a quantidade sem certeza');
  assert.match(await page.locator('#import-info').textContent(), /PLA/);
  assert.equal(await page.locator('#piece').inputValue(), 'Suporte A1');
  assert.equal(await page.locator('#import-continue').isVisible(), true);
  await page.locator('#import-continue').click();
  assert.equal(await page.locator('#quote-view').isVisible(), true);
  assert.equal(await page.locator('#import-view').isVisible(), false);
  assert.match(await page.locator('#imported-note').textContent(), /Projeto importado/);
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.match(await page.locator('#total').textContent(), /R\$/);

  // Botão de novo orçamento no resultado limpa a peça, sem apagar custos/histórico.
  assert.equal(await page.locator('#new-quote-result').isVisible(), true);
  await page.locator('#new-quote-result').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('#piece').inputValue(), '');
  assert.equal(await page.locator('#grams').inputValue(), '');
  assert.equal(await page.locator('#hours').inputValue(), '');
  assert.equal(await page.locator('#minutes').inputValue(), '');
  assert.equal(await page.locator('#quantity').inputValue(), '1');
  assert.equal(await page.locator('#model-link').inputValue(), '');
  assert.equal(await page.locator('#project-file').inputValue(), '');
  assert.equal(await page.locator('#imported-note').isVisible(), false);
  assert.equal(await page.locator('#import-view').isVisible(), false);
  assert.equal(await page.locator('#history-section').isVisible(), true);
  assert.equal(await page.locator('input[name="markup"][value="50"]').isChecked(), true);
  assert.match(await page.locator('#new-quote-status').textContent(), /Pronto!/);
  await page.locator('#grams').fill('10');
  assert.equal(await page.locator('#new-quote-status').textContent(), '');
  await page.locator('#minutes').pressSequentially('35');
  assert.equal(await page.locator('#minutes').inputValue(), '35');
  assert.equal(await page.locator('#hours').inputValue(), '');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.match(await page.locator('#total').textContent(), /R\$/,
    'tempo só de minutos funciona');
  await page.locator('#clear').click();
  assert.equal(await page.locator('#minutes').inputValue(), '');
  assert.equal(await page.locator('#result').isVisible(), false);

  // G-code e proteção contra arquivo destinado a outra máquina.
  await page.locator('#back-home').click();
  await page.locator('#home-import').click();
  const gcode = [
    '; model printing time: 20m; total estimated time: 2h 10m 5s',
    '; total filament weight [g] : 30.25',
    '; printer_model = Bambu Lab A1 mini'
  ].join('\n');
  await page.locator('#project-file').setInputFiles({
    name: 'Caixa_A1.gcode',
    mimeType: 'text/plain',
    buffer: Buffer.from(gcode)
  });
  await page.waitForFunction(() => document.querySelector('#import-info').textContent.includes('G-code fatiado'));
  assert.equal(await page.locator('#grams').inputValue(), '30,25');
  assert.equal(await page.locator('#hours').inputValue(), '2');
  assert.equal(await page.locator('#minutes').inputValue(), '11');
  const otherPrinter = sliceInfo.replace('Bambu Lab A1 mini', 'Bambu Lab P1S');
  await page.locator('#project-file').setInputFiles({
    name: 'Perfil_P1S.gcode.3mf',
    mimeType: 'application/octet-stream',
    buffer: zipOne('Metadata/slice_info.config', otherPrinter, true)
  });
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('não para a A1 Mini'));
  assert.equal(await page.locator('#import-continue').isVisible(), false,
    'não permite continuar com perfil de impressora incompatível');
  assert.equal(await page.locator('#grams').inputValue(), '30,25',
    'uma importação inválida não muda os dados anteriores');
  await page.locator('#import-back').click();
  await page.locator('#home-new-quote').click();
  assert.equal(await page.locator('#grams').inputValue(), '',
    'novo orçamento manual independe do caminho de importação');

  await page.setViewportSize({ width: 320, height: 650 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'também cabe na tela pequena');
  await page.locator('#tab-settings').click();
  await page.locator('#rollGrams').focus();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'foco no campo não alarga a tela');
  await page.screenshot({ path: 'screenshots/mobile-pequeno.png', fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#back-quote').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'cabe também na versão computador');
  await page.screenshot({ path: 'screenshots/computador.png', fullPage: true });
  // Aparelhos que já tinham custos salvos recebem SOMENTE a atualização da energia.
  const oldPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await oldPage.addInitScript(() => {
    localStorage.setItem('jh3-preferences-v2', JSON.stringify({
      rollPrice: 135, rollGrams: 750, tariff: 1.75, watts: 180,
      wear: 3.5, margin: 25, waste: 5, failure: 5, fee: 0, laborHourly: 0, minPrice: 0
    }));
  });
  await oldPage.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await oldPage.locator('#tab-settings').click();
  assert.equal(await oldPage.locator('#tariff').inputValue(), 'R$ 0,96', 'tarifa antiga atualizada');
  assert.equal(await oldPage.locator('#watts').inputValue(), '84', 'potência antiga atualizada');
  assert.equal(await oldPage.locator('#rollPrice').inputValue(), 'R$ 135,00', 'custo do rolo preservado');
  assert.equal(await oldPage.locator('#wear').inputValue(), 'R$ 3,50', 'desgaste preservado');
  assert.equal(await oldPage.locator('input[name="markup"][value="50"]').isChecked(), true, 'lucro inicial definido no orçamento');
  await oldPage.close();

  // Ajuste opcional do valor final por toque prolongado, inclusive abaixo do custo.
  const pricingPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const pricingErrors = [];
  pricingPage.on('pageerror', error => pricingErrors.push(error.message));
  await pricingPage.addInitScript(() => {
    localStorage.setItem('jh3-energy-reference-oct-2026-v1', 'true');
    localStorage.setItem('jh3-preferences-v2', JSON.stringify({
      rollPrice: 1000, rollGrams: 1000, tariff: 0, watts: 0, wear: 0,
      waste: 0, failure: 0, margin: 30, fee: 0, laborHourly: 0, minPrice: 0
    }));
    window.__pricingCanvasTexts = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (txt, ...args) {
      window.__pricingCanvasTexts.push(String(txt));
      return original.call(this, txt, ...args);
    };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async data => { window.__pricingShared = data; }
    });
  });
  await pricingPage.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await pricingPage.locator('#home-new-quote').click();
  await pricingPage.locator('#piece').fill('Projeto com preço livre');
  await pricingPage.locator('#grams').fill('27,28');
  await pricingPage.locator('#quantity').fill('3');
  await pricingPage.locator('#hours').fill('1');
  await pricingPage.locator('#quote-form button[type=submit]').click();
  await pricingPage.waitForFunction(() => !document.querySelector('#share').disabled);
  assert.equal((await pricingPage.locator('#total').textContent()).replace(/\s/g, ' '), 'R$ 40,92');
  const originalCost = await pricingPage.locator('#cost-label').textContent();
  assert.equal(originalCost.replace(/\s/g, ' '), 'R$ 27,27');

  // Toque curto não abre o campo; segurar por cerca de 0,6 segundo abre.
  await pricingPage.locator('#total-edit-trigger').click();
  assert.equal(await pricingPage.locator('#price-edit-form').isVisible(), false,
    'um toque rápido não edita o orçamento sem querer');
  await pricingPage.locator('#total-edit-trigger').scrollIntoViewIfNeeded();
  const priceRect = await pricingPage.locator('#total-edit-trigger').boundingBox();
  await pricingPage.mouse.move(priceRect.x + 40, priceRect.y + priceRect.height / 2);
  await pricingPage.mouse.down();
  await pricingPage.waitForTimeout(650);
  await pricingPage.mouse.up();
  assert.equal(await pricingPage.locator('#price-edit-form').isVisible(), true,
    'pressionar e segurar o valor abre a edição');
  assert.equal(await pricingPage.locator('#price-override').inputValue(), '',
    'campo começa vazio para substituir o valor sem apagar dígitos');
  await pricingPage.locator('#price-override').pressSequentially('4300');
  assert.equal((await pricingPage.locator('#price-override').inputValue()).replace(/\s/g, ' '),
    'R$ 43,00', 'máscara monetária funciona enquanto digita');
  await pricingPage.locator('#price-edit-form button[type=submit]').click();
  assert.equal((await pricingPage.locator('#total').textContent()).replace(/\s/g, ' '),
    'R$ 43,00', 'preço de venda foi ajustado');
  assert.equal(await pricingPage.locator('#cost-label').textContent(), originalCost,
    'o custo da impressão não é alterado');
  assert.equal((await pricingPage.locator('#profit-label').textContent()).replace(/\s/g, ' '),
    'R$ 15,73', 'o lucro é recalculado pelo valor novo');
  assert.equal(await pricingPage.locator('#price-edited-status').isVisible(), true);
  assert.equal(await pricingPage.locator('#share').isEnabled(), false,
    'imagem anterior não pode ser compartilhada durante atualização');
  await pricingPage.waitForFunction(() => !document.querySelector('#share').disabled);
  assert.ok(await pricingPage.evaluate(() =>
    window.__pricingCanvasTexts.some(value => value.replace(/\s/g, ' ').includes('R$ 43,00'))),
    'o PNG da JH3 traz o novo preço');
  await pricingPage.locator('#share').click();
  const shared = await pricingPage.evaluate(async () => ({
    text: window.__pricingShared?.text,
    image: window.__pricingShared?.files?.[0]?.name
  }));
  assert.equal(shared.text, 'JH3 DIMENSÕES\nSegue orçamento do seu Projeto 3D.');
  assert.ok(shared.image?.endsWith('.png'), 'nova imagem é enviada sem números na mensagem');

  // Alterar para baixo também deve ser permitido e persistir no histórico.
  await pricingPage.locator('#price-edit-open').click();
  await pricingPage.locator('#price-override').fill('4200');
  await pricingPage.locator('#price-edit-form button[type=submit]').click();
  assert.equal((await pricingPage.locator('#total').textContent()).replace(/\s/g, ' '), 'R$ 42,00');
  assert.equal((await pricingPage.locator('#profit-label').textContent()).replace(/\s/g, ' '), 'R$ 14,73');
  await pricingPage.locator('#price-edit-open').click();
  await pricingPage.locator('#price-override').fill('2000');
  await pricingPage.locator('#price-edit-form button[type=submit]').click();
  assert.equal((await pricingPage.locator('#total').textContent()).replace(/\s/g, ' '), 'R$ 20,00');
  assert.equal(await pricingPage.locator('#profit-total-title').textContent(), 'Prejuízo');
  assert.equal((await pricingPage.locator('#profit-label').textContent()).replace(/\s/g, ' '), 'R$ 7,27');
  assert.equal(await pricingPage.locator('#cost-label').textContent(), originalCost);
  const savedPrice = await pricingPage.evaluate(() =>
    JSON.parse(localStorage.getItem('jh3-history-v1'))[0].manualPrice);
  assert.equal(savedPrice, 20, 'valor alterado fica salvo no histórico');
  await pricingPage.locator('#new-quote-result').click();
  await pricingPage.locator('#history-list button').first().click();
  assert.equal((await pricingPage.locator('#total').textContent()).replace(/\s/g, ' '),
    'R$ 20,00', 'recuperar orçamento mantém preço ajustado');
  assert.deepEqual(pricingErrors, [], 'sem erros ao ajustar o preço no navegador');
  await pricingPage.close();

  assert.deepEqual(errors, [], 'sem erros de script no navegador');
  console.log('Navegação, custos, rascunho, cálculo, imagem, histórico e responsividade: OK.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
