import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, decimal, defaultSettings, makerWorldModel } from '../calc.mjs';

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
  assert.throws(() => calculate(settings, { grams: 100, quantity: 1, hours: 1, minutes: 0, markup: 1001 }));
});
