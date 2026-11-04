/**
 * Formateadores de datos meteorológicos y agroclimáticos para HIDROTERRA CLIMA
 */

import { WMO_WEATHER_CODES } from '../config/weatherConfig.js';
import { safeNumber } from './weatherValidators.js';

/**
 * Obtiene la descripción, ícono FontAwesome y color para un código WMO
 */
export function getWeatherCondition(wmoCode, isDay = 1) {
  const code = safeNumber(wmoCode, null);
  const entry = code !== null ? WMO_WEATHER_CODES[code] : null;

  if (!entry) {
    return {
      code: code !== null ? code : -1,
      label: 'Condición variable',
      icon: isDay ? 'fa-cloud-sun' : 'fa-cloud-moon',
      category: 'cloudy',
      color: '#0284c7'
    };
  }

  return {
    code,
    label: entry.label,
    icon: isDay ? entry.iconDay : entry.iconNight,
    category: entry.category,
    color: entry.color
  };
}

/**
 * Convierte dirección del viento en grados (0-360°) a punto cardinal en español
 */
export function formatWindDirection(degrees) {
  const deg = safeNumber(degrees, null);
  if (deg === null) return '—';
  const normalizedDeg = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(normalizedDeg / 45) % 8;
  return `${directions[index]} (${Math.round(normalizedDeg)}°)`;
}

/**
 * Formatea temperatura en grados Celsius
 */
export function formatTemp(value, decimals = 1) {
  const n = safeNumber(value, null);
  if (n === null) return '—';
  return `${n.toFixed(decimals)} °C`;
}

/**
 * Formatea precipitación en milímetros
 */
export function formatMm(value, decimals = 1) {
  const n = safeNumber(value, null);
  if (n === null) return '—';
  return `${n.toFixed(decimals)} mm`;
}

/**
 * Formatea porcentaje (humedad, nubosidad, probabilidad de lluvia)
 */
export function formatPercent(value) {
  const n = safeNumber(value, null);
  if (n === null) return '—';
  return `${Math.round(n)}%`;
}

/**
 * Formatea velocidad del viento en km/h
 */
export function formatWindSpeed(value) {
  const n = safeNumber(value, null);
  if (n === null) return '—';
  return `${n.toFixed(1)} km/h`;
}

/**
 * Formatea presión atmosférica superficial en hPa
 */
export function formatPressure(value) {
  const n = safeNumber(value, null);
  if (n === null) return '—';
  return `${Math.round(n)} hPa`;
}

/**
 * Formatea humedad volumétrica del suelo (m³/m³ y porcentaje volumétrico equivalente)
 */
export function formatSoilMoisture(valueM3) {
  const n = safeNumber(valueM3, null);
  if (n === null) return 'No disponible en este modelo';
  const pct = (n * 100).toFixed(1);
  return `${pct}% vol. (${n.toFixed(3)} m³/m³)`;
}

/**
 * Formatea una cadena de hora ISO ("YYYY-MM-DDTHH:mm") a formato corto "HH:mm"
 */
export function formatHourLabel(isoTimeStr) {
  if (!isoTimeStr || typeof isoTimeStr !== 'string') return '—';
  const parts = isoTimeStr.split('T');
  if (parts.length === 2) {
    return parts[1].slice(0, 5);
  }
  return isoTimeStr;
}

/**
 * Formatea una fecha diaria "YYYY-MM-DD" a etiqueta legible ("Lun 04 Nov")
 */
export function formatDayNameShort(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[dateObj.getDay()]} ${String(d).padStart(2, '0')} ${months[dateObj.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formatea una fecha diaria "YYYY-MM-DD" con nombre completo del día
 */
export function formatDayNameFull(dateStr, index = -1) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const prefix = index === 0 ? 'Hoy — ' : index === 1 ? 'Mañana — ' : '';
    return `${prefix}${days[dateObj.getDay()]} ${d} de ${months[dateObj.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

