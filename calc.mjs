/**
 * Valores em reais. Custos de materiais e tempo são totais do lote.
 * Nos orçamentos novos, o lucro é um acréscimo percentual sobre o custo.
 * A regra antiga de margem sobre a venda permanece apenas para compatibilidade.
 */
export function decimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let raw = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, '');
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return NaN;
  return Number(raw.replace(',', '.'));
}

// Para lucro personalizado, aceita 1000, 1.000, 2.500,50 e 2500.5.
export function parsePercentage(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : NaN;
  let raw = String(value ?? '').trim().replace(/\s/g, '').replace(/%$/, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '');
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return NaN;
  return Number(raw.replace(',', '.'));
}

export const defaultSettings = Object.freeze({
  rollPrice: 90, rollGrams: 1000, tariff: 0.96, watts: 84, wear: 1.5,
  margin: 30, waste: 5, failure: 5, fee: 0, laborHourly: 0, minPrice: 0
});

export function calculate(settings, job) {
  const { rollPrice, rollGrams, tariff, watts, wear, margin, waste,
    failure, fee, laborHourly, minPrice } = { ...defaultSettings, ...settings };
  const { grams, hours, minutes, quantity, extras = 0, laborMinutes = 0, markup } = job;
  // A escolha de lucro no orçamento é acréscimo sobre o custo (markup).
  // O cálculo anterior por margem permanece para orçamentos legados.
  const usesMarkup = markup !== undefined;
  const values = [rollPrice, rollGrams, tariff, watts, wear, margin, waste,
    failure, fee, laborHourly, minPrice, grams, hours, minutes, quantity, extras, laborMinutes];
  if (usesMarkup) values.push(markup);

  if (values.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0) ||
      rollGrams <= 0 || grams <= 0 || !Number.isInteger(quantity) || quantity < 1 ||
      quantity > 100000 || !Number.isInteger(hours) || hours > 10000 ||
      !Number.isInteger(minutes) || minutes > 59 ||
      !Number.isInteger(laborMinutes) || laborMinutes > 100000 ||
      hours + minutes / 60 <= 0 || margin >= 100 || fee >= 100 ||
      (!usesMarkup && margin + fee >= 100) ||
      waste > 1000 || failure > 1000) {
    throw new Error('Confira peso, tempo, quantidade e custos. A soma da margem com as taxas deve ser menor que 100%.');
  }

  const duration = hours + minutes / 60;
  const filament = grams * (1 + waste / 100) * rollPrice / rollGrams;
  const energy = duration * watts / 1000 * tariff;
  const machine = duration * wear;
  const reserve = (filament + energy + machine) * failure / 100;
  const labor = laborMinutes / 60 * laborHourly;
  const cost = filament + energy + machine + reserve + labor + extras;
  const rawPrice = usesMarkup
    ? cost * (1 + markup / 100) / (1 - fee / 100)
    : cost / (1 - (margin + fee) / 100);
  // Arredonda para cima, nunca para baixo da margem pretendida.
  const price = Math.max(Math.ceil((rawPrice - 1e-9) * 100) / 100, minPrice);
  if (!Number.isFinite(price)) throw new Error('O percentual ou o custo informado é grande demais para calcular com segurança.');
  const fees = price * fee / 100;
  const profit = price - cost - fees;
  return {
    filament, energy, machine, reserve, labor, extras, fees, cost, price, profit,
    unit: price / quantity, actualMargin: price ? profit / price * 100 : 0, duration
  };
}

export function makerWorldModel(value) {
  const url = new URL(String(value).trim());
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['makerworld.com', 'www.makerworld.com'].includes(url.hostname)) {
    throw new Error('Use um link do MakerWorld.');
  }
  const model = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?models\/(\d+)(?:-([^/]+))?\/?$/i);
  if (!model) throw new Error('Não encontramos um modelo nesse endereço.');
  const slug = model[2] ? decodeURIComponent(model[2]).replace(/-+/g, ' ').trim() : '';
  return {
    url: url.href,
    title: slug ? slug[0].toUpperCase() + slug.slice(1) : 'Modelo ' + model[1]
  };
}
