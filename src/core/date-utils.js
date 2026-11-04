/**
 * Utilidades de fecha y hora consistentes en ISO 8601 para PAnA V2 AGUA
 */

/**
 * Retorna fecha y hora actual en ISO 8601
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * Retorna la fecha de hoy en formato local YYYY-MM-DD para campos <input type="date">
 */
export function todayDateInput() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna la hora actual en formato HH:mm para campos <input type="time">
 */
export function nowTimeInput() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * Formatea una fecha ISO o cadena a formato legible en español (DD/MM/AAAA)
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Formatea una fecha y hora a formato legible en español (DD/MM/AAAA HH:mm)
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Retorna la clave del día (YYYY-MM-DD)
 */
export function getDayKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna la clave del mes (YYYY-MM)
 */
export function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retorna el nombre del mes en español
 */
export function getMonthName(monthKey) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const parts = monthKey.split('-');
  const mIndex = parseInt(parts[1], 10) - 1;
  return `${months[mIndex] || parts[1]} ${parts[0]}`;
}

/**
 * Combina fecha (YYYY-MM-DD) y hora (HH:mm) en un string ISO 8601
 */
export function combineDateTimeToIso(dateStr, timeStr = '07:00') {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '07:00').split(':').map(Number);
  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return d.toISOString();
}
