/**
 * Servicio de Aplicación: Tablero de Control (Dashboard Service)
 * Calcula métricas, acumulados reales y estados del sistema sin inventar datos
 */

import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import { calculateDailyAccumulations, calculatePeriodTotal } from '../domain/rules/rainfall.rules.js';
import { APP_CONFIG } from '../config/app.config.js';
import { getDayKey, getMonthKey } from '../core/date-utils.js';

export class DashboardService {
  /**
   * Obtiene todos los indicadores clave calculados a partir de datos reales
   */
  static async getSummaryMetrics() {
    const [
      sources,
      pluviometers,
      rainfallRecords,
      sites,
      parcels,
      observations
    ] = await Promise.all([
      waterSourceRepository.getAll(),
      pluviometerRepository.getAll(),
      rainfallRepository.getAll(),
      siteRepository.getAll(),
      parcelRepository.getAll(),
      observationRepository.getAll()
    ]);

    const activePluviometers = pluviometers.filter(p => p.status === 'activo').length;
    const activeWaterSources = sources.filter(s => s.active !== false).length;

    // Calcular acumulado del mes en curso
    const currentMonth = getMonthKey(new Date().toISOString());
    const currentMonthRecords = rainfallRecords.filter(r => getMonthKey(r.measuredAt) === currentMonth);
    const monthTotals = calculatePeriodTotal(currentMonthRecords);

    // Determinar última fecha de registro de cualquier entidad
    let lastRecordDate = null;
    const allRecords = [
      ...sources.map(s => s.updatedAt || s.createdAt),
      ...pluviometers.map(p => p.updatedAt || p.createdAt),
      ...rainfallRecords.map(r => r.createdAt || r.measuredAt),
      ...sites.map(s => s.updatedAt || s.createdAt),
      ...parcels.map(p => p.updatedAt || p.createdAt),
      ...observations.map(o => o.updatedAt || o.createdAt)
    ].filter(Boolean);

    if (allRecords.length > 0) {
      allRecords.sort((a, b) => new Date(b) - new Date(a));
      lastRecordDate = allRecords[0];
    }

    // Estado del respaldo
    let lastBackupDate = null;
    let daysSinceBackup = null;
    let backupWarning = false;
    try {
      const stored = localStorage.getItem(APP_CONFIG.storage.lastBackupKey);
      if (stored) {
        lastBackupDate = stored;
        const diffMs = Date.now() - new Date(stored).getTime();
        daysSinceBackup = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (daysSinceBackup >= APP_CONFIG.storage.backupWarningDays) {
          backupWarning = true;
        }
      } else if (allRecords.length > 0) {
        // Hay registros pero nunca se ha realizado un respaldo
        backupWarning = true;
      }
    } catch {
      // Ignorar fallback de localStorage
    }

    // Datos para gráfico diario reciente (últimos 30 días con registros)
    const dailyAccumulated = calculateDailyAccumulations(rainfallRecords);
    const sortedDays = Object.keys(dailyAccumulated).sort().slice(-30);
    const chartData = {
      labels: sortedDays,
      datasets: [
        {
          label: 'Lluvia diaria (mm)',
          data: sortedDays.map(day => dailyAccumulated[day].totalMm),
          backgroundColor: '#0077b6',
          borderColor: '#023e8a',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    };

    // Últimas actividades
    const recentRain = await rainfallRepository.getRecent(5);

    return {
      counts: {
        totalSources: sources.length,
        activeSources: activeWaterSources,
        totalPluviometers: pluviometers.length,
        activePluviometers,
        rainfallRecordsCount: rainfallRecords.length,
        monthAccumulatedMm: monthTotals.totalMm,
        monthMeasuredDays: monthTotals.measuredDaysCount,
        sitesCount: sites.length,
        parcelsCount: parcels.length,
        observationsCount: observations.length
      },
      lastRecordDate,
      backupStatus: {
        lastBackupDate,
        daysSinceBackup,
        backupWarning
      },
      chartData,
      recentRain,
      sources,
      pluviometers,
      sites,
      parcels
    };
  }
}
