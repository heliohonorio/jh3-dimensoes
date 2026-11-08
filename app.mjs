import { calculate, decimal, defaultSettings, makerWorldModel } from './calc.mjs';

const $ = id => document.getElementById(id);
const formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const keys = Object.keys(defaultSettings);
const draftIds = ['piece', 'grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes', 'model-link'];
const settingsKey = 'jh3-preferences-v2';
const oldSettingsKey = 'jh3-preferences-v1';
const draftKey = 'jh3-draft-v2';
const historyKey = 'jh3-history-v1';
const logo = new Image();
logo.src = './logo.webp';

let settings = null;
let current = null;
let currentFile = null;
let generation = 0;
let history = [];
let isReturningFromSettings = false;

function storeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function storeRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function validSettings(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const values = { ...defaultSettings };
  for (const key of keys) {
    if (candidate[key] !== undefined) {
      if (typeof candidate[key] !== 'number' || !Number.isFinite(candidate[key])) return null;
      values[key] = candidate[key];
    }
  }
  try {
    calculate(values, { grams: 1, quantity: 1, hours: 1, minutes: 0 });
    return values;
  } catch { return null; }
}

settings = validSettings(storeGet(settingsKey) || storeGet(oldSettingsKey));
const loaded = storeGet(historyKey);
history = Array.isArray(loaded) ? loaded.filter(x => x && typeof x.name === 'string' && Number.isFinite(x.price)).slice(0, 8) : [];

function switchView(view) {
  const showQuote = view === 'quote';
  $('quote-view').hidden = !showQuote;
  $('settings-view').hidden = showQuote;
  $('tab-quote').classList.toggle('active', showQuote);
  $('tab-settings').classList.toggle('active', !showQuote);
  $('tab-quote').setAttribute('aria-selected', String(showQuote));
  $('tab-settings').setAttribute('aria-selected', String(!showQuote));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
$('tab-quote').addEventListener('click', () => switchView('quote'));
$('tab-settings').addEventListener('click', () => switchView('settings'));
$('setup-now').addEventListener('click', () => { isReturningFromSettings = true; switchView('settings'); });
$('back-quote').addEventListener('click', () => switchView('quote'));

function updateSetupNotice() {
  $('first-setup').hidden = Boolean(settings);
}

function fillSettings() {
  for (const key of keys) {
    $(key).value = String(settings?.[key] ?? defaultSettings[key]).replace('.', ',');
  }
}
fillSettings();
updateSetupNotice();

$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  $('settings-error').textContent = '';
  const values = {};
  for (const key of keys) {
    const input = $(key);
    const value = input.value.trim();
    values[key] = decimal(value || (!input.required ? String(defaultSettings[key]) : ''));
    input.removeAttribute('aria-invalid');
  }
  const valid = validSettings(values);
  if (!valid) {
    $('settings-error').textContent =
      'Revise os valores. O peso do rolo deve ser maior que zero e a soma da margem com as taxas, menor que 100%.';
    $('settings-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  settings = valid;
  const persisted = storeSet(settingsKey, valid);
  updateSetupNotice();
  invalidateQuote();
  isReturningFromSettings = false;
  switchView('quote');
  if (!persisted) {
    alert('Os valores foram aplicados, mas o navegador não permitiu salvá-los. Evite usar o modo privado.');
  }
});

function invalidateQuote() {
  generation++;
  current = null;
  currentFile = null;
  $('result').hidden = true;
  $('quote-error').textContent = '';
  for (const key of ['share', 'copy', 'download']) $(key).disabled = true;
  $('share-status').textContent = '';
}
function getDraft() {
  return Object.fromEntries(draftIds.map(key => [key, $(key).value]));
}
function saveDraft() { storeSet(draftKey, getDraft()); }
function restoreDraft() {
  const draft = storeGet(draftKey);
  if (draft && typeof draft === 'object') {
    for (const key of draftIds) {
      if (typeof draft[key] === 'string') $(key).value = draft[key];
    }
  }
}
restoreDraft();

function getJob() {
  return {
    grams: decimal($('grams').value),
    quantity: decimal($('quantity').value),
    hours: decimal($('hours').value),
    minutes: decimal($('minutes').value),
    extras: decimal($('extras').value.trim() || '0'),
    laborMinutes: decimal($('laborMinutes').value.trim() || '0')
  };
}
$('quote-form').addEventListener('input', event => {
  saveDraft();
  if (current && event.target.id !== 'model-link') invalidateQuote();
  event.target.removeAttribute('aria-invalid');
  if (event.target.id === 'model-link') {
    $('model-status').textContent = '';
    $('model-page').hidden = true;
  }
});

$('identify').addEventListener('click', () => {
  try {
    const model = makerWorldModel($('model-link').value);
    $('piece').value = model.title.slice(0, 90);
    $('model-page').href = model.url;
    $('model-page').hidden = false;
    $('model-status').textContent = 'Nome da peça preenchido.';
    if (current) invalidateQuote();
    saveDraft();
  } catch {
    $('model-page').hidden = true;
    $('model-status').textContent = 'Cole o endereço completo de um modelo do MakerWorld.';
  }
});

function addCost(label, value, strong = false) {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = formatMoney.format(value);
  if (strong) { dt.className = 'strong-cost'; dd.className = 'strong-cost'; }
  $('costs').append(dt, dd);
}
function showCosts(result) {
  $('costs').replaceChildren();
  addCost('Filamento', result.filament);
  addCost('Energia', result.energy);
  addCost('Desgaste da impressora', result.machine);
  addCost('Reserva para falhas', result.reserve);
  addCost('Acabamento', result.labor);
  addCost('Outros gastos', result.extras);
  addCost('Total dos custos', result.cost, true);
  addCost('Taxas de venda', result.fees);
  addCost('Lucro estimado', result.profit, true);
}

function saveHistory(result, job) {
  const item = {
    name: result.name, price: result.price, quantity: job.quantity,
    grams: job.grams, hours: job.hours, minutes: job.minutes,
    extras: job.extras, laborMinutes: job.laborMinutes,
    date: new Date().toISOString()
  };
  const isSame = x => x.name === item.name && x.grams === item.grams &&
    x.quantity === item.quantity && x.hours === item.hours &&
    x.minutes === item.minutes && x.extras === item.extras &&
    x.laborMinutes === item.laborMinutes;
  history = [item, ...history.filter(x => !isSame(x))].slice(0, 8);
  storeSet(historyKey, history);
  renderHistory();
}
function renderHistory() {
  $('history-section').hidden = history.length === 0;
  const list = $('history-list');
  list.replaceChildren();
  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';
    const data = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const detail = document.createElement('small');
    const date = new Date(item.date);
    detail.textContent = formatMoney.format(item.price) + ' · ' + item.quantity + ' peça(s)' +
      (Number.isFinite(date.getTime()) ? ' · ' + formatDate.format(date) : '');
    data.append(name, detail);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button-outline';
    button.textContent = 'Reutilizar';
    button.addEventListener('click', () => {
      $('piece').value = item.name;
      for (const key of ['grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes']) {
        $(key).value = String(item[key] ?? 0).replace('.', ',');
      }
      saveDraft();
      switchView('quote');
      $('quote-form').requestSubmit();
    });
    card.append(data, button);
    list.append(card);
  });
}
renderHistory();
$('clear-history').addEventListener('click', () => {
  if (!confirm('Apagar os orçamentos salvos neste aparelho?')) return;
  history = [];
  storeRemove(historyKey);
  renderHistory();
});

$('quote-form').addEventListener('submit', event => {
  event.preventDefault();
  $('quote-error').textContent = '';
  if (!settings) {
    $('quote-error').textContent = 'Primeiro salve seus custos. É só configurar uma vez.';
    isReturningFromSettings = true;
    switchView('settings');
    return;
  }
  const job = getJob();
  for (const key of ['grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes']) $(key).removeAttribute('aria-invalid');
  if (!Number.isFinite(job.grams) || job.grams <= 0) {
    $('grams').setAttribute('aria-invalid', 'true');
    $('quote-error').textContent = 'Informe o peso do filamento usado, em gramas.';
    $('grams').focus();
    return;
  }
  if (!Number.isInteger(job.quantity) || job.quantity < 1) {
    $('quantity').setAttribute('aria-invalid', 'true');
    $('quote-error').textContent = 'Informe quantas peças serão impressas.';
    $('quantity').focus();
    return;
  }
  if (!Number.isFinite(job.hours) || !Number.isFinite(job.minutes) || job.hours + job.minutes / 60 <= 0) {
    $('hours').setAttribute('aria-invalid', 'true');
    $('quote-error').textContent = 'Informe a duração total da impressão.';
    $('hours').focus();
    return;
  }
  let result;
  try {
    result = {
      ...calculate(settings, job),
      name: $('piece').value.trim() || 'Peça impressa em 3D',
      quantity: job.quantity
    };
  } catch (error) {
    $('quote-error').textContent = error.message;
    return;
  }
  invalidateQuote();
  current = result;
  $('result').hidden = false;
  $('total').textContent = formatMoney.format(result.price);
  $('units').textContent = result.quantity === 1
    ? '1 peça · valor total'
    : result.quantity + ' peças · ' + formatMoney.format(result.unit) + ' cada';
  $('cost-label').textContent = formatMoney.format(result.cost + result.fees);
  $('profit-label').textContent = formatMoney.format(result.profit);
  showCosts(result);
  saveDraft();
  saveHistory(result, job);
  $('copy').disabled = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const version = generation;
  $('share-status').textContent = 'Preparando a imagem do orçamento...';
  buildImage(result).then(file => {
    if (generation !== version) return;
    currentFile = file;
    $('share').disabled = false;
    $('download').disabled = false;
    $('share-status').textContent = '';
  }).catch(() => {
    if (generation === version) $('share-status').textContent =
      'A imagem não ficou disponível. Você ainda pode copiar a mensagem.';
  });
});

$('clear').addEventListener('click', () => {
  $('quote-form').reset();
  $('piece').value = '';
  $('grams').value = '';
  $('hours').value = '0';
  $('minutes').value = '0';
  $('quantity').value = '1';
  $('extras').value = '';
  $('laborMinutes').value = '';
  $('model-link').value = '';
  $('model-page').hidden = true;
  $('model-status').textContent = '';
  storeRemove(draftKey);
  invalidateQuote();
  $('grams').focus();
});

function messageFor(result) {
  return [
    'JH3 DIMENSÕES — Orçamento de impressão 3D', '',
    'Peça: ' + result.name,
    'Quantidade: ' + result.quantity + (result.quantity === 1 ? ' peça' : ' peças'),
    'Valor total: ' + formatMoney.format(result.price),
    ...(result.quantity > 1 ? ['Valor por peça: ' + formatMoney.format(result.unit)] : []),
    '', 'Prazo e entrega: a combinar.',
    'JH3 Dimensões · A peça que faltava no seu dia a dia.'
  ].join('\n');
}
async function copyMessage() {
  if (!current) return;
  const msg = messageFor(current);
  let success = false;
  try { await navigator.clipboard.writeText(msg); success = true; }
  catch {
    const text = document.createElement('textarea');
    text.value = msg;
    text.style.position = 'fixed';
    text.style.opacity = '0';
    document.body.append(text);
    text.select();
    success = document.execCommand('copy');
    text.remove();
  }
  $('share-status').textContent = success
    ? 'Mensagem copiada. Agora é só colar no WhatsApp.'
    : 'Não foi possível copiar automaticamente. Use Compartilhar.';
}
$('copy').addEventListener('click', copyMessage);

function contain(ctx, image, x, y, w, h) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const rw = image.naturalWidth * scale, rh = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - rw) / 2, y + (h - rh) / 2, rw, rh);
}
async function buildImage(result) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#132535';
  ctx.fillRect(60, 60, 960, 1230);
  ctx.strokeStyle = '#395b6e';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, 960, 1230);
  try {
    if (!logo.complete) await logo.decode();
    if (logo.naturalWidth) contain(ctx, logo, 342, 90, 400, 315);
  } catch {}
  ctx.textAlign = 'center';
  if (!logo.naturalWidth) {
    ctx.fillStyle = '#66d8ec';
    ctx.font = 'bold 65px system-ui';
    ctx.fillText('JH3 DIMENSÕES', 540, 260);
  }
  ctx.fillStyle = '#66d8ec';
  ctx.font = 'bold 30px system-ui';
  ctx.fillText('ORÇAMENTO DE IMPRESSÃO 3D', 540, 490);
  ctx.fillStyle = '#f5f8fb';
  ctx.font = 'bold 53px system-ui';
  const words = result.name.split(/\s+/);
  let first = '', second = '';
  for (const word of words) {
    if ((first + ' ' + word).trim().length <= 27 || !first) first = (first + ' ' + word).trim();
    else second = (second + ' ' + word).trim();
  }
  ctx.fillText(first, 540, second ? 594 : 615, 855);
  if (second) ctx.fillText(second, 540, 654, 855);
  ctx.fillStyle = '#bed2de';
  ctx.font = '32px system-ui';
  ctx.fillText(result.quantity + (result.quantity === 1 ? ' peça' : ' peças'), 540, 740);
  ctx.strokeStyle = '#3b6173';
  ctx.beginPath();
  ctx.moveTo(185, 785);
  ctx.lineTo(895, 785);
  ctx.stroke();
  ctx.fillStyle = '#c2d4df';
  ctx.font = '27px system-ui';
  ctx.fillText('VALOR TOTAL', 540, 865);
  ctx.fillStyle = '#66d8ec';
  ctx.font = 'bold 90px system-ui';
  ctx.fillText(formatMoney.format(result.price), 540, 978, 850);
  if (result.quantity > 1) {
    ctx.fillStyle = '#d7e4e9';
    ctx.font = '30px system-ui';
    ctx.fillText(formatMoney.format(result.unit) + ' por peça', 540, 1055);
  }
  ctx.fillStyle = '#b6cad5';
  ctx.font = '26px system-ui';
  ctx.fillText('Prazo e entrega: a combinar', 540, 1155);
  ctx.fillStyle = '#88afc0';
  ctx.font = '22px system-ui';
  ctx.fillText('JH3 Dimensões · A peça que faltava no seu dia a dia.', 540, 1232, 880);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Imagem indisponível.');
  return new File([blob], 'Orcamento-JH3-Dimensoes.png', { type: 'image/png' });
}
$('download').addEventListener('click', () => {
  if (!currentFile) return;
  const url = URL.createObjectURL(currentFile);
  const link = document.createElement('a');
  link.href = url;
  link.download = currentFile.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  $('share-status').textContent = 'Imagem pronta para salvar ou enviar.';
});
$('share').addEventListener('click', async () => {
  if (!current) return;
  const data = { title: 'JH3 Dimensões', text: messageFor(current) };
  if (currentFile && navigator.canShare?.({ files: [currentFile] })) data.files = [currentFile];
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  await copyMessage();
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
