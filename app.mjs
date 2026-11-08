import { calculate, decimal, defaultSettings, makerWorldModel } from './calc.mjs';

const el = id => document.getElementById(id);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const settingsKey = 'jh3-preferences-v2';
const oldSettingsKey = 'jh3-preferences-v1';
const draftKey = 'jh3-draft-v2';
const historyKey = 'jh3-history-v1';
const settingNames = Object.keys(defaultSettings);
const draftNames = ['piece', 'grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes', 'model-link'];
const modal = el('preferences');
const settingsForm = el('preferences-form');
const quoteForm = el('quote');
const logo = new Image();
logo.src = './logo.webp';
let settings = undefined;
let current = undefined;
let currentFile = undefined;
let generation = 0;
let savedHistory = [];

function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function deleteStorage(key) {
  try { localStorage.removeItem(key); } catch {}
}
function validateSettings(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const values = { ...defaultSettings };
  for (const key of settingNames) {
    const value = candidate[key];
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      values[key] = value;
    }
  }
  try {
    calculate(values, { grams: 1, quantity: 1, hours: 1, minutes: 0 });
    return values;
  } catch { return null; }
}

settings = validateSettings(readStorage(settingsKey) ?? readStorage(oldSettingsKey));
savedHistory = readStorage(historyKey);
if (!Array.isArray(savedHistory)) savedHistory = [];
savedHistory = savedHistory.filter(item => item && typeof item.name === 'string' && Number.isFinite(item.price))
  .slice(0, 8);

function announceSettings() {
  el('settings-status').textContent = settings
    ? 'Custos salvos neste aparelho. Pronto para calcular.'
    : 'Primeiro, configure seus custos uma única vez.';
}
function openSettings() {
  for (const key of settingNames) {
    el(key).value = String(settings?.[key] ?? defaultSettings[key]).replace('.', ',');
  }
  el('settings-error').textContent = '';
  if (!modal.open) modal.showModal();
}
el('settings').addEventListener('click', openSettings);
el('close-settings').addEventListener('click', () => modal.close());

settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  el('settings-error').textContent = '';
  const values = {};
  for (const key of settingNames) {
    const raw = el(key).value.trim();
    values[key] = decimal(raw === '' && !el(key).required ? String(defaultSettings[key]) : raw);
  }
  const valid = validateSettings(values);
  if (!valid) {
    el('settings-error').textContent =
      'Confira os valores. O peso do rolo precisa ser maior que zero, e margem + taxas devem somar menos de 100%.';
    el('settings-error').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  settings = valid;
  const saved = writeStorage(settingsKey, settings);
  announceSettings();
  invalidate('Custos atualizados. Faça um novo cálculo para ver o preço.');
  if (!saved) el('settings-status').textContent =
    'Custos em uso, mas o navegador não permitiu salvá-los. Verifique o modo privado.';
  modal.close();
});

function invalidate(message = 'Os dados foram alterados. Toque em “Calcular meu preço”.') {
  generation++;
  current = undefined;
  currentFile = undefined;
  el('total').textContent = '—';
  el('units').textContent = message;
  el('summary-extra').hidden = true;
  el('share').disabled = true;
  el('copy').disabled = true;
  el('download').disabled = true;
  el('share-status').textContent = '';
  el('quote-error').textContent = '';
}

function draftFromForm() {
  return Object.fromEntries(draftNames.map(key => [key, el(key).value]));
}
function saveDraft() {
  writeStorage(draftKey, draftFromForm());
}
function restoreDraft() {
  const draft = readStorage(draftKey);
  if (!draft || typeof draft !== 'object') return;
  for (const key of draftNames) {
    if (typeof draft[key] === 'string') el(key).value = draft[key];
  }
}
function readJob() {
  return {
    grams: decimal(el('grams').value),
    quantity: decimal(el('quantity').value),
    hours: decimal(el('hours').value),
    minutes: decimal(el('minutes').value),
    extras: decimal(el('extras').value.trim() || '0'),
    laborMinutes: decimal(el('laborMinutes').value.trim() || '0')
  };
}
function outputName() { return el('piece').value.trim() || 'Peça impressa em 3D'; }

quoteForm.addEventListener('input', event => {
  saveDraft();
  if (event.target.id !== 'model-link' && current) invalidate();
  if (event.target.id === 'model-link') {
    el('model-status').textContent = '';
    el('model-page').hidden = true;
  }
  if (event.target.getAttribute('aria-invalid') === 'true') event.target.removeAttribute('aria-invalid');
});

el('identify').addEventListener('click', () => {
  try {
    const model = makerWorldModel(el('model-link').value);
    el('piece').value = model.title.slice(0, 90);
    el('model-page').href = model.url;
    el('model-page').hidden = false;
    el('model-status').textContent =
      'Nome preenchido! O peso e o tempo continuam sendo os do seu fatiamento no Bambu Studio.';
    if (current) invalidate();
    saveDraft();
  } catch {
    el('model-page').hidden = true;
    el('model-status').textContent = 'Cole o link completo de um modelo no MakerWorld.';
  }
});

function addCost(term, amount, strong = false) {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = term;
  dd.textContent = money.format(amount);
  if (strong) { dt.className = 'strong-cost'; dd.className = 'strong-cost'; }
  el('costs').append(dt, dd);
}
function showBreakdown(quote) {
  el('costs').replaceChildren();
  addCost('Filamento (com sobra)', quote.filament);
  addCost('Energia elétrica', quote.energy);
  addCost('Desgaste da impressora', quote.machine);
  addCost('Reserva para falhas', quote.reserve);
  addCost('Seu tempo de trabalho', quote.labor);
  addCost('Embalagem e extras', quote.extras);
  addCost('Custo de produção', quote.cost, true);
  addCost('Taxas sobre a venda', quote.fees);
  addCost('Lucro estimado', quote.profit, true);
}

function rememberQuote(quote, job) {
  const item = {
    name: quote.name, price: quote.price, quantity: job.quantity,
    grams: job.grams, hours: job.hours, minutes: job.minutes, extras: job.extras,
    laborMinutes: job.laborMinutes, date: new Date().toISOString()
  };
  const same = row => row.name === item.name && row.grams === item.grams &&
    row.hours === item.hours && row.minutes === item.minutes &&
    row.quantity === item.quantity && row.extras === item.extras &&
    row.laborMinutes === item.laborMinutes;
  savedHistory = [item, ...savedHistory.filter(row => !same(row))].slice(0, 8);
  writeStorage(historyKey, savedHistory);
  renderHistory();
}

function renderHistory() {
  const section = el('history-section');
  const list = el('history-list');
  list.replaceChildren();
  section.hidden = savedHistory.length === 0;
  savedHistory.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'history-item';
    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const caption = document.createElement('small');
    const date = new Date(item.date);
    caption.textContent = money.format(item.price) + ' · ' + item.quantity + ' un.' +
      (Number.isFinite(date.getTime()) ? ' · ' + dateFormat.format(date) : '');
    details.append(name, caption);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'outline';
    button.textContent = 'Reutilizar';
    button.setAttribute('aria-label', 'Reutilizar orçamento de ' + item.name);
    button.addEventListener('click', () => {
      for (const key of ['grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes']) {
        el(key).value = String(item[key] ?? 0).replace('.', ',');
      }
      el('piece').value = item.name;
      saveDraft();
      quoteForm.requestSubmit();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      el('grams').focus({ preventScroll: true });
    });
    row.append(details, button);
    list.append(row);
  });
}
el('clear-history').addEventListener('click', () => {
  if (!window.confirm('Apagar todos os orçamentos recentes deste aparelho?')) return;
  savedHistory = [];
  deleteStorage(historyKey);
  renderHistory();
});

quoteForm.addEventListener('submit', event => {
  event.preventDefault();
  el('quote-error').textContent = '';
  if (!settings) {
    openSettings();
    el('quote-error').textContent = 'Salve seus custos antes de calcular.';
    return;
  }
  const job = readJob();
  const invalidFields = ['grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes'];
  for (const key of invalidFields) el(key).removeAttribute('aria-invalid');
  if (!Number.isFinite(job.grams) || job.grams <= 0) {
    el('grams').setAttribute('aria-invalid', 'true');
    el('quote-error').textContent = 'Informe o peso total do filamento em gramas.';
    el('grams').focus();
    return;
  }
  if (!Number.isFinite(job.hours) || !Number.isFinite(job.minutes) ||
      job.hours + job.minutes / 60 <= 0) {
    el('hours').setAttribute('aria-invalid', 'true');
    el('quote-error').textContent = 'Informe o tempo de impressão do lote.';
    el('hours').focus();
    return;
  }
  let quote;
  try {
    quote = { ...calculate(settings, job), name: outputName(), quantity: job.quantity };
  } catch (error) {
    el('quote-error').textContent = error.message;
    return;
  }
  invalidate();
  current = quote;
  el('total').textContent = money.format(quote.price);
  el('units').textContent = quote.quantity === 1
    ? '1 peça · valor total do pedido'
    : quote.quantity + ' peças · ' + money.format(quote.unit) + ' por peça';
  el('cost-label').textContent = money.format(quote.cost + quote.fees);
  el('profit-label').textContent = money.format(quote.profit);
  el('summary-extra').hidden = false;
  el('copy').disabled = false;
  showBreakdown(quote);
  saveDraft();
  rememberQuote(quote, job);
  el('result-heading').focus({ preventScroll: true });
  el('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const version = generation;
  el('share-status').textContent = 'Preparando a imagem com a marca JH3...';
  makeQuoteImage(quote).then(file => {
    if (generation !== version) return;
    currentFile = file;
    el('share').disabled = false;
    el('download').disabled = false;
    el('share-status').textContent = '';
  }).catch(() => {
    if (generation !== version) return;
    el('share-status').textContent =
      'Não foi possível criar a imagem. Você ainda pode copiar a mensagem do orçamento.';
  });
});

el('clear').addEventListener('click', () => {
  quoteForm.reset();
  el('piece').value = '';
  el('grams').value = '';
  el('quantity').value = '1';
  el('hours').value = '0';
  el('minutes').value = '0';
  el('extras').value = '';
  el('laborMinutes').value = '';
  el('model-link').value = '';
  el('model-page').hidden = true;
  el('model-status').textContent = '';
  deleteStorage(draftKey);
  invalidate('Preencha os dados da peça para começar.');
  el('grams').focus();
});

function quoteMessage(quote) {
  return [
    'JH3 DIMENSÕES · Orçamento de impressão 3D',
    '',
    'Peça: ' + quote.name,
    'Quantidade: ' + quote.quantity + (quote.quantity === 1 ? ' peça' : ' peças'),
    'Valor total: ' + money.format(quote.price),
    ...(quote.quantity > 1 ? ['Valor por peça: ' + money.format(quote.unit)] : []),
    '',
    'Prazo e entrega: a combinar.',
    'JH3 Dimensões · A peça que faltava no seu dia a dia.'
  ].join('\n');
}

async function copyMessage() {
  if (!current) return;
  const message = quoteMessage(current);
  let copied = false;
  try {
    await navigator.clipboard.writeText(message);
    copied = true;
  } catch {
    // Alguns navegadores móveis só permitem copiar pelo campo selecionado.
    const area = document.createElement('textarea');
    area.value = message;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    copied = document.execCommand('copy');
    area.remove();
  }
  el('share-status').textContent = copied
    ? 'Mensagem copiada! Agora é só colar no WhatsApp.'
    : 'Não foi possível copiar. Use o botão Compartilhar.';
}
el('copy').addEventListener('click', copyMessage);

function drawContained(ctx, img, x, y, width, height) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
async function makeQuoteImage(quote) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Imagem indisponível.');
  ctx.fillStyle = '#0a111c';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#112133';
  ctx.fillRect(60, 60, 960, 1230);
  ctx.strokeStyle = '#29495b';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, 960, 1230);

  try {
    if (!logo.complete) await logo.decode();
    if (logo.naturalWidth && logo.naturalHeight) drawContained(ctx, logo, 346, 92, 388, 310);
  } catch {
    // O orçamento continua disponível mesmo se a imagem da marca falhar.
  }
  if (!logo.naturalWidth) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 61px system-ui';
    ctx.fillStyle = '#66d8ec';
    ctx.fillText('JH3 DIMENSÕES', 540, 280);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#66d8ec';
  ctx.font = 'bold 29px system-ui';
  ctx.fillText('ORÇAMENTO DE IMPRESSÃO 3D', 540, 480);
  ctx.fillStyle = '#e8f2f9';
  ctx.font = 'bold 52px system-ui';
  const name = quote.name.trim();
  if (name.length < 32) {
    ctx.fillText(name, 540, 604, 855);
  } else {
    const words = name.split(/\s+/);
    let line1 = '', line2 = '';
    for (const word of words) {
      if ((line1 + ' ' + word).trim().length <= 28 || !line1) line1 = (line1 + ' ' + word).trim();
      else line2 = (line2 + ' ' + word).trim();
    }
    ctx.fillText(line1, 540, 589, 850);
    ctx.fillText(line2, 540, 648, 850);
  }
  ctx.fillStyle = '#b5c8d7';
  ctx.font = '32px system-ui';
  ctx.fillText(quote.quantity + (quote.quantity === 1 ? ' peça' : ' peças'), 540, 735);
  ctx.strokeStyle = '#335064';
  ctx.beginPath();ctx.moveTo(195,785);ctx.lineTo(885,785);ctx.stroke();
  ctx.fillStyle = '#b5c8d7';
  ctx.font = '27px system-ui';
  ctx.fillText('VALOR TOTAL', 540, 866);
  ctx.fillStyle = '#66d8ec';
  ctx.font = 'bold 89px system-ui';
  ctx.fillText(money.format(quote.price), 540, 982, 860);
  if (quote.quantity > 1) {
    ctx.fillStyle = '#c2d4df';
    ctx.font = '29px system-ui';
    ctx.fillText(money.format(quote.unit) + ' por peça', 540, 1053);
  }
  ctx.fillStyle = '#b0c4d3';
  ctx.font = '25px system-ui';
  ctx.fillText('Prazo e entrega: a combinar', 540, 1150);
  ctx.fillStyle = '#7ba5b8';
  ctx.font = '21px system-ui';
  ctx.fillText('JH3 Dimensões · A peça que faltava no seu dia a dia.', 540, 1230, 880);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível criar imagem.');
  return new File([blob], 'Orcamento-JH3-Dimensoes.png', { type: 'image/png' });
}
function downloadQuote() {
  if (!currentFile) return;
  const url = URL.createObjectURL(currentFile);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = currentFile.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  el('share-status').textContent = 'Imagem pronta. Se abriu no iPhone, use Compartilhar ou Salvar imagem.';
}
el('download').addEventListener('click', downloadQuote);

el('share').addEventListener('click', async () => {
  if (!current) return;
  const message = quoteMessage(current);
  if (currentFile && navigator.canShare?.({ files: [currentFile] })) {
    try {
      await navigator.share({ files: [currentFile], title: 'Orçamento JH3 Dimensões', text: message });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Orçamento JH3 Dimensões', text: message });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyMessage();
  if (currentFile) el('share-status').textContent = 'Mensagem copiada. Você também pode baixar a imagem para enviar.';
});

restoreDraft();
announceSettings();
renderHistory();
if (!settings) setTimeout(openSettings, 250);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
