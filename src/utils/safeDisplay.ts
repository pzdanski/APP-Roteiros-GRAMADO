/**
 * Safe display helpers to prevent undefined, null, NaN, or [object Object] leaks in UI
 */

export function isValidCount(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0;
}

export function safeNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
    return val;
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function safeText(val: unknown, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    if (val === 'undefined' || val === 'null' || val === 'NaN' || val === '[object Object]') {
      return fallback;
    }
    return val;
  }
  if (typeof val === 'number') {
    if (isNaN(val)) return fallback;
    return val.toString();
  }
  return fallback;
}

export function formatSafeBrl(val: unknown, fallback: string = 'R$ 0'): string {
  const num = safeNumber(val, -1);
  if (num < 0) return fallback;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
