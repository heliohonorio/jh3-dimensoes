import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, decimal, defaultSettings, makerWorldModel, parsePercentage, quoteBreakdown, setFinalQuotePrice } from '../calc.mjs';

test('aceita valores brasileiros e rejeita entradas ambíguas', () => {
  assert.equal(decimal('90,50'), 90.5);
  assert.equal(decimal('1.234,56'), 1234.56);
  assert.equal(decimal('1.000'), 1);
  assert.ok(Number.isNaN(decimal('12abc')));
  assert.ok(Number.isNaN(decimal('')));
  assert.equal(decimal('R$ 0,96'), 0.96);
  assert.equal(decimal('R$ 1.234,56'), 1234.56);
});
test('calcula filamento, energia, máquina e margem sobre a venda', () => {
  const out = calculate({ ...defaultSettings, waste: 0, failure: 0, fee: 0 },
    { grams: 100, hours: 2, minutes: 0, quantity: 2, extras: 0, laborMinutes: 0 });
  assert.equal(out.filament, 9);
  assert.equal(out.energy, 0.16128);
  assert.equal(out.machine, 3);
  assert.equal(out.price, 17.38);
  assert.equal(out.unit, 8.69);
  assert.ok(out.actualMargin >= 30);
});
test('inclui desperdício, reserva, acabamento e taxas da venda', () => {
  const out = calculate({ ...defaultSettings, waste: 10, failure: 10, fee: 5, laborHourly: 20 },
    { grams: 100, hours: 1, minutes: 30, quantity: 1, extras: 4, laborMinutes: 30 });
  assert.ok(Math.abs(out.filament - 9.9) < 1e-8);
  assert.ok(Math.abs(out.energy - .12096) < 1e-8);
  assert.ok(Math.abs(out.machine - 2.25) < 1e-8);
  assert.ok(Math.abs(out.reserve - 1.227096) < 1e-8);
  assert.ok(Math.abs(out.labor - 10) < 1e-8);
  assert.ok(out.profit > 0);
  assert.ok(out.actualMargin >= 30);
});
test('preço mínimo sobrepõe sugestão de margem', () => {
  const out = calculate({ ...defaultSettings, minPrice: 50 },
    { grams: 1, hours: 0, minutes: 1, quantity: 1 });
  assert.equal(out.price, 50);
});
test('não aceita quantidades fracionadas, horas inválidas nem taxa + margem >= 100', () => {
  const job = { grams: 30, hours: 1, minutes: 0, quantity: 1 };
  assert.throws(() => calculate(defaultSettings, { ...job, quantity: 1.2 }));
  assert.throws(() => calculate(defaultSettings, { ...job, hours: 0 }));
  assert.throws(() => calculate(defaultSettings, { ...job, minutes: 60 }));
  assert.throws(() => calculate({ ...defaultSettings, margin: 70, fee: 30 }, job));
});
test('extrai nome de link confiável sem acessar rede', () => {
  assert.equal(makerWorldModel('https://makerworld.com/pt/models/123-suporte-para-celular').title, 'Suporte para celular');
  assert.throws(() => makerWorldModel('https://makerworld.com.evil.test/models/123'));
});

test('usa tarifa real de referência e consumo médio da A1 Mini + AMS Lite', () => {
  assert.equal(defaultSettings.tariff, 0.96);
  assert.equal(defaultSettings.watts, 84);
  const print = calculate({ ...defaultSettings, wear: 0, waste: 0, failure: 0, margin: 0 },
    { grams: 1, hours: 10, minutes: 0, quantity: 1 });
  assert.ok(Math.abs(print.energy - 0.8064) < 1e-8);
});


test('lucro de 100% e 150% é acréscimo sobre o custo, não margem de venda', () => {
  const settings = {
    ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0, fee: 0
  };
  const job = { grams: 100, quantity: 1, hours: 1, minutes: 0, extras: 0, laborMinutes: 0 };
  const double = calculate(settings, { ...job, markup: 100 });
  const twoAndHalf = calculate(settings, { ...job, markup: 150 });
  assert.equal(double.cost, 10);
  assert.equal(double.price, 20);
  assert.equal(double.profit, 10);
  assert.equal(twoAndHalf.price, 25);
  assert.equal(twoAndHalf.profit, 15);
});
test('markup soma somente custo e lucro, mesmo com taxa antiga salva', () => {
  const settings = { ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, failure: 0, waste: 0, fee: 10 };
  const result = calculate(settings, { grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 75 });
  assert.equal(result.price, 17.5);
  assert.ok(result.profit >= 7.5);
  assert.ok(calculate(settings, { grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 1001 }).price > 100);
});


test('lucro personalizado sem teto de 1.000%: preço calculado sobre custo', () => {
  const settings = {
    ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0,
    fee: 0, minPrice: 0, laborHourly: 0
  };
  const job = { grams: 100, quantity: 1, hours: 1, minutes: 0, extras: 0, laborMinutes: 0 };
  for (const [percent, price, profit] of [
    [25, 12.5, 2.5], [50, 15, 5], [75, 17.5, 7.5],
    [100, 20, 10], [150, 25, 15],
    [1000, 110, 100], [2500, 260, 250],
    [10000, 1010, 1000], [100000, 10010, 10000]
  ]) {
    const result = calculate(settings, { ...job, markup: percent });
    assert.equal(result.cost, 10);
    assert.equal(result.price, price, 'preço com ' + percent + '%');
    assert.equal(result.profit, profit, 'lucro com ' + percent + '%');
  }
});

test('lucro acima de 1.000% usa apenas o acréscimo escolhido', () => {
  const settings = {
    ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0,
    fee: 10, minPrice: 0, laborHourly: 0
  };
  const result = calculate(settings, {
    grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 2500
  });
  assert.equal(result.price, 260);
  assert.ok(result.profit >= 250);
});

test('interpreta porcentagens grandes no formato brasileiro', () => {
  assert.equal(parsePercentage('1.000'), 1000);
  assert.equal(parsePercentage('1.000%'), 1000);
  assert.equal(parsePercentage('2.500,50'), 2500.5);
  assert.equal(parsePercentage('2500.5'), 2500.5);
  assert.equal(parsePercentage('100000'), 100000);
  assert.equal(parsePercentage('0'), 0);
  assert.ok(Number.isNaN(parsePercentage('-1')));
  assert.ok(Number.isNaN(parsePercentage('')));
  assert.ok(Number.isNaN(parsePercentage('2abc')));
  assert.throws(() => calculate(defaultSettings, {
    grams: 100, quantity: 1, hours: 1, minutes: 0, markup: Infinity
  }));
});


test('mesmos dados mantêm custo fixo ao trocar de 50% para 100%', () => {
  const settings = {
    ...defaultSettings, rollPrice: 1000, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0,
    laborHourly: 0, minPrice: 0, fee: 0
  };
  const job = { grams: 27.28, quantity: 3, hours: 1, minutes: 0 };
  const half = calculate(settings, { ...job, markup: 50 });
  const double = calculate(settings, { ...job, markup: 100 });
  assert.equal(half.cost, 27.27);
  assert.equal(double.cost, 27.27);
  assert.equal(half.profit, 13.65);
  assert.equal(double.profit, 27.27);
  assert.equal(half.price, 40.92);
  assert.equal(double.price, 54.54);
  assert.equal(double.unit, 18.18);
});

test('taxas de venda não alteram o custo de produção quando lucro muda', () => {
  const settings = {
    ...defaultSettings, rollPrice: 1000, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0,
    laborHourly: 0, minPrice: 0, fee: 10
  };
  const job = { grams: 27.28, quantity: 3, hours: 1, minutes: 0 };
  const half = calculate(settings, { ...job, markup: 50 });
  const double = calculate(settings, { ...job, markup: 100 });
  assert.equal(half.cost, double.cost);
  assert.equal(double.fees, 0);
  assert.equal(half.fees, 0);
  assert.ok(double.price > half.price, 'preço de venda cresce com lucro');
});


test('apresenta custo, lucro e total separados para três peças', () => {
  const settings = {
    ...defaultSettings, rollPrice: 1000, rollGrams: 1000, tariff: 0,
    watts: 0, wear: 0, waste: 0, failure: 0,
    laborHourly: 0, minPrice: 0, fee: 0
  };
  const job = { grams: 27.28, quantity: 3, hours: 1, minutes: 0 };
  for (const [markup, expectedTotal, expectedProfit] of [
    [50, 40.92, 13.65],
    [100, 54.54, 27.27]
  ]) {
    const result = calculate(settings, { ...job, markup });
    const amounts = quoteBreakdown(result, 3);
    assert.equal(amounts.cost, 27.27);
    assert.equal(amounts.profit, expectedProfit);
    assert.equal(amounts.price, expectedTotal);
    assert.equal(Math.round((amounts.cost + amounts.profit + amounts.fees) * 100), Math.round(expectedTotal * 100));
    assert.equal(amounts.roundedPerPiece, false);
    assert.ok(Math.abs(amounts.costPerPiece - 27.27 / 3) < 1e-10);
  }
});

test('o preço exibido soma custo, lucro e taxas exatamente em centavos', () => {
  const settings = {
    ...defaultSettings, rollPrice: 129.9, rollGrams: 1000, tariff: 0.96,
    watts: 84, wear: 1.5, waste: 5, failure: 5,
    laborHourly: 0, minPrice: 0, fee: 7.9
  };
  for (const quantity of [1, 2, 3, 7, 12]) {
    for (const markup of [25, 50, 100, 150, 1000]) {
      const result = calculate(settings, {
        grams: 91.6, hours: 3, minutes: 27, quantity, markup
      });
      const amounts = quoteBreakdown(result, quantity);
      const actualSumCents = Math.round(amounts.cost * 100) +
        Math.round(amounts.profit * 100) +
        Math.round(amounts.fees * 100);
      assert.equal(actualSumCents, Math.round(amounts.price * 100));
      assert.ok(Math.abs(amounts.pricePerPiece * quantity - amounts.price) < 1e-8);
    }
  }
});

test('preço mínimo antigo não altera custo mais lucro escolhido', () => {
  const settings = {
    ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, failure: 0, waste: 0,
    fee: 0, minPrice: 30
  };
  const result = calculate(settings, {
    grams: 50, quantity: 2, hours: 1, minutes: 0, markup: 25
  });
  const summary = quoteBreakdown(result, 2);
  assert.equal(summary.cost, 5);
  assert.equal(summary.profit, 1.26);
  assert.equal(summary.price, 6.26);
});

test('caso da imagem fecha duas peças em R$ 12,18 com lucro de 50%', () => {
  const settings = { ...defaultSettings, rollPrice: 1000, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0 };
  const result = calculate(settings, { grams: 8.11, quantity: 2, hours: 1, minutes: 0, markup: 50 });
  const view = quoteBreakdown(result, 2);
  assert.equal(view.costPerPiece, 4.06);
  assert.equal(view.profitPerPiece, 2.03);
  assert.equal(view.pricePerPiece, 6.09);
  assert.equal(view.cost, 8.12);
  assert.equal(view.profit, 4.06);
  assert.equal(view.price, 12.18);
});


test('arredonda preço final livremente sem mexer no custo de produção', () => {
  const settings = { ...defaultSettings, rollPrice: 1000, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0, fee: 0,
    laborHourly: 0, minPrice: 0 };
  const original = { ...calculate(settings, {
    grams: 27.28, quantity: 3, hours: 1, minutes: 0, markup: 50
  }), name: 'Projeto Teste', quantity: 3 };
  assert.equal(original.price, 40.92);
  const roundedUp = setFinalQuotePrice(original, 43);
  const roundedDown = setFinalQuotePrice(original, 42);
  assert.equal(roundedUp.cost, original.cost);
  assert.equal(roundedDown.cost, original.cost);
  assert.equal(roundedUp.price, 43);
  assert.equal(roundedDown.price, 42);
  assert.equal(roundedUp.profit, 15.73);
  assert.equal(roundedDown.profit, 14.73);
  assert.equal(roundedUp.quantity, original.quantity);
  assert.equal(roundedUp.name, original.name);
  assert.equal(roundedUp.priceEdited, true);
  assert.equal(original.priceEdited, undefined, 'o cálculo original não é alterado');
  for (const item of [roundedUp, roundedDown]) {
    const breakdown = quoteBreakdown(item, 3);
    assert.equal(Math.round((breakdown.cost + breakdown.profit + breakdown.fees) * 100),
      Math.round(item.price * 100));
    assert.equal(breakdown.roundedPerPiece, item.price === 43,
      'a média só é arredondada quando não fecha em centavos por peça');
  }
});

test('valor livre pode ficar abaixo do custo e mostra prejuízo corretamente', () => {
  const quote = { name: 'Teste', quantity: 1, cost: 10, price: 20, profit: 10, fees: 0, unit: 20 };
  const discounted = setFinalQuotePrice(quote, 8);
  assert.equal(discounted.cost, 10);
  assert.equal(discounted.price, 8);
  assert.equal(discounted.profit, -2);
  assert.equal(discounted.unit, 8);
  assert.equal(setFinalQuotePrice(quote, 0).profit, -10);
  assert.throws(() => setFinalQuotePrice(quote, -1), /preço final válido/);
  assert.throws(() => setFinalQuotePrice(quote, NaN), /preço final válido/);
  assert.throws(() => setFinalQuotePrice(quote, Number.MAX_VALUE), /alto/);
});
