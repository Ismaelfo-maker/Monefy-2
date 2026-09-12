export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function formatDateTime(isoDateTime: string): string {
  if (!isoDateTime) return '';
  try {
    const d = new Date(isoDateTime);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoDateTime;
  }
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
