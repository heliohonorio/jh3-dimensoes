import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, maskCurrency } from '../currency.mjs';

test('formata valores de reais com vírgula decimal', () => {
  assert.equal(formatCurrency(0.96), 'R$ 0,96');
  assert.equal(formatCurrency(90), 'R$ 90,00');
  assert.equal(formatCurrency(1234.56), 'R$ 1.234,56');
  assert.equal(formatCurrency(0), 'R$ 0,00');
});

test('insere duas casas decimais enquanto digita', () => {
  assert.equal(maskCurrency(''), '');
  assert.equal(maskCurrency('1'), 'R$ 0,01');
  assert.equal(maskCurrency('12'), 'R$ 0,12');
  assert.equal(maskCurrency('123'), 'R$ 1,23');
  assert.equal(maskCurrency('1234'), 'R$ 12,34');
  assert.equal(maskCurrency('123456'), 'R$ 1.234,56');
  assert.equal(maskCurrency('R$ 12,34'), 'R$ 12,34');
});
