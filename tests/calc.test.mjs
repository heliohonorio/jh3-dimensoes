import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, decimal, defaultSettings, makerWorldModel, parsePercentage } from '../calc.mjs';

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
test('markup personalizado preserva lucro planejado após taxas', () => {
  const settings = { ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, failure: 0, waste: 0, fee: 10 };
  const result = calculate(settings, { grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 75 });
  assert.equal(result.price, 19.45);
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

test('lucro acima de 1.000% com taxa continua preservando o acréscimo', () => {
  const settings = {
    ...defaultSettings, rollPrice: 100, rollGrams: 1000,
    tariff: 0, watts: 0, wear: 0, waste: 0, failure: 0,
    fee: 10, minPrice: 0, laborHourly: 0
  };
  const result = calculate(settings, {
    grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 2500
  });
  assert.equal(result.price, 288.89);
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
  assert.equal(half.cost, 27.28);
  assert.equal(double.cost, 27.28);
  assert.equal(half.profit, 13.64);
  assert.equal(double.profit, 27.28);
  assert.equal(half.price, 40.92);
  assert.equal(double.price, 54.56);
  // O unitário é a média exata: arredondar 18,1866 para 18,19
  // pode gerar diferença de um centavo se multiplicado por três.
  assert.ok(Math.abs(double.unit - 54.56 / 3) < 1e-9);
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
  assert.ok(double.fees > half.fees, 'taxa de venda cresce com o preço');
  assert.ok(double.price > half.price, 'preço de venda cresce com lucro');
});
