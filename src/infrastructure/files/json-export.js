/**
 * Servicio de exportación de datos a JSON y CSV para HIDROTERRA
 */

import { APP_CONFIG } from '../../config/app.config.js';
import { nowIso, getDayKey } from '../../core/date-utils.js';
import { waterSourceRepository } from '../database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../database/repositories/water-measurement.repository.js';
import { waterAlertRepository } from '../database/repositories/water-alert.repository.js';
import { pluviometerRepository } from '../database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../database/repositories/rainfall.repository.js';
import { siteRepository } from '../database/repositories/site.repository.js';
import { parcelRepository } from '../database/repositories/parcel.repository.js';
import { cropRepository } from '../database/repositories/crop.repository.js';
import { observationRepository } from '../database/repositories/observation.repository.js';
import { logger } from '../../core/logger.js';
import { events } from '../../core/events.js';

export class JsonExportService {
  /**
   * Recopila todos los datos reales de IndexedDB y genera el payload de respaldo
   */
  static async buildFullBackupPayload() {
    const [
      water_sources,
      water_measurements,
      water_alerts,
      pluviometers,
      rainfall_records,
      sites,
      parcels,
      crops,
      observations
    ] = await Promise.all([
      waterSourceRepository.getAll(),
      waterMeasurementRepository.getAll(),
      waterAlertRepository.getAll(),
      pluviometerRepository.getAll(),
      rainfallRepository.getAll(),
      siteRepository.getAll(),
      parcelRepository.getAll(),
      cropRepository.getAll(),
      observationRepository.getAll()
    ]);

    const exportedAt = nowIso();

    const payload = {
      metadata: {
        appName: APP_CONFIG.name,
        fullName: APP_CONFIG.fullName,
        version: APP_CONFIG.version,
        schemaVersion: APP_CONFIG.schemaVersion,
        exportedAt,
        region: APP_CONFIG.geo.regionName,
        counts: {
          water_sources: water_sources.length,
          water_measurements: water_measurements.length,
          water_alerts: water_alerts.length,
          pluviometers: pluviometers.length,
          rainfall_records: rainfall_records.length,
          sites: sites.length,
          parcels: parcels.length,
          crops: crops.length,
          observations: observations.length
        }
      },
      data: {
        water_sources,
        water_measurements,
        water_alerts,
        pluviometers,
        rainfall_records,
        sites,
        parcels,
        crops,
        observations
      }
    };

    return payload;
  }

  /**
   * Dispara la descarga del archivo de respaldo JSON en el navegador
   */
  static async exportFullBackup() {
    const payload = await this.buildFullBackupPayload();
    const dateStamp = getDayKey(payload.metadata.exportedAt);
    const filename = `hidroterra-respaldo-${dateStamp}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    this._triggerDownload(blob, filename);

    // Guardar timestamp de último respaldo en localStorage para alertas informativas
    try {
      localStorage.setItem(APP_CONFIG.storage.lastBackupKey, payload.metadata.exportedAt);
    } catch {
      // Ignorar si el modo incógnito restringe localStorage
    }

    logger.info(`Respaldo JSON generado exitosamente: ${filename}`);
    events.emit('backup:completed', { filename, exportedAt: payload.metadata.exportedAt, counts: payload.metadata.counts });
    return { filename, counts: payload.metadata.counts };
  }

  /**
   * Exporta una colección específica a JSON
   */
  static async exportSingleEntity(entityName, records) {
    const exportedAt = nowIso();
    const dateStamp = getDayKey(exportedAt);
    const filename = `hidroterra-${entityName}-${dateStamp}.json`;

    const payload = {
      metadata: {
        appName: APP_CONFIG.name,
        entity: entityName,
        version: APP_CONFIG.version,
        exportedAt,
        count: records.length
      },
      data: records
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    this._triggerDownload(blob, filename);
  }

  /**
   * Exporta datos tabulares a archivo CSV con codificación UTF-8 BOM
   */
  static exportToCsv(filename, headers, rows) {
    const escapeCsvField = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map(row => row.map(escapeCsvField).join(','))
    ].join('\r\n');

    // BOM UTF-8 (\uFEFF) para apertura correcta en Microsoft Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this._triggerDownload(blob, filename);
  }

  static _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
