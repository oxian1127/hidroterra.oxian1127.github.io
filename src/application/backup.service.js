/**
 * Servicio de Aplicación: Respaldo, Restauración y Almacenamiento Local (Backup Service)
 */

import { JsonExportService } from '../infrastructure/files/json-export.js';
import { JsonImportService } from '../infrastructure/files/json-import.js';
import { APP_CONFIG } from '../config/app.config.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { cropRepository } from '../infrastructure/database/repositories/crop.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';

export class BackupService {
  static async exportBackup() {
    return await JsonExportService.exportFullBackup();
  }

  static async analyzeFile(file) {
    const parsed = await JsonImportService.readFileAsJson(file);
    return await JsonImportService.analyzeImport(parsed);
  }

  static async executeImport(data, strategy = 'merge') {
    return await JsonImportService.executeImport(data, strategy);
  }

  /**
   * Obtiene estadísticas del almacenamiento IndexedDB del navegador
   */
  static async getStorageInfo() {
    const [
      sourcesCount,
      pluviometersCount,
      rainfallCount,
      sitesCount,
      parcelsCount,
      cropsCount,
      observationsCount
    ] = await Promise.all([
      waterSourceRepository.count(),
      pluviometerRepository.count(),
      rainfallRepository.count(),
      siteRepository.count(),
      parcelRepository.count(),
      cropRepository.count(),
      observationRepository.count()
    ]);

    const totalRecords = sourcesCount + pluviometersCount + rainfallCount + sitesCount + parcelsCount + cropsCount + observationsCount;

    let quotaEstimate = null;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        quotaEstimate = {
          usageBytes: est.usage || 0,
          quotaBytes: est.quota || 0,
          usageMb: Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10,
          quotaMb: Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10
        };
      } catch {
        // Ignorar si el navegador no permite estimar la cuota
      }
    }

    let lastBackupDate = null;
    try {
      lastBackupDate = localStorage.getItem(APP_CONFIG.storage.lastBackupKey);
    } catch {
      // Ignorar
    }

    return {
      counts: {
        sourcesCount,
        pluviometersCount,
        rainfallCount,
        sitesCount,
        parcelsCount,
        cropsCount,
        observationsCount,
        totalRecords
      },
      quotaEstimate,
      lastBackupDate
    };
  }

  /**
   * Limpia toda la base de datos local (solo con confirmación explícita)
   */
  static async clearAll() {
    await Promise.all([
      waterSourceRepository.clear(),
      pluviometerRepository.clear(),
      rainfallRepository.clear(),
      siteRepository.clear(),
      parcelRepository.clear(),
      cropRepository.clear(),
      observationRepository.clear()
    ]);
    return true;
  }
}
