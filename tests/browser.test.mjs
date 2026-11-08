import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  await page.locator('#margin').fill('30');
  await page.locator('#settings-form button[type="submit"]').click();

  assert.equal(await page.locator('#quote-view').isVisible(), true, 'salvar custos retorna ao orçamento');
  assert.equal(await page.locator('#first-setup').isVisible(), false);
  await page.locator('#piece').fill('Chaveiro JH3');
  await page.locator('#grams').fill('100');
  await page.locator('#quantity').fill('2');
  await page.locator('#hours').fill('2');
  await page.locator('#minutes').fill('0');
  await page.locator('#quote-form details').first().locator('summary').click();
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
  assert.equal(await oldPage.locator('#margin').inputValue(), '25', 'margem preservada');
  await oldPage.close();
  assert.deepEqual(errors, [], 'sem erros de script no navegador');
  console.log('Navegação, custos, rascunho, cálculo, imagem, histórico e responsividade: OK.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
