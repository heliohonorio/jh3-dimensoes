import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });

  assert.equal(await page.locator('#quote-view').isVisible(), true, 'orçamento aparece no primeiro acesso');
  assert.equal(await page.locator('#first-setup').isVisible(), true, 'primeiro acesso avisa sobre custos');
  assert.equal(await page.locator('dialog').count(), 0, 'sem modais nem rolagem dentro de pop-up');
  await page.locator('#setup-now').click();
  assert.equal(await page.locator('#settings-view').isVisible(), true, 'custos abrem em tela normal');
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
  await page.locator('#piece').fill('Chaveiro JH3');
  await page.locator('#grams').fill('100');
  await page.locator('#quantity').fill('2');
  await page.locator('#hours').fill('2');
  await page.locator('#minutes').fill('0');
  await page.locator('#quote-form details').filter({ hasText: 'Adicionar embalagem' }).locator('summary').click();
  await page.locator('#extras').fill('250');
  assert.equal(await page.locator('#extras').inputValue(), 'R$ 2,50');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price1 = await page.locator('#total').textContent();
  assert.match(price1, /R\$/, 'mostra valor em reais');
  await page.waitForFunction(() => !document.querySelector('#share').disabled, { timeout: 10000 });
  assert.equal(await page.locator('#copy').isEnabled(), true, 'pode copiar orçamento');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'tela sem rolagem horizontal');
  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/mobile.png', fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#first-setup').isVisible(), false, 'custos permanecem salvos');
  assert.equal(await page.locator('#grams').inputValue(), '100', 'rascunho também fica salvo');
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
  await page.locator('label.profit-choice:has(input[value="150"])').click();
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  const price150 = parsePrice(await page.locator('#total').textContent());
  assert.ok(price150 > price100, '150% custa mais que 100%');
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
  assert.equal(await page.locator('input[name="markup"][value="custom"]').isChecked(), true,
    'opção de lucro é preservada no rascunho');
  assert.equal(await page.locator('#markup-custom').inputValue(), '2.500,50',
    'percentual de lucro salvo no aparelho');

  
  // Um link de página identifica o modelo, mas não inventa tempo ou peso.
  await page.locator('#project-import summary').click();
  await page.locator('#model-link').fill('https://makerworld.com/pt/models/123-suporte-para-celular');
  await page.locator('#identify').click();
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('não fornece peso'));
  assert.equal(await page.locator('#piece').inputValue(), 'Suporte para celular');
  assert.equal(await page.locator('#grams').inputValue(), '100');
  
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
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('preenchidos'));
  assert.equal(await page.locator('#grams').inputValue(), '22,75');
  assert.equal(await page.locator('#hours').inputValue(), '1');
  assert.equal(await page.locator('#minutes').inputValue(), '5');
  assert.equal(await page.locator('#quantity').inputValue(), '2', 'quantidade não é inventada');
  assert.match(await page.locator('#import-info').textContent(), /PLA/);
  assert.equal(await page.locator('#piece').inputValue(), 'Suporte A1');
  await page.locator('#quote-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.match(await page.locator('#total').textContent(), /R\$/);


  // Aceita G-code e rejeita um fatiamento para outra impressora.
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
  assert.equal(await page.locator('#grams').inputValue(), '30,25', 'não substitui valores com arquivo de outra máquina');

  await page.setViewportSize({ width: 320, height: 650 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'também cabe na tela pequena');
  await page.locator('#tab-settings').click();
  await page.locator('#rollGrams').focus();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'foco no campo não alarga a tela');
  await page.screenshot({ path: 'screenshots/mobile-pequeno.png', fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#tab-quote').click();
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
  assert.deepEqual(errors, [], 'sem erros de script no navegador');
  console.log('Navegação, custos, rascunho, cálculo, imagem, histórico e responsividade: OK.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
