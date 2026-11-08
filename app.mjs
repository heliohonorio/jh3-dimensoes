import { calculate, decimal, makerWorldModel } from './calc.mjs';

const byId = id => document.getElementById(id);
const preferenceKeys = ['rollPrice', 'rollGrams', 'tariff', 'watts', 'wear', 'margin'];
const storageKey = 'jh3-preferences-v1';
const settingsDialog = byId('preferences');
const quoteForm = byId('quote');
const preferencesForm = byId('preferences-form');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const image = new Image();
image.src = './logo.webp';
let settings;
let current;
let preparedImage;
let revision = 0;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && preferenceKeys.every(key => Number.isFinite(saved[key]))) settings = saved;
} catch {}

function openSettings() {
  for (const key of preferenceKeys) byId(key).value = settings?.[key] ?? (key === 'rollGrams' ? 1000 : '');
  byId('settings-error').textContent = '';
  settingsDialog.showModal();
}

function invalidate(message = 'O preço aparece aqui depois do cálculo.') {
  revision++;
  current = undefined;
  preparedImage = undefined;
  byId('total').value = '—';
  byId('units').textContent = message;
  byId('breakdown').hidden = true;
  byId('share').disabled = true;
  byId('download').disabled = true;
  byId('share-status').textContent = '';
  byId('quote-error').textContent = '';
}

byId('settings').addEventListener('click', openSettings);
byId('close-settings').addEventListener('click', () => settingsDialog.close());
preferencesForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(preferenceKeys.map(key => [key, decimal(byId(key).value)]));
  try {
    calculate(values, { grams: 1, quantity: 1, hours: 1, minutes: 0, extras: 0 });
  } catch {
    byId('settings-error').textContent = 'Use números válidos, peso do rolo maior que zero e margem entre 0% e menos de 100%.';
    return;
  }
  settings = values;
  invalidate('Configurações atualizadas. Calcule o orçamento para ver o preço.');
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    byId('units').textContent = 'O navegador bloqueou o salvamento. As configurações valem até fechar a página.';
  }
  settingsDialog.close();
});

byId('model-link').addEventListener('input', () => {
  byId('model-status').textContent = '';
  byId('model-page').hidden = true;
});
byId('identify').addEventListener('click', () => {
  try {
    const model = makerWorldModel(byId('model-link').value);
    byId('piece').value = model.title.slice(0, 90);
    byId('model-page').href = model.url;
    byId('model-page').hidden = false;
    byId('model-status').textContent = 'Nome identificado pelo link. Abra o perfil da A1 Mini no Bambu Studio e informe abaixo o peso e o tempo.';
    invalidate();
  } catch {
    byId('model-page').hidden = true;
    byId('model-status').textContent = 'Cole o endereço completo da página do modelo no MakerWorld.';
  }
});

quoteForm.addEventListener('input', event => {
  if (event.target.id !== 'model-link') invalidate();
});
quoteForm.addEventListener('submit', async event => {
  event.preventDefault();
  invalidate();
  if (!settings) {
    openSettings();
    return;
  }
  const job = Object.fromEntries(['grams', 'quantity', 'hours', 'minutes', 'extras'].map(key => [
    key, decimal(byId(key).value || (key === 'extras' ? '0' : ''))
  ]));
  try {
    current = { ...calculate(settings, job), quantity: job.quantity, name: byId('piece').value.trim() || 'Peça impressa em 3D' };
  } catch (error) {
    byId('quote-error').textContent = error.message;
    return;
  }
  const quote = current;
  byId('total').value = money.format(quote.price);
  byId('units').textContent = quote.quantity + (quote.quantity === 1 ? ' peça' : ' peças · aprox. ' + money.format(quote.unit) + ' cada');
  const costs = byId('costs');
  costs.replaceChildren();
  for (const [key, label] of Object.entries({filament: 'Filamento', energy: 'Energia', machine: 'Desgaste', extras: 'Extras', cost: 'Custo total', profit: 'Lucro estimado'})) {
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = label;
    value.textContent = money.format(quote[key]);
    costs.append(term, value);
  }
  byId('breakdown').hidden = false;
  byId('result-heading').focus();
  const version = revision;
  try {
    const file = await makeQuoteImage(quote);
    if (version !== revision) return;
    preparedImage = file;
    byId('share').disabled = false;
    byId('download').disabled = false;
  } catch {
    if (version === revision) byId('share-status').textContent = 'Não foi possível gerar a imagem. Tente calcular novamente.';
  }
});

async function makeQuoteImage(quote) {
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 1060;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a1324';
  ctx.fillRect(0, 0, 960, 1060);
  ctx.drawImage(image, 305, 32, 350, 350);
  ctx.fillStyle = '#111e32';
  ctx.fillRect(52, 400, 856, 590);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6bdef6';
  ctx.font = 'bold 28px system-ui';
  ctx.fillText('ORÇAMENTO DE IMPRESSÃO 3D', 480, 482);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui';
  ctx.fillText(quote.name, 480, 577, 752);
  ctx.fillStyle = '#b2c2d8';
  ctx.font = '32px system-ui';
  ctx.fillText(quote.quantity + (quote.quantity === 1 ? ' peça' : ' peças'), 480, 640);
  ctx.fillStyle = '#6bdef6';
  ctx.font = 'bold 78px system-ui';
  ctx.fillText(money.format(quote.price), 480, 804, 752);
  ctx.fillStyle = '#b2c2d8';
  ctx.font = '27px system-ui';
  ctx.fillText('Valor total', 480, 855);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Imagem indisponível.');
  return new File([blob], 'Orcamento-JH3-Dimensoes.png', { type: 'image/png' });
}

function downloadQuote() {
  if (!preparedImage) return;
  const url = URL.createObjectURL(preparedImage);
  const link = document.createElement('a');
  link.href = url;
  link.download = preparedImage.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
byId('download').addEventListener('click', downloadQuote);
byId('share').addEventListener('click', async () => {
  if (!preparedImage) return;
  const data = { files: [preparedImage] };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  downloadQuote();
  byId('share-status').textContent = 'A imagem foi preparada para baixar. Você pode anexá-la no WhatsApp.';
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
