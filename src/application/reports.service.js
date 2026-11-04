/**
 * Servicio de Aplicación: Reportes y Balances Territoriales (Reports Service)
 */

import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import { WaterAvailabilityService } from './water-availability.service.js';
import {
  calculateDailyAccumulations,
  calculateMonthlyAccumulations,
  calculatePeriodTotal,
  comparePluviometers
} from '../domain/rules/rainfall.rules.js';
import {
  WATER_AVAILABILITY_STATUSES,
  WATER_MEASUREMENT_METHODS
} from '../domain/models/WaterMeasurement.js';
import { WATER_SOURCE_TYPES } from '../domain/models/WaterSource.js';
import { JsonExportService } from '../infrastructure/files/json-export.js';
import { formatDate, formatDateTime, getMonthName } from '../core/date-utils.js';
import { formatCoordinates } from '../domain/rules/coordinates.rules.js';

export class ReportsService {
  /**
   * Reporte 1: Historial de lluvias por pluviómetro
   */
  static async getRainfallHistory(pluviometerId, startDate, endDate, municipality = '', siteId = '') {
    const [pluvs, sites] = await Promise.all([
      pluviometerRepository.getAll(),
      siteRepository.getAll()
    ]);
    const pluvMap = new Map(pluvs.map(p => [p.id, p]));
    const siteMap = new Map(sites.map(s => [s.id, s]));

    let records = await rainfallRepository.getAll();

    if (pluviometerId) {
      records = records.filter(r => r.pluviometerId === pluviometerId);
    }
    if (siteId && siteId !== 'all') {
      records = records.filter(r => {
        const p = pluvMap.get(r.pluviometerId);
        return p && p.siteId === siteId;
      });
    }
    if (municipality && municipality !== 'all') {
      records = records.filter(r => {
        const p = pluvMap.get(r.pluviometerId);
        const s = p ? siteMap.get(p.siteId) : null;
        return s && s.municipality === municipality;
      });
    }
    if (startDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] >= startDate);
    }
    if (endDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] <= endDate);
    }

    records.sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
    const totals = calculatePeriodTotal(records);

    return {
      pluviometer: pluviometerId ? pluvMap.get(pluviometerId) : null,
      records,
      totals,
      startDate,
      endDate
    };
  }

  /**
   * Reporte 2: Precipitación acumulada (Diario, Mensual o Periodo)
   */
  static async getAccumulatedReport(mode = 'monthly', startDate = null, endDate = null) {
    let records = await rainfallRepository.getAll();

    if (startDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] >= startDate);
    }
    if (endDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] <= endDate);
    }

    const daily = calculateDailyAccumulations(records);
    const monthly = calculateMonthlyAccumulations(records);
    const totals = calculatePeriodTotal(records);

    return {
      mode,
      daily,
      monthly,
      totals,
      recordsCount: records.length,
      startDate,
      endDate
    };
  }

  /**
   * Reporte 3: Comparación entre pluviómetros
   */
  static async getPluviometersComparison(startDate = null, endDate = null) {
    let records = await rainfallRepository.getAll();
    const pluviometers = await pluviometerRepository.getAll();

    if (startDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] >= startDate);
    }
    if (endDate) {
      records = records.filter(r => r.measuredAt && r.measuredAt.split('T')[0] <= endDate);
    }

    const comparison = comparePluviometers(records, pluviometers);
    return {
      comparison,
      totalEquipments: pluviometers.length,
      startDate,
      endDate
    };
  }

  /**
   * Reporte 4: Inventario de pluviómetros y coordenadas
   */
  static async getPluviometersInventory() {
    const [pluviometers, sites] = await Promise.all([
      pluviometerRepository.getAll(),
      siteRepository.getAll()
    ]);

    const siteMap = new Map(sites.map(s => [s.id, s.name]));

    const inventory = pluviometers.map(p => ({
      ...p,
      siteName: siteMap.get(p.siteId) || 'Sin comunidad asignada',
      coordsFormatted: formatCoordinates(p.latitude, p.longitude)
    }));

    return inventory.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Reporte 5: Inventario de fuentes de agua
   */
  static async getWaterSourcesInventory(filters = {}) {
    const [sources, sites] = await Promise.all([
      waterSourceRepository.getAll(),
      siteRepository.getAll()
    ]);

    const siteMap = new Map(sites.map(s => [s.id, s]));

    let filtered = sources;
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(s => s.status === filters.status);
    }
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(s => s.type === filters.type);
    }
    if (filters.siteId && filters.siteId !== 'all') {
      filtered = filtered.filter(s => s.siteId === filters.siteId);
    }
    if (filters.municipality && filters.municipality !== 'all') {
      filtered = filtered.filter(s => {
        const site = siteMap.get(s.siteId);
        return site && site.municipality === filters.municipality;
      });
    }

    return filtered.map(s => {
      const site = siteMap.get(s.siteId);
      return {
        ...s,
        siteName: site ? site.name : 'Sin comunidad asignada',
        municipality: site ? site.municipality : '—',
        coordsFormatted: formatCoordinates(s.latitude, s.longitude)
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Reporte 6: Observaciones de campo por sitio o comunidad
   */
  static async getObservationsBySite(siteId = null) {
    const [observations, sites, sources, pluvs] = await Promise.all([
      observationRepository.getAll(),
      siteRepository.getAll(),
      waterSourceRepository.getAll(),
      pluviometerRepository.getAll()
    ]);

    const siteMap = new Map(sites.map(s => [s.id, s.name]));
    const sourceMap = new Map(sources.map(s => [s.id, s.name]));
    const pluvMap = new Map(pluvs.map(p => [p.id, p.name]));

    let list = observations;
    if (siteId && siteId !== 'all') {
      list = list.filter(o => o.relatedEntityType === 'site' && o.relatedEntityId === siteId);
    }

    return list.map(o => {
      let linkedName = '—';
      if (o.relatedEntityType === 'site') linkedName = siteMap.get(o.relatedEntityId) || 'Comunidad no encontrada';
      else if (o.relatedEntityType === 'water_source') linkedName = sourceMap.get(o.relatedEntityId) || 'Fuente no encontrada';
      else if (o.relatedEntityType === 'pluviometer') linkedName = pluvMap.get(o.relatedEntityId) || 'Pluviómetro no encontrado';

      return {
        ...o,
        linkedName,
        dateFormatted: formatDateTime(o.observedAt)
      };
    }).sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt));
  }

  /**
   * Reporte 7: Estado de Disponibilidad Hídrica y Capacidad de Almacenamiento
   */
  static async getWaterAvailabilityStatusReport(filters = {}) {
    const overview = await WaterAvailabilityService.getSourcesAvailabilityOverview({
      municipality: filters.municipality,
      siteId: filters.siteId,
      availabilityStatus: filters.availabilityStatus
    });

    const items = overview.map(source => ({
      ...source,
      typeLabel: WATER_SOURCE_TYPES[source.type] || source.type,
      availabilityLabel: WATER_AVAILABILITY_STATUSES[source.availabilityStatus] || source.availabilityStatus,
      percentageAvailable: source.availableCapacityPct,
      estimatedVolumeLiters: source.effectiveVolumeLiters
    })).sort((a, b) => a.code.localeCompare(b.code));

    const summary = {
      totalSources: items.length,
      alta: items.filter(i => i.availabilityStatus === 'alta').length,
      moderada: items.filter(i => i.availabilityStatus === 'moderada').length,
      baja: items.filter(i => i.availabilityStatus === 'baja').length,
      critica: items.filter(i => i.availabilityStatus === 'critica').length,
      sinInformacion: items.filter(i => i.availabilityStatus === 'sin_informacion').length,
      totalRegisteredCapacityLiters: Math.round(
        items.reduce((acc, i) => acc + (Number(i.knownCapacityLiters) > 0 ? Number(i.knownCapacityLiters) : 0), 0)
      ),
      totalAvailableVolumeLiters: Math.round(
        items.reduce((acc, i) => acc + (Number(i.effectiveVolumeLiters) > 0 ? Number(i.effectiveVolumeLiters) : 0), 0)
      ),
      overallPercentageAvailable: null
    };

    if (summary.totalRegisteredCapacityLiters > 0) {
      summary.overallPercentageAvailable = Number(
        ((summary.totalAvailableVolumeLiters / summary.totalRegisteredCapacityLiters) * 100).toFixed(1)
      );
    }

    return {
      items,
      summary,
      filters
    };
  }

  /**
   * Reporte 8: Historial Cronológico de Mediciones Hídricas
   */
  static async getWaterMeasurementsHistoryReport(filters = {}) {
    const rawList = await WaterAvailabilityService.getAllMeasurements({
      sourceId: filters.waterSourceId,
      siteId: filters.siteId,
      municipality: filters.municipality,
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const list = rawList.map(m => ({
      ...m,
      percentageAvailable: m.availableCapacityPct,
      estimatedVolumeLiters: m.observedVolumeLiters ?? m.estimatedVolumeLiters ?? null,
      availabilityStatus: m.status,
      methodLabel: WATER_MEASUREMENT_METHODS[m.measurementMethod] || m.measurementMethod,
      availabilityLabel: WATER_AVAILABILITY_STATUSES[m.status] || m.status,
      observations: m.notes || ''
    }));

    return {
      records: list,
      totalCount: list.length,
      filters
    };
  }

  /**
   * Reporte 9: Resumen Territorial por Comunidad y Municipio (Balance Hídrico Simplificado)
   */
  static async getTerritorialSummaryReport(filters = {}) {
    const [sites, sourcesOverview, pluvs, rainfall, parcels] = await Promise.all([
      siteRepository.getAll(),
      WaterAvailabilityService.getSourcesAvailabilityOverview(),
      pluviometerRepository.getAll(),
      rainfallRepository.getAll(),
      parcelRepository.getAll()
    ]);

    let filteredRainfall = rainfall;
    if (filters.startDate) {
      filteredRainfall = filteredRainfall.filter(r => r.measuredAt && r.measuredAt.split('T')[0] >= filters.startDate);
    }
    if (filters.endDate) {
      filteredRainfall = filteredRainfall.filter(r => r.measuredAt && r.measuredAt.split('T')[0] <= filters.endDate);
    }

    let targetSites = sites;
    if (filters.municipality && filters.municipality !== 'all') {
      targetSites = targetSites.filter(s => s.municipality === filters.municipality);
    }
    if (filters.siteId && filters.siteId !== 'all') {
      targetSites = targetSites.filter(s => s.id === filters.siteId);
    }

    const communitiesSummary = targetSites.map(site => {
      const siteSources = sourcesOverview.filter(s => s.siteId === site.id);
      const sitePluvs = pluvs.filter(p => p.siteId === site.id);
      const sitePluvIds = new Set(sitePluvs.map(p => p.id));
      const siteRainfall = filteredRainfall.filter(r => sitePluvIds.has(r.pluviometerId));
      const siteParcels = parcels.filter(pa => pa.siteId === site.id);

      const rainTotalMm = Math.round(siteRainfall.reduce((acc, r) => acc + (Number(r.precipitationMm) || 0), 0) * 10) / 10;

      let registeredCapacityLiters = 0;
      let estimatedAvailableLiters = 0;
      let criticalOrLowCount = 0;

      siteSources.forEach(src => {
        if (src.knownCapacityLiters > 0) {
          registeredCapacityLiters += Number(src.knownCapacityLiters);
        }
        if (src.effectiveVolumeLiters !== null && src.effectiveVolumeLiters >= 0) {
          estimatedAvailableLiters += Number(src.effectiveVolumeLiters);
        }
        if (src.availabilityStatus === 'baja' || src.availabilityStatus === 'critica') {
          criticalOrLowCount++;
        }
      });

      const fillPct = registeredCapacityLiters > 0
        ? Math.round((estimatedAvailableLiters / registeredCapacityLiters) * 1000) / 10
        : null;

      return {
        siteId: site.id,
        siteName: site.name,
        municipality: site.municipality,
        subregion: site.subregion || 'Montes de María',
        sourcesCount: siteSources.length,
        criticalOrLowCount,
        pluviometersCount: sitePluvs.length,
        parcelsCount: siteParcels.length,
        rainTotalMm,
        registeredCapacityLiters: Math.round(registeredCapacityLiters),
        estimatedAvailableLiters: Math.round(estimatedAvailableLiters),
        fillPct
      };
    });

    // Agrupación por municipio
    const municipalityMap = new Map();
    communitiesSummary.forEach(c => {
      const mun = c.municipality || 'Sin Municipio';
      if (!municipalityMap.has(mun)) {
        municipalityMap.set(mun, {
          municipality: mun,
          communitiesCount: 0,
          sourcesCount: 0,
          criticalOrLowCount: 0,
          pluviometersCount: 0,
          parcelsCount: 0,
          rainTotalMm: 0,
          registeredCapacityLiters: 0,
          estimatedAvailableLiters: 0
        });
      }
      const mItem = municipalityMap.get(mun);
      mItem.communitiesCount += 1;
      mItem.sourcesCount += c.sourcesCount;
      mItem.criticalOrLowCount += c.criticalOrLowCount;
      mItem.pluviometersCount += c.pluviometersCount;
      mItem.parcelsCount += c.parcelsCount;
      mItem.rainTotalMm = Math.round((mItem.rainTotalMm + c.rainTotalMm) * 10) / 10;
      mItem.registeredCapacityLiters += c.registeredCapacityLiters;
      mItem.estimatedAvailableLiters += c.estimatedAvailableLiters;
    });

    return {
      communities: communitiesSummary.sort((a, b) => a.siteName.localeCompare(b.siteName)),
      municipalities: Array.from(municipalityMap.values()).sort((a, b) => a.municipality.localeCompare(b.municipality)),
      filters
    };
  }

  /**
   * Exporta reporte a CSV según el tipo
   */
  static exportReportToCsv(reportType, reportData, pluviometerMap = new Map()) {
    if (reportType === 'rainfall_history') {
      const headers = ['Fecha y Hora', 'Código Pluviómetro', 'Pluviómetro', 'Precipitación (mm)', 'Tipo de Lectura', 'Responsable', 'Observaciones'];
      const rows = reportData.records.map(r => {
        const pluv = pluviometerMap.get(r.pluviometerId);
        return [
          formatDateTime(r.measuredAt),
          pluv ? pluv.code : '',
          pluv ? pluv.name : r.pluviometerId,
          r.precipitationMm,
          r.measurementType,
          r.responsible || '',
          r.notes || ''
        ];
      });
      JsonExportService.exportToCsv('hidroterra-historial-lluvias.csv', headers, rows);
    } else if (reportType === 'accumulated') {
      const headers = ['Periodo', 'Total Lluvia (mm)', 'Registros'];
      const rows = Object.keys(reportData.monthly).sort().map(m => [
        getMonthName(m),
        reportData.monthly[m].totalMm,
        reportData.monthly[m].count
      ]);
      JsonExportService.exportToCsv('hidroterra-precipitacion-acumulada.csv', headers, rows);
    } else if (reportType === 'comparison') {
      const headers = ['Código', 'Nombre Pluviómetro', 'Total Acumulado (mm)', 'Número de Registros', 'Lectura Máxima (mm)', 'Última Lectura'];
      const rows = reportData.comparison.map(c => [
        c.code,
        c.name,
        c.totalMm,
        c.recordCount,
        c.maxReading,
        c.lastReadingDate ? formatDateTime(c.lastReadingDate) : 'Sin mediciones'
      ]);
      JsonExportService.exportToCsv('hidroterra-comparativo-pluviometros.csv', headers, rows);
    } else if (reportType === 'pluviometers_inventory') {
      const headers = ['Código', 'Nombre', 'Tipo Equipo', 'Comunidad/Sitio', 'Latitud', 'Longitud', 'Altitud (msnm)', 'Estado', 'Responsable'];
      const rows = reportData.map(p => [
        p.code,
        p.name,
        p.equipmentType,
        p.siteName,
        p.latitude !== null ? p.latitude : '',
        p.longitude !== null ? p.longitude : '',
        p.altitudeMeters !== null ? p.altitudeMeters : '',
        p.status,
        p.responsible || ''
      ]);
      JsonExportService.exportToCsv('hidroterra-inventario-pluviometros.csv', headers, rows);
    } else if (reportType === 'sources_inventory') {
      const headers = ['Código', 'Nombre', 'Tipo', 'Comunidad/Sitio', 'Municipio', 'Latitud', 'Longitud', 'Estado', 'Capacidad (L)', 'Uso Principal', 'Responsable'];
      const rows = reportData.map(s => [
        s.code,
        s.name,
        s.type,
        s.siteName,
        s.municipality || '',
        s.latitude !== null ? s.latitude : '',
        s.longitude !== null ? s.longitude : '',
        s.status,
        s.knownCapacityLiters !== null && s.knownCapacityLiters !== undefined ? s.knownCapacityLiters : '',
        s.mainUse,
        s.responsible || ''
      ]);
      JsonExportService.exportToCsv('hidroterra-inventario-fuentes-agua.csv', headers, rows);
    } else if (reportType === 'observations') {
      const headers = ['Fecha y Hora', 'Categoría', 'Entidad Vinculada', 'Elemento', 'Descripción', 'Estado Observado', 'Responsable'];
      const rows = reportData.map(o => [
        o.dateFormatted,
        o.category,
        o.relatedEntityType,
        o.linkedName,
        o.description,
        o.observedStatus || '',
        o.responsible || ''
      ]);
      JsonExportService.exportToCsv('hidroterra-observaciones-campo.csv', headers, rows);
    } else if (reportType === 'water_availability_status') {
      const headers = ['Código', 'Nombre Fuente', 'Tipo', 'Comunidad', 'Municipio', 'Disponibilidad', 'Última Medición', 'Nivel Medido', 'Volumen Estimado/Observado (L)', 'Capacidad Registrada (L)', '% Capacidad', 'Tendencia'];
      const rows = reportData.items.map(i => [
        i.code,
        i.name,
        i.typeLabel,
        i.siteName,
        i.municipality,
        i.availabilityLabel,
        i.latestMeasurement ? i.latestMeasurement.measuredDate : 'Sin medición',
        i.latestMeasurement ? `${i.latestMeasurement.waterLevel} ${i.latestMeasurement.unit}` : '—',
        i.estimatedVolumeLiters !== null ? i.estimatedVolumeLiters : '',
        i.knownCapacityLiters !== null ? i.knownCapacityLiters : '',
        i.percentageAvailable !== null ? `${i.percentageAvailable}%` : '',
        i.trendLabel || 'Estable'
      ]);
      JsonExportService.exportToCsv('hidroterra-estado-disponibilidad-hidrica.csv', headers, rows);
    } else if (reportType === 'water_measurements_history') {
      const headers = ['Fecha', 'Hora', 'Código Fuente', 'Fuente Hídrica', 'Comunidad', 'Municipio', 'Nivel Medido', 'Unidad', 'Volumen (L)', '% Capacidad', 'Estado Disponibilidad', 'Método', 'Responsable', 'Observaciones'];
      const rows = reportData.records.map(r => [
        r.measuredDate,
        r.measuredTime,
        r.sourceCode,
        r.sourceName,
        r.siteName,
        r.municipality,
        r.waterLevel,
        r.unit,
        r.estimatedVolumeLiters !== null ? r.estimatedVolumeLiters : '',
        r.percentageAvailable !== null ? r.percentageAvailable : '',
        r.availabilityLabel,
        r.methodLabel,
        r.responsible || '',
        r.observations || ''
      ]);
      JsonExportService.exportToCsv('hidroterra-historial-mediciones-hidricas.csv', headers, rows);
    } else if (reportType === 'territorial_water_balance') {
      const headers = ['Comunidad / Sitio', 'Municipio', 'Fuentes Hídricas', 'Fuentes Baja/Crítica', 'Pluviómetros', 'Parcelas Productivas', 'Lluvia Acumulada (mm)', 'Capacidad Registrada (L)', 'Volumen Estimado Disponible (L)', '% Ocupación Estimada'];
      const rows = reportData.communities.map(c => [
        c.siteName,
        c.municipality,
        c.sourcesCount,
        c.criticalOrLowCount,
        c.pluviometersCount,
        c.parcelsCount,
        c.rainTotalMm,
        c.registeredCapacityLiters,
        c.estimatedAvailableLiters,
        c.fillPct !== null ? `${c.fillPct}%` : '—'
      ]);
      JsonExportService.exportToCsv('hidroterra-balance-territorial-comunidades.csv', headers, rows);
    }
  }
}
