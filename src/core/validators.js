/**
 * Validadores y utilidades de integridad de datos para PAnA V2 AGUA
 */

/**
 * Genera un identificador universal único (UUID v4) seguro o compatible
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback estándar RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escapa cadenas para prevenir inyecciones HTML en el DOM
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Valida si un valor no está vacío (no nulo, no indefinido, no cadena en blanco)
 */
export function isRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Valida si una fecha en formato ISO o YYYY-MM-DD es válida
 */
export function isValidDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Valida si una fecha no es futura (para mediciones históricas o actuales)
 */
export function isNotFutureDate(dateStr, marginMinutes = 15) {
  if (!isValidDate(dateStr)) return false;
  const target = new Date(dateStr).getTime();
  const nowWithMargin = Date.now() + (marginMinutes * 60 * 1000);
  return target <= nowWithMargin;
}

/**
 * Valida latitud en grados decimales (-90 a 90)
 */
export function isValidLatitude(lat) {
  if (lat === null || lat === undefined || lat === '') return true; // Si es opcional
  const n = Number(lat);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

/**
 * Valida longitud en grados decimales (-180 a 180)
 */
export function isValidLongitude(lon) {
  if (lon === null || lon === undefined || lon === '') return true; // Si es opcional
  const n = Number(lon);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * Valida si un valor de precipitación en mm es válido (finito y >= 0)
 */
export function isValidPrecipitation(mm) {
  if (mm === null || mm === undefined || mm === '') return false;
  const n = Number(mm);
  return Number.isFinite(n) && n >= 0;
}

/**
 * Valida código alfanumérico limpio
 */
export function isValidCode(code) {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  return trimmed.length >= 2 && trimmed.length <= 40;
}
