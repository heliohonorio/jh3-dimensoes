import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, decimal, defaultSettings, makerWorldModel } from '../calc.mjs';

test('aceita valores brasileiros e rejeita entradas ambíguas', () => {
  assert.equal(decimal('90,50'), 90.5);
  assert.equal(decimal('1.234,56'), 1234.56);
  assert.equal(decimal('1.000'), 1);
  assert.ok(Number.isNaN(decimal('12abc')));
  assert.ok(Number.isNaN(decimal('')));
});
test('calcula filamento, energia, máquina e margem sobre a venda', () => {
  const out = calculate({ ...defaultSettings, waste: 0, failure: 0, fee: 0 },
    { grams: 100, hours: 2, minutes: 0, quantity: 2, extras: 0, laborMinutes: 0 });
  assert.equal(out.filament, 9);
  assert.equal(out.energy, 0.2);
  assert.equal(out.machine, 3);
  assert.equal(out.price, 17.43);
  assert.equal(out.unit, 8.715);
  assert.ok(out.actualMargin >= 30);
});
test('inclui desperdício, reserva, acabamento e taxas da venda', () => {
  const out = calculate({ ...defaultSettings, waste: 10, failure: 10, fee: 5, laborHourly: 20 },
    { grams: 100, hours: 1, minutes: 30, quantity: 1, extras: 4, laborMinutes: 30 });
  assert.ok(Math.abs(out.filament - 9.9) < 1e-8);
  assert.ok(Math.abs(out.energy - .15) < 1e-8);
  assert.ok(Math.abs(out.machine - 2.25) < 1e-8);
  assert.ok(Math.abs(out.reserve - 1.23) < 1e-8);
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
