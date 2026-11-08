// Formatação dos campos em reais. Não altera o formato de pesos, horas nem porcentagens.
const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
});

export function formatCurrency(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? reais.format(number) : '';
}

export function maskCurrency(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 13);
  if (!digits) return '';
  return formatCurrency(Number(digits) / 100);
}

function digitsBefore(text, caret) {
  return (text.slice(0, caret).match(/\d/g) || []).length;
}

function caretAfterDigits(text, count) {
  if (count <= 0) return Math.max(0, text.indexOf('$') + 2);
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]) && ++seen >= count) return i + 1;
  }
  return text.length;
}

export function installCurrencyMasks(root = document) {
  for (const input of root.querySelectorAll('input[data-currency]')) {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', () => {
      const previous = input.value;
      const cursor = input.selectionStart ?? previous.length;
      const count = digitsBefore(previous, cursor);
      const formatted = maskCurrency(previous);
      if (formatted !== previous) {
        input.value = formatted;
        const position = caretAfterDigits(formatted, count);
        try { input.setSelectionRange(position, position); } catch {}
      }
    });
    input.addEventListener('paste', event => {
      const pasted = event.clipboardData?.getData('text')?.trim();
      if (!pasted) return;
      const normalized = pasted.replace(/^R\$\s*/i, '').replace(/\s+/g, '');
      let parsed = NaN;
      if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(normalized)) {
        parsed = Number(normalized.replace(/\./g, '').replace(',', '.'));
      } else if (/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) {
        parsed = Number(normalized.replace(',', '.'));
      }
      if (!Number.isFinite(parsed) || parsed < 0) return;
      event.preventDefault();
      input.value = formatCurrency(parsed);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}
