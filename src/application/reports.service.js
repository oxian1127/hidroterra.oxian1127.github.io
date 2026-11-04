/**
 * Servicio de Aplicación: Reportes y Balances Territoriales (Reports Service)
 */

import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import {
  calculateDailyAccumulations,
  calculateMonthlyAccumulations,
  calculatePeriodTotal,
  comparePluviometers
} from '../domain/rules/rainfall.rules.js';
import { JsonExportService } from '../infrastructure/files/json-export.js';
import { formatDate, formatDateTime, getMonthName } from '../core/date-utils.js';
import { formatCoordinates } from '../domain/rules/coordinates.rules.js';

export class ReportsService {
  /**
   * Reporte 1: Historial de lluvias por pluviómetro
   */
  static async getRainfallHistory(pluviometerId, startDate, endDate) {
    const pluv = pluviometerId ? await pluviometerRepository.getById(pluviometerId) : null;
    let records = await rainfallRepository.getAll();

    if (pluviometerId) {
      records = records.filter(r => r.pluviometerId === pluviometerId);
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
      pluviometer: pluv,
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

    const siteMap = new Map(sites.map(s => [s.id, s.name]));

    let filtered = sources;
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(s => s.status === filters.status);
    }
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(s => s.type === filters.type);
    }

    return filtered.map(s => ({
      ...s,
      siteName: siteMap.get(s.siteId) || 'Sin comunidad asignada',
      coordsFormatted: formatCoordinates(s.latitude, s.longitude)
    })).sort((a, b) => a.code.localeCompare(b.code));
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
      JsonExportService.exportToCsv('reporte-historial-lluvias.csv', headers, rows);
    } else if (reportType === 'accumulated') {
      const headers = ['Periodo', 'Total Lluvia (mm)', 'Registros'];
      const rows = Object.keys(reportData.monthly).sort().map(m => [
        getMonthName(m),
        reportData.monthly[m].totalMm,
        reportData.monthly[m].count
      ]);
      JsonExportService.exportToCsv('reporte-precipitacion-acumulada.csv', headers, rows);
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
      JsonExportService.exportToCsv('reporte-comparativo-pluviometros.csv', headers, rows);
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
      JsonExportService.exportToCsv('reporte-inventario-pluviometros.csv', headers, rows);
    } else if (reportType === 'sources_inventory') {
      const headers = ['Código', 'Nombre', 'Tipo', 'Comunidad/Sitio', 'Latitud', 'Longitud', 'Estado', 'Uso Principal', 'Responsable'];
      const rows = reportData.map(s => [
        s.code,
        s.name,
        s.type,
        s.siteName,
        s.latitude !== null ? s.latitude : '',
        s.longitude !== null ? s.longitude : '',
        s.status,
        s.mainUse,
        s.responsible || ''
      ]);
      JsonExportService.exportToCsv('reporte-inventario-fuentes-agua.csv', headers, rows);
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
      JsonExportService.exportToCsv('reporte-observaciones-campo.csv', headers, rows);
    }
  }
}
