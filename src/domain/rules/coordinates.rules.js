/**
 * Reglas de validación y verificación de coordenadas geográficas
 */

import { APP_CONFIG } from '../../config/app.config.js';
import { ThemeService } from '../../core/theme.js';

export function isWithinMontesDeMaria(lat, lon) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) return null;
  const { minLat, maxLat, minLon, maxLon } = APP_CONFIG.geo.boundsMontesDeMaria;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

function toDmsString(decimalDeg, posHemisphere, negHemisphere) {
  const abs = Math.abs(Number(decimalDeg));
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const hem = Number(decimalDeg) >= 0 ? posHemisphere : negHemisphere;
  return `${deg}° ${String(min).padStart(2, '0')}' ${String(sec).padStart(4, '0')}" ${hem}`;
}

export function formatCoordinates(lat, lon, decimals = 5) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) {
    return 'Sin georreferenciar';
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return 'Coordenadas no válidas';

  if (ThemeService.getCoordinateFormat() === 'dms') {
    return `${toDmsString(nLat, 'N', 'S')}, ${toDmsString(nLon, 'E', 'O')}`;
  }

  const latStr = `${Math.abs(nLat).toFixed(decimals)}° ${nLat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(nLon).toFixed(decimals)}° ${nLon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr} (${nLat.toFixed(decimals)}, ${nLon.toFixed(decimals)})`;
}
