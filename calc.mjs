export function decimal(value) {
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return NaN;
  return Number(raw.replace(',', '.'));
}

export function calculate(settings, job) {
  const { rollPrice, rollGrams, tariff, watts, wear, margin } = settings;
  const { grams, hours, minutes, quantity, extras } = job;
  const numbers = [rollPrice, rollGrams, tariff, watts, wear, margin, grams, hours, minutes, quantity, extras];
  if (numbers.some(number => !Number.isFinite(number) || number < 0)
      || !rollGrams || !grams || !Number.isInteger(quantity) || quantity < 1
      || !Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59
      || margin >= 100 || hours + minutes <= 0) {
    throw new Error('Confira o peso, o tempo, a quantidade e os valores das configurações.');
  }
  const duration = hours + minutes / 60;
  const filament = grams * rollPrice / rollGrams;
  const energy = duration * watts / 1000 * tariff;
  const machine = duration * wear;
  const cost = filament + energy + machine + extras;
  const price = Math.round(cost / (1 - margin / 100) * 100) / 100;
  if (!Number.isFinite(price)) throw new Error('O valor calculado ficou fora do intervalo permitido.');
  return { filament, energy, machine, extras, cost, price, profit: price - cost, unit: price / quantity };
}

export function makerWorldModel(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.port || url.username || url.password
      || !['makerworld.com', 'www.makerworld.com'].includes(url.hostname)) {
    throw new Error('Use um link de modelo do site MakerWorld.');
  }
  const model = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?models\/(\d+)(?:-([^/]+))?\/?$/i);
  if (!model) throw new Error('Abra a página do modelo no MakerWorld e copie o endereço completo.');
  const slug = model[2] ? decodeURIComponent(model[2]).replace(/-+/g, ' ').trim() : '';
  return { url: url.href, title: slug ? slug[0].toUpperCase() + slug.slice(1) : 'Modelo ' + model[1] };
}
