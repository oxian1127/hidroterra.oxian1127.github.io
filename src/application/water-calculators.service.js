/**
 * Servicio de Aplicación: Herramientas y Calculadoras Hídricas (WaterCalculatorsService)
 * Integra las 4 calculadoras técnicas con datos reales registrados en HIDROTERRA (pluviómetros, clima y fuentes).
 */

import {
  ROOF_SURFACE_TYPES,
  calculateRainwaterHarvesting,
  calculateStorageCapacity,
  calculateSimplifiedWaterBalance,
  calculateWaterAutonomy
} from '../domain/rules/water-calculators.rules.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../infrastructure/database/repositories/water-measurement.repository.js';
import { weatherCache } from '../modules/climate/services/weatherCache.js';
import { calculatePeriodTotal } from '../domain/rules/rainfall.rules.js';
import { getMonthKey } from '../core/date-utils.js';

export class WaterCalculatorsService {
  static getSurfaceTypes() {
    return ROOF_SURFACE_TYPES;
  }

  static runRainwaterHarvesting(params) {
    return calculateRainwaterHarvesting(params);
  }

  static runStorageCalculator(params) {
    return calculateStorageCapacity(params);
  }

  static runWaterBalance(params) {
    return calculateSimplifiedWaterBalance(params);
  }

  static runWaterAutonomy(params) {
    return calculateWaterAutonomy(params);
  }

  /**
   * Obtiene opciones reales de precipitación registrada en pluviómetros y pronósticos en caché
   * para prellenar las calculadoras sin mezclar mediciones reales con pronósticos.
   */
  static async getContextualPresets() {
    const [pluviometers, rainfallRecords, sources, measurements, cachedWeather] = await Promise.all([
      pluviometerRepository.getAll(),
      rainfallRepository.getAll(),
      waterSourceRepository.getAll(),
      waterMeasurementRepository.getAll(),
      weatherCache.getAllCached()
    ]);

    const currentMonth = getMonthKey(new Date().toISOString());

    // 1. Opciones de lluvia observada (pluviómetros reales)
    const observedRainfallOptions = [];
    pluviometers.forEach(pluv => {
      const pluvRecords = rainfallRecords
        .filter(r => r.pluviometerId === pluv.id)
        .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

      if (pluvRecords.length > 0) {
        const lastRec = pluvRecords[0];
        observedRainfallOptions.push({
          id: `obs_last_${pluv.id}`,
          label: `[Observada - Última lectura] ${pluv.code} (${pluv.name}): ${lastRec.precipitationMm} mm (${lastRec.measuredAt.slice(0, 10)})`,
          precipitationMm: Number(lastRec.precipitationMm),
          periodLabel: `Última lectura ${pluv.code} (${lastRec.measuredAt.slice(0, 10)})`,
          isForecast: false
        });

        const totalStats = calculatePeriodTotal(pluvRecords);
        observedRainfallOptions.push({
          id: `obs_total_${pluv.id}`,
          label: `[Observada - Acumulado total] ${pluv.code} (${pluv.name}): ${totalStats.totalMm} mm (${pluvRecords.length} lecturas)`,
          precipitationMm: Number(totalStats.totalMm),
          periodLabel: `Acumulado histórico ${pluv.code}`,
          isForecast: false
        });

        const monthRecs = pluvRecords.filter(r => getMonthKey(r.measuredAt) === currentMonth);
        if (monthRecs.length > 0) {
          const monthStats = calculatePeriodTotal(monthRecs);
          observedRainfallOptions.push({
            id: `obs_month_${pluv.id}`,
            label: `[Observada - Mes actual] ${pluv.code}: ${monthStats.totalMm} mm`,
            precipitationMm: Number(monthStats.totalMm),
            periodLabel: `Acumulado mes ${currentMonth} (${pluv.code})`,
            isForecast: false
          });
        }
      }
    });

    // 2. Opciones de lluvia pronosticada desde caché meteorológica Open-Meteo
    const forecastRainfallOptions = [];
    cachedWeather.forEach(entry => {
      const days = entry?.daily?.days || [];
      if (days.length > 0) {
        const sum7d = Number(days.reduce((acc, d) => acc + (Number(d.precipitationSumMm) || 0), 0).toFixed(1));
        const locName = entry.location?.name || entry.coordKey;
        forecastRainfallOptions.push({
          id: `fcst_7d_${entry.coordKey}`,
          label: `[Pronóstico 7 días Open-Meteo] ${locName}: ${sum7d} mm`,
          precipitationMm: sum7d,
          periodLabel: `Pronóstico 7 días (${locName})`,
          isForecast: true
        });
      }
    });

    // 3. Fuentes hídricas con capacidad o mediciones para prellenar almacenamiento y autonomía
    const measBySource = new Map();
    measurements.forEach(m => {
      if (!measBySource.has(m.sourceId)) measBySource.set(m.sourceId, []);
      measBySource.get(m.sourceId).push(m);
    });

    const sourceStoragePresets = sources
      .filter(s => s.active !== false)
      .map(s => {
        const list = (measBySource.get(s.id) || []).sort(
          (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
        );
        const latest = list[0] || null;
        const availableLiters = latest
          ? (latest.observedVolumeLiters ?? latest.estimatedVolumeLiters ?? null)
          : null;

        return {
          id: s.id,
          code: s.code,
          name: s.name,
          type: s.type,
          knownCapacityLiters: s.knownCapacityLiters ?? (latest ? latest.knownCapacityLiters : null),
          referenceDepthMeters: s.referenceDepthMeters ?? (latest ? latest.totalDepthMeters : null),
          latestWaterLevel: latest ? latest.waterLevel : null,
          latestUnit: latest ? latest.unit : 'm',
          availableVolumeLiters: availableLiters
        };
      });

    return {
      observedRainfallOptions,
      forecastRainfallOptions,
      sourceStoragePresets
    };
  }
}

