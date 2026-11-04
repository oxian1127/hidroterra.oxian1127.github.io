/**
 * Servicio de Importación de Respaldos JSON para HIDROTERRA
 */

import { validateBackupFileStructure } from './file-validation.js';
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
import { ValidationError } from '../../core/errors.js';

export class JsonImportService {
  /**
   * Lee un archivo JSON desde un input tipo file
   */
  static async readFileAsJson(file) {
    if (!file) throw new ValidationError('No se ha seleccionado ningún archivo.');
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      throw new ValidationError('El archivo seleccionado debe ser un documento con formato .json');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          resolve(parsed);
        } catch (err) {
          reject(new ValidationError('El archivo no contiene un formato JSON válido o está corrupto.'));
        }
      };
      reader.onerror = () => reject(new ValidationError('Error al leer el archivo desde el dispositivo.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  /**
   * Analiza el archivo JSON y calcula un resumen previo (Dry-Run) antes de escribir
   */
  static async analyzeImport(payload) {
    validateBackupFileStructure(payload);

    const { data } = payload;

    // Obtener registros actuales para calcular qué es nuevo y qué es actualización
    const [
      curSources,
      curMeasurements,
      curAlerts,
      curPluvs,
      curRain,
      curSites,
      curParcels,
      curCrops,
      curObs
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

    const buildEntityDiff = (incoming = [], current = []) => {
      const currentIds = new Set(current.map(c => c.id));
      let newCount = 0;
      let updateCount = 0;

      incoming.forEach(item => {
        if (currentIds.has(item.id)) {
          updateCount++;
        } else {
          newCount++;
        }
      });

      return {
        incomingTotal: incoming.length,
        newCount,
        updateCount,
        currentTotal: current.length
      };
    };

    const diff = {
      water_sources: buildEntityDiff(data.water_sources, curSources),
      water_measurements: buildEntityDiff(data.water_measurements, curMeasurements),
      water_alerts: buildEntityDiff(data.water_alerts, curAlerts),
      pluviometers: buildEntityDiff(data.pluviometers, curPluvs),
      rainfall_records: buildEntityDiff(data.rainfall_records, curRain),
      sites: buildEntityDiff(data.sites, curSites),
      parcels: buildEntityDiff(data.parcels, curParcels),
      crops: buildEntityDiff(data.crops, curCrops),
      observations: buildEntityDiff(data.observations, curObs)
    };

    return {
      metadata: payload.metadata,
      diff,
      data
    };
  }

  /**
   * Ejecuta la importación con la estrategia seleccionada:
   * - 'restore': Reemplaza la base de datos completa con los datos del respaldo.
   * - 'merge': Fusiona registros nuevos y actualiza los existentes por ID sin borrar otros.
   */
  static async executeImport(data, strategy = 'merge') {
    if (!data) throw new ValidationError('Datos no proporcionados para la importación.');

    logger.info(`Iniciando importación con estrategia: ${strategy}`);

    try {
      if (strategy === 'restore') {
        // Limpiar almacenes primero
        await Promise.all([
          waterSourceRepository.clear(),
          waterMeasurementRepository.clear(),
          waterAlertRepository.clear(),
          pluviometerRepository.clear(),
          rainfallRepository.clear(),
          siteRepository.clear(),
          parcelRepository.clear(),
          cropRepository.clear(),
          observationRepository.clear()
        ]);
      }

      // Guardar registros por lotes
      const promises = [];
      if (data.sites && data.sites.length > 0) promises.push(siteRepository.saveBatch(data.sites));
      if (data.water_sources && data.water_sources.length > 0) promises.push(waterSourceRepository.saveBatch(data.water_sources));
      if (data.water_measurements && data.water_measurements.length > 0) promises.push(waterMeasurementRepository.saveBatch(data.water_measurements));
      if (data.water_alerts && data.water_alerts.length > 0) promises.push(waterAlertRepository.saveBatch(data.water_alerts));
      if (data.pluviometers && data.pluviometers.length > 0) promises.push(pluviometerRepository.saveBatch(data.pluviometers));
      if (data.rainfall_records && data.rainfall_records.length > 0) promises.push(rainfallRepository.saveBatch(data.rainfall_records));
      if (data.parcels && data.parcels.length > 0) promises.push(parcelRepository.saveBatch(data.parcels));
      if (data.crops && data.crops.length > 0) promises.push(cropRepository.saveBatch(data.crops));
      if (data.observations && data.observations.length > 0) promises.push(observationRepository.saveBatch(data.observations));

      await Promise.all(promises);

      logger.info('Importación completada con éxito.');
      events.emit('import:completed', { strategy });
      events.emit('data:reloaded');

      return {
        success: true,
        strategy
      };
    } catch (err) {
      logger.error('Fallo durante la ejecución de la importación', err);
      throw err;
    }
  }
}
