/**
 * Robust date formatting utility for PostgreSQL DATE / TIMESTAMPTZ columns.
 * Prevents timezone shifting or string coercion issues (e.g. String(Date) containing Day/Month strings).
 */
export function formatDateOnly(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const s = String(d).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes('T')) return s.split('T')[0];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
}
