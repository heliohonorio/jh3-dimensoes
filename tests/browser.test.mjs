import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {
  stdio: 'ignore'
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
try {
  await wait(1200);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.locator('#preferences').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Salvar meus custos' }).click();
  assert.equal(await page.locator('#preferences').isVisible(), false, 'a janela fecha após salvar');
  await page.locator('#piece').fill('Chaveiro JH3');
  await page.locator('#grams').fill('100');
  await page.locator('#quantity').fill('2');
  await page.locator('#hours').fill('2');
  await page.locator('#minutes').fill('0');
  await page.locator('.calculate-btn').click();
  await page.waitForFunction(() => document.querySelector('#total').textContent.includes('R$'));
  const value1 = await page.locator('#total').textContent();
  assert.match(value1, /R\$/);
  assert.equal(await page.locator('#summary-extra').isVisible(), true);
  await page.locator('#share').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#share').disabled);
  assert.equal(await page.locator('#copy').isEnabled(), true);
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(noOverflow, 'não existe rolagem horizontal no celular');
  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/mobile.png', fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#preferences').isVisible(), false, 'custos persistem após recarregar');
  assert.equal(await page.locator('#history-section').isVisible(), true, 'histórico salvo aparece');
  await page.locator('#history-list button').first().click();
  await page.waitForFunction(() => document.querySelector('#total').textContent.includes('R$'));
  assert.equal((await page.locator('#piece').inputValue()), 'Chaveiro JH3');

  await page.locator('#settings').click();
  await page.locator('#tariff').fill('2');
  await page.locator('#preferences-form button[type=submit]').click();
  await page.locator('.calculate-btn').click();
  await page.waitForFunction(() => document.querySelector('#total').textContent.includes('R$'));
  const value2 = await page.locator('#total').textContent();
  const brl = s => Number(s.replace(/[^0-9,]/g, '').replace(',', '.'));
  assert.ok(brl(value2) > brl(value1), 'mudança da luz afeta o orçamento');

  await page.setViewportSize({ width: 1280, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'não existe rolagem horizontal no computador');
  await page.screenshot({ path: 'screenshots/computador.png', fullPage: true });
  assert.deepEqual(errors, [], 'sem erros de JavaScript no navegador');
  console.log('Teste de navegador aprovado: primeiro acesso, cálculo, imagem, histórico, custos e telas móvel/computador.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
