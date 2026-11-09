import { calculate, decimal, defaultSettings, makerWorldModel, parsePercentage, quoteBreakdown } from './calc.mjs';
import { formatCurrency, installCurrencyMasks } from './currency.mjs';
import { inspectProjectFile, fetchSlicedFile } from './project-import.mjs';

const $ = id => document.getElementById(id);
const formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const keys = Object.keys(defaultSettings).filter(key => key !== 'margin');
const draftIds = ['piece', 'grams', 'quantity', 'hours', 'minutes', 'extras', 'laborMinutes', 'model-link', 'markup-custom'];
const settingsKey = 'jh3-preferences-v2';
const oldSettingsKey = 'jh3-preferences-v1';
const draftKey = 'jh3-draft-v2';
const historyKey = 'jh3-history-v1';
const electricityUpdateKey = 'jh3-energy-reference-oct-2026-v1';
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
    calculate(values, { grams: 1, quantity: 1, hours: 1, minutes: 0, markup: 50 });
    return values;
  } catch { return null; }
}

settings = validSettings(storeGet(settingsKey) || storeGet(oldSettingsKey));
// Atualiza os dois parâmetros de energia uma única vez em aparelhos com
// configurações antigas, sem alterar o custo do material nem a margem.
if (!storeGet(electricityUpdateKey)) {
  if (settings) {
    settings = { ...settings, tariff: defaultSettings.tariff, watts: defaultSettings.watts };
    storeSet(settingsKey, settings);
  }
  storeSet(electricityUpdateKey, true);
}
installCurrencyMasks();
const loaded = storeGet(historyKey);
history = Array.isArray(loaded) ? loaded.filter(x => x && typeof x.name === 'string' && Number.isFinite(x.price)).slice(0, 8) : [];

function switchView(view) {
  const showQuote = view === 'quote';
  $('quote-view').hidden = !showQuote;
  $('settings-view').hidden = showQuote;
  $('tab-settings').classList.toggle('active', !showQuote);
  $('tab-settings').setAttribute('aria-expanded', String(!showQuote));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
// Custos ficam acessíveis pela engrenagem discreta do cabeçalho.
$('tab-settings').addEventListener('click', () =>
  switchView($('settings-view').hidden ? 'settings' : 'quote'));
$('setup-now').addEventListener('click', () => { isReturningFromSettings = true; switchView('settings'); });
$('back-quote').addEventListener('click', () => switchView('quote'));

function updateSetupNotice() {
  $('first-setup').hidden = Boolean(settings);
}

function fillSettings() {
  for (const key of keys) {
    const input = $(key);
    const value = settings?.[key] ?? defaultSettings[key];
    input.value = input.matches('[data-currency]') ? formatCurrency(value) : String(value).replace('.', ',');
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
function chosenMarkup() {
  const radio = document.querySelector('input[name="markup"]:checked');
  return radio?.value ?? '50';
}
function updateCustomMarkup() {
  $('custom-markup').hidden = chosenMarkup() !== 'custom';
}
function setChosenMarkup(mode, custom) {
  const value = ['25', '50', '75', '100', '150', 'custom'].includes(String(mode)) ? String(mode) : '50';
  const radio = document.querySelector('input[name="markup"][value="' + value + '"]');
  if (radio) radio.checked = true;
  if (custom !== undefined && custom !== null) $('markup-custom').value = String(custom);
  updateCustomMarkup();
}
function getDraft() {
  return { ...Object.fromEntries(draftIds.map(key => [key, $(key).value])), markup: chosenMarkup() };
}
function saveDraft() { storeSet(draftKey, getDraft()); }
function restoreDraft() {
  const draft = storeGet(draftKey);
  if (draft && typeof draft === 'object') {
    for (const key of draftIds) {
      if (typeof draft[key] === 'string') {
        $(key).value = $(key).matches('[data-currency]') && draft[key].trim()
          ? formatCurrency(decimal(draft[key]))
          : draft[key];
      }
    }
    setChosenMarkup(draft.markup, draft['markup-custom']);
  } else {
    setChosenMarkup('50');
  }
}
restoreDraft();
document.querySelectorAll('input[name="markup"]').forEach(radio => {
  radio.addEventListener('change', () => {
    updateCustomMarkup();
    if (current) invalidateQuote();
    saveDraft();
    if (chosenMarkup() === 'custom') $('markup-custom').focus();
  });
});
$('markup-custom').addEventListener('input', () => {
  if (current) invalidateQuote();
  saveDraft();
});

function getJob() {
  return {
    grams: decimal($('grams').value),
    quantity: decimal($('quantity').value),
    hours: decimal($('hours').value),
    minutes: decimal($('minutes').value),
    extras: decimal($('extras').value.trim() || '0'),
    laborMinutes: decimal($('laborMinutes').value.trim() || '0'),
    markup: chosenMarkup() === 'custom' ? parsePercentage($('markup-custom').value) : Number(chosenMarkup())
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

function applyImportedProject(data) {
  const printer = data.printer ?? '';
  if (printer && !/\ba1\s*mini\b/i.test(printer)) {
    throw new Error('Este arquivo foi fatiado para "' + printer +
      '", e não para a A1 Mini. Selecione A1 Mini no Bambu Studio, fatie novamente e importe o arquivo correto.');
  }
  const grams = Number(data.grams);
  const duration = Math.ceil(Number(data.seconds) / 60);
  if (!Number.isFinite(grams) || grams <= 0 || grams > 1000000 ||
      !Number.isFinite(duration) || duration < 1) {
    throw new Error('Este arquivo não contém peso e tempo de impressão válidos.');
  }
  $('piece').value = (data.name || 'Peça impressa em 3D').slice(0, 90);
  $('grams').value = String(Math.round(grams * 100) / 100).replace('.', ',');
  $('hours').value = String(Math.floor(duration / 60));
  $('minutes').value = String(duration % 60);
  // A quantidade não pode ser inferida com segurança do cabeçalho fatiado.
  $('import-info').textContent = [
    '✓ Importado de ' + data.source,
    'Filamento: ' + grams.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' g',
    'Tempo: ' + Math.floor(duration / 60) + ' h ' + duration % 60 + ' min',
    data.material ? 'Material: ' + data.material : '',
    printer ? 'Impressora: ' + printer : 'Impressora não informada: confirme o perfil A1 Mini.',
    data.plates > 1 ? 'Placas: ' + data.plates + ' (tempo e material somados)' : '',
    'Confira a quantidade de peças antes de calcular.'
  ].filter(Boolean).join('\n');
  $('import-info').hidden = false;
  $('model-status').textContent = 'Dados de fatiamento preenchidos. Confira as informações antes de calcular.';
  if (current) invalidateQuote();
  saveDraft();
}

$('project-file').addEventListener('change', async () => {
  const file = $('project-file').files?.[0];
  if (!file) return;
  $('model-status').textContent = 'Lendo o arquivo selecionado...';
  $('import-info').hidden = true;
  try {
    const result = await inspectProjectFile(file);
    applyImportedProject(result);
  } catch (error) {
    $('model-status').textContent = error.message || 'Não foi possível ler o arquivo.';
  }
});

$('identify').addEventListener('click', async () => {
  const button = $('identify');
  const url = $('model-link').value.trim();
  $('import-info').hidden = true;
  $('model-page').hidden = true;
  if (!url) {
    $('model-status').textContent = 'Cole o endereço do projeto ou escolha o arquivo fatiado.';
    return;
  }
  button.disabled = true;
  $('model-status').textContent = 'Verificando o endereço...';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Informe um link HTTPS público.');
    const fileData = await fetchSlicedFile(url);
    if (fileData) {
      applyImportedProject(fileData);
      $('model-page').href = parsed.href;
      $('model-page').hidden = false;
      return;
    }
    let name = '';
    try {
      name = makerWorldModel(url).title;
    } catch {
      // Modelos externos podem não trazer informações de fatiamento.
      const last = parsed.pathname.split('/').filter(Boolean).pop() || '';
      const readable = decodeURIComponent(last).replace(/\.(stl|3mf)$/i, '')
        .replace(/[-_]+/g, ' ').trim();
      if (readable.length > 4 && /[a-zA-ZÀ-ÿ]/.test(readable)) name = readable;
    }
    if (name) $('piece').value = name.slice(0, 90);
    $('model-page').href = parsed.href;
    $('model-page').hidden = false;
    $('model-status').textContent =
      'Projeto identificado pelo link. Essa página não fornece peso e tempo para a A1 Mini. ' +
      'Baixe o projeto, fatie no Bambu Studio e escolha o arquivo .gcode.3mf aqui para preencher automaticamente.';
    if (current) invalidateQuote();
    saveDraft();
  } catch (error) {
    $('model-status').textContent = error.message || 'Não foi possível importar esse endereço.';
  } finally {
    button.disabled = false;
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
function showCosts(result, amounts) {
  $('costs').replaceChildren();
  addCost('Filamento', result.filament);
  addCost('Energia', result.energy);
  addCost('Desgaste da impressora', result.machine);
  addCost('Reserva para falhas', result.reserve);
  addCost('Acabamento', result.labor);
  addCost('Outros gastos', result.extras);
  addCost('Total dos custos', amounts.cost, true);
  if (amounts.fees > 0) addCost('Taxas de venda', amounts.fees);
  addCost('Lucro da venda', amounts.profit, true);
}

function saveHistory(result, job) {
  const item = {
    name: result.name, price: result.price, quantity: job.quantity,
    grams: job.grams, hours: job.hours, minutes: job.minutes,
    extras: job.extras, laborMinutes: job.laborMinutes,
    markup: job.markup,
    date: new Date().toISOString()
  };
  const isSame = x => x.name === item.name && x.grams === item.grams &&
    x.quantity === item.quantity && x.hours === item.hours &&
    x.minutes === item.minutes && x.extras === item.extras &&
    x.laborMinutes === item.laborMinutes && x.markup === item.markup;
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
        const value = Number(item[key] ?? 0);
        $(key).value = $(key).matches('[data-currency]')
          ? formatCurrency(value)
          : String(value).replace('.', ',');
      }
      if (Number.isFinite(item.markup)) {
        const known = [25, 50, 75, 100, 150].includes(item.markup);
        setChosenMarkup(known ? item.markup : 'custom', known ? undefined : item.markup);
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
  if (chosenMarkup() === 'custom' && (!Number.isFinite(job.markup) || job.markup < 0)) {
    $('quote-error').textContent = 'Informe um percentual de lucro válido, igual ou maior que zero. Por exemplo: 1000 ou 2.500.';
    $('markup-custom').focus();
    return;
  }
  let result, amounts;
  try {
    result = {
      ...calculate(settings, job),
      name: $('piece').value.trim() || 'Peça impressa em 3D',
      quantity: job.quantity
    };
    amounts = quoteBreakdown(result, job.quantity);
  } catch (error) {
    $('quote-error').textContent = error.message;
    return;
  }
  invalidateQuote();
  current = result;
  $('result').hidden = false;
  // Cada parcela é calculada separadamente, e todas somam o valor final.
  $('cost-per-piece').textContent = formatMoney.format(amounts.costPerPiece);
  $('profit-per-piece').textContent = formatMoney.format(amounts.profitPerPiece);
  $('chosen-profit').textContent =
    job.markup.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) +
    '% sobre o custo da impressão.';
  $('sum-quantity').textContent = job.quantity === 1
    ? 'Soma para 1 peça'
    : 'Soma para as ' + job.quantity + ' peças';
  $('cost-label').textContent = formatMoney.format(amounts.cost);
  $('profit-label').textContent = formatMoney.format(amounts.profit);
  $('fees-line').hidden = amounts.fees === 0;
  $('fees-label').textContent = formatMoney.format(amounts.fees);
  $('total').textContent = formatMoney.format(amounts.price);
  $('units').textContent = job.quantity === 1
    ? '1 peça · preço final'
    : job.quantity + ' peças · ' + formatMoney.format(amounts.pricePerPiece) + ' por peça';
  $('unit-explainer').textContent = job.quantity === 1
    ? 'Valores separados para facilitar a conferência do custo e do lucro.'
    : 'Total = (custo de 1 peça + lucro de 1 peça) × quantidade.';
  showCosts(result, amounts);
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
  $('project-file').value = '';
  $('import-info').hidden = true;
  $('import-info').textContent = '';
  setChosenMarkup('50', '');
  $('model-page').hidden = true;
  $('model-status').textContent = '';
  storeRemove(draftKey);
  invalidateQuote();
  $('grams').focus();
});

function messageFor(result) {
  return [
    'JH3 DIMENSÕES — Orçamento', '',
    'Quantidade: ' + result.quantity + (result.quantity === 1 ? ' peça' : ' peças'),
    'Valor total: ' + formatMoney.format(result.price)
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
  ctx.fillStyle = '#bed2de';
  ctx.font = '40px system-ui';
  ctx.fillText('Quantidade: ' + result.quantity + (result.quantity === 1 ? ' peça' : ' peças'), 540, 670);
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
