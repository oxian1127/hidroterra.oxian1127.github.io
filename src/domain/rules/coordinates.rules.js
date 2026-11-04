/**
 * Reglas de validación y verificación de coordenadas geográficas
 */

import { APP_CONFIG } from '../../config/app.config.js';

export function isWithinMontesDeMaria(lat, lon) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) return null;
  const { minLat, maxLat, minLon, maxLon } = APP_CONFIG.geo.boundsMontesDeMaria;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

export function formatCoordinates(lat, lon, decimals = 5) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) {
    return 'Sin georreferenciar';
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return 'Coordenadas no válidas';
  const latStr = `${Math.abs(nLat).toFixed(decimals)}° ${nLat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(nLon).toFixed(decimals)}° ${nLon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr} (${nLat.toFixed(decimals)}, ${nLon.toFixed(decimals)})`;
}
