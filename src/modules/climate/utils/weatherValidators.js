/**
 * Validadores para el módulo HIDROTERRA CLIMA
 * Garantiza integridad de coordenadas geográficas y respuestas de la API Open-Meteo
 */

import { WEATHER_CONFIG } from '../config/weatherConfig.js';
import { isWithinMontesDeMaria } from '../../../domain/rules/coordinates.rules.js';

/**
 * Convierte un valor a número finito o devuelve el valor por defecto
 */
export function safeNumber(val, fallback = null) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Valida que la latitud y longitud sean coordenadas geográficas reales y obligatorias
 */
export function validateWeatherCoordinates(lat, lon) {
  const nLat = safeNumber(lat, null);
  const nLon = safeNumber(lon, null);

  if (nLat === null || nLon === null) {
    return {
      valid: false,
      error: 'Debe especificar tanto la latitud como la longitud en grados decimales.'
    };
  }

  if (nLat < -90 || nLat > 90) {
    return {
      valid: false,
      error: `Latitud fuera de rango (${nLat}). Debe estar entre -90° y 90°.`
    };
  }

  if (nLon < -180 || nLon > 180) {
    return {
      valid: false,
      error: `Longitud fuera de rango (${nLon}). Debe estar entre -180° y 180°.`
    };
  }

  return {
    valid: true,
    latitude: Number(nLat.toFixed(6)),
    longitude: Number(nLon.toFixed(6)),
    isRegional: isWithinMontesDeMaria(nLat, nLon)
  };
}

/**
 * Genera una clave normalizada de coordenadas con precisión controlada (4 decimales ~11m)
 * para evitar solicitudes repetidas por variaciones insignificantes de GPS.
 */
export function normalizeCoordKey(lat, lon, decimals = WEATHER_CONFIG.api.coordinatePrecisionDecimals) {
  const check = validateWeatherCoordinates(lat, lon);
  if (!check.valid) return null;
  return `${check.latitude.toFixed(decimals)},${check.longitude.toFixed(decimals)}`;
}

/**
 * Valida la estructura JSON devuelta por Open-Meteo antes de procesarla o almacenarla
 */
export function validateOpenMeteoResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Respuesta vacía o formato JSON inválido del servicio meteorológico.' };
  }

  if (payload.error === true) {
    return {
      valid: false,
      error: payload.reason || 'El proveedor meteorológico reportó un error en la consulta.'
    };
  }

  if (typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') {
    return {
      valid: false,
      error: 'La respuesta meteorológica no incluye coordenadas válidas.'
    };
  }

  const hasCurrent = payload.current && typeof payload.current === 'object';
  const hasHourly = payload.hourly && Array.isArray(payload.hourly.time) && payload.hourly.time.length > 0;
  const hasDaily = payload.daily && Array.isArray(payload.daily.time) && payload.daily.time.length > 0;

  if (!hasCurrent && !hasHourly && !hasDaily) {
    return {
      valid: false,
      error: 'Sin cobertura de datos meteorológicos para la ubicación solicitada.'
    };
  }

  return { valid: true };
}

