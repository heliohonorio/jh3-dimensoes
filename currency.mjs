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

export function installCurrencyMasks(root = document) {
  for (const input of root.querySelectorAll('input[data-currency]')) {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', () => {
      const previous = input.value;
      const formatted = maskCurrency(previous);
      if (formatted !== previous) input.value = formatted;
      // No teclado numérico do iPhone, manter o cursor no final evita
      // que o próximo dígito apareça antes da vírgula.
      try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    });
    input.addEventListener('beforeinput', event => {
      if (event.inputType !== 'deleteContentBackward' ||
          input.selectionStart !== input.value.length ||
          input.selectionEnd !== input.value.length) return;
      event.preventDefault();
      const digits = input.value.replace(/\D/g, '').replace(/^0+/, '');
      input.value = maskCurrency(digits.slice(0, -1));
      input.dispatchEvent(new Event('input', { bubbles: true }));
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
