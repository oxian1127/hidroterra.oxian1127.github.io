/**
 * Servicio de Aplicación: Tablero de Control (Dashboard Service — Sección 8)
 * Calcula métricas, disponibilidad hídrica, acumulados reales, alertas y estados del sistema sin inventar datos.
 */

import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../infrastructure/database/repositories/water-measurement.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import { WaterAvailabilityService } from './water-availability.service.js';
import { WaterAlertsService } from './water-alerts.service.js';
import { calculateDailyAccumulations, calculatePeriodTotal } from '../domain/rules/rainfall.rules.js';
import { APP_CONFIG } from '../config/app.config.js';
import { getMonthKey, formatDate } from '../core/date-utils.js';

export class DashboardService {
  /**
   * Obtiene todos los indicadores clave calculados a partir de datos reales
   */
  static async getSummaryMetrics() {
    const [
      sourcesOverview,
      waterMeasurements,
      pluviometers,
      rainfallRecords,
      sites,
      parcels,
      observations,
      activeAlerts
    ] = await Promise.all([
      WaterAvailabilityService.getSourcesAvailabilityOverview(),
      waterMeasurementRepository.getAll(),
      pluviometerRepository.getAll(),
      rainfallRepository.getAll(),
      siteRepository.getAll(),
      parcelRepository.getAll(),
      observationRepository.getAll(),
      WaterAlertsService.evaluateAndGetAlerts({ status: 'activa' })
    ]);

    const activePluviometers = pluviometers.filter(p => p.status === 'activo').length;
    const activeWaterSources = sourcesOverview.filter(s => s.active !== false).length;

    // Indicadores de disponibilidad hídrica basados en datos reales
    const sourcesWithMeasurements = sourcesOverview.filter(s => s.measurementsCount > 0).length;
    const highAvailabilitySources = sourcesOverview.filter(s => s.availabilityStatus === 'alta').length;
    const modAvailabilitySources = sourcesOverview.filter(s => s.availabilityStatus === 'moderada').length;
    const lowOrCriticalSources = sourcesOverview.filter(
      s => s.availabilityStatus === 'baja' || s.availabilityStatus === 'critica'
    ).length;

    const totalEstimatedAvailableLiters = sourcesOverview.reduce(
      (sum, s) => sum + (Number(s.effectiveVolumeLiters) || 0),
      0
    );
    const totalRegisteredCapacityLiters = sourcesOverview.reduce(
      (sum, s) => sum + (Number(s.knownCapacityLiters) || 0),
      0
    );

    // Calcular acumulado del mes en curso (o general si hay registros)
    const currentMonth = getMonthKey(new Date().toISOString());
    const currentMonthRecords = rainfallRecords.filter(r => getMonthKey(r.measuredAt) === currentMonth);
    const monthTotals = calculatePeriodTotal(currentMonthRecords);
    const allTimeRainTotals = calculatePeriodTotal(rainfallRecords);

    // Determinar última fecha de registro de cualquier entidad
    let lastRecordDate = null;
    const allRecords = [
      ...sourcesOverview.map(s => s.updatedAt || s.createdAt),
      ...waterMeasurements.map(m => m.measuredAt || m.createdAt),
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
        backupWarning = true;
      }
    } catch {
      // Ignorar fallback de localStorage
    }

    // Datos para gráfico diario reciente de lluvias (últimos 30 días con registros)
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

    // Datos para gráfica de evolución de disponibilidad (si existen mediciones hídricas reales)
    const sortedMeasurementsAsc = [...waterMeasurements]
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
      .slice(-15);

    const availabilityChartData = {
      labels: sortedMeasurementsAsc.map(m => `${formatDate(m.measuredAt)} (${m.sourceCode || ''})`),
      levels: sortedMeasurementsAsc.map(m => m.waterLevel),
      capacitiesPct: sortedMeasurementsAsc.map(m => m.availableCapacityPct)
    };

    // Últimas actividades (lluvias y mediciones de disponibilidad)
    const recentRain = await rainfallRepository.getRecent(5);
    const recentWaterMeasurements = await waterMeasurementRepository.getRecent(5);

    return {
      counts: {
        totalSources: sourcesOverview.length,
        activeSources: activeWaterSources,
        sourcesWithMeasurements,
        highAvailabilitySources,
        modAvailabilitySources,
        lowOrCriticalSources,
        totalEstimatedAvailableLiters,
        totalRegisteredCapacityLiters,
        waterMeasurementsCount: waterMeasurements.length,
        totalPluviometers: pluviometers.length,
        activePluviometers,
        rainfallRecordsCount: rainfallRecords.length,
        monthAccumulatedMm: monthTotals.totalMm,
        monthMeasuredDays: monthTotals.measuredDaysCount,
        totalAccumulatedRainMm: allTimeRainTotals.totalMm,
        sitesCount: sites.length,
        parcelsCount: parcels.length,
        observationsCount: observations.length,
        activeAlertsCount: activeAlerts.length
      },
      lastRecordDate,
      backupStatus: {
        lastBackupDate,
        daysSinceBackup,
        backupWarning
      },
      chartData,
      availabilityChartData,
      recentRain,
      recentWaterMeasurements,
      activeAlerts: activeAlerts.slice(0, 5),
      sources: sourcesOverview,
      pluviometers,
      sites,
      parcels
    };
  }
}
