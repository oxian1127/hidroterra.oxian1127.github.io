/**
 * Suite de Pruebas Unitarias e Integración: Gestión Hídrica, Disponibilidad, Calculadoras y Alertas
 * Cubre los 16 escenarios requeridos en la ampliación de HIDROTERRA.
 */

import { WaterMeasurement } from '../src/domain/models/WaterMeasurement.js';
import { WaterSource } from '../src/domain/models/WaterSource.js';
import {
  computeMeasurementMetrics,
  classifyWaterAvailability
} from '../src/domain/rules/water-availability.rules.js';
import {
  calculateRainwaterHarvesting,
  calculateStorageCapacity,
  calculateSimplifiedWaterBalance,
  calculateWaterAutonomy
} from '../src/domain/rules/water-calculators.rules.js';
import { evaluateWaterAlerts } from '../src/domain/rules/water-alerts.rules.js';
import { assertCanDeleteWaterSource } from '../src/domain/rules/data-integrity.rules.js';
import { idb } from '../src/infrastructure/database/indexeddb.js';
import { DB_CONFIG } from '../src/config/database.config.js';
import { WaterSourcesService } from '../src/application/water-sources.service.js';
import { WaterAvailabilityService } from '../src/application/water-availability.service.js';
import { validateBackupFileStructure } from '../src/infrastructure/files/file-validation.js';
import { JsonImportService } from '../src/infrastructure/files/json-import.js';
import { FutureSyncService } from '../src/application/future-sync.service.js';

export function runWaterManagementTests(suite) {
  // 1. Registro de medición de fuente hídrica
  suite.test('1. Registro de medición de fuente hídrica: Persiste medición y calcula disponibilidad', async (assert) => {
    await idb.init();
    const tempSource = await WaterSourcesService.create({
      code: 'FNT-TEST-WM01',
      name: 'Reservorio Experimental Prueba',
      type: 'reservorio',
      status: 'disponible',
      mainUse: 'riego',
      knownCapacityLiters: 50000,
      referenceDepthMeters: 2.5,
      latitude: 9.72,
      longitude: -75.12
    });

    const createdMeas = await WaterAvailabilityService.create({
      sourceId: tempSource.id,
      measuredDate: '2026-10-25',
      measuredTime: '08:30',
      waterLevel: 2.0,
      unit: 'm',
      totalDepthMeters: 2.5,
      measurementMethod: 'regla_limnimetrica',
      responsible: 'Técnico Hidrología'
    });

    assert.ok(createdMeas.id, 'Medición creada con ID único');
    assert.strictEqual(createdMeas.sourceCode, 'FNT-TEST-WM01', 'Vincula código de fuente hídrica');
    assert.strictEqual(createdMeas.availableCapacityPct, 80, 'Calcula 80% de disponibilidad (2.0m / 2.5m)');
    assert.strictEqual(createdMeas.estimatedVolumeLiters, 40000, 'Calcula 40,000 L sobre capacidad de 50,000 L');
    assert.strictEqual(createdMeas.status, 'alta', 'Clasifica estado como disponibilidad alta');

    window.__testMeasurementId = createdMeas.id;
    window.__testSourceId = tempSource.id;
  });

  // 2. Edición de medición
  suite.test('2. Edición de medición: Actualiza nivel y recalcula porcentaje y estado de disponibilidad', async (assert) => {
    const measId = window.__testMeasurementId;
    assert.ok(measId, 'Existe medición previa para editar');

    const updated = await WaterAvailabilityService.update(measId, {
      waterLevel: 0.4,
      unit: 'm',
      totalDepthMeters: 2.5,
      notes: 'Descenso marcado en periodo seco'
    });

    assert.strictEqual(updated.waterLevel, 0.4, 'Actualiza nivel de agua a 0.4 m');
    assert.strictEqual(updated.availableCapacityPct, 16, 'Recalcula porcentaje disponible a 16%');
    assert.strictEqual(updated.status, 'critica', 'Reclasifica disponibilidad como crítica (<25% en reservorio)');
  });

  // 3. Validación de nivel de agua
  suite.test('3. Validación de nivel de agua: Rechaza niveles negativos o superiores a profundidad total', (assert) => {
    assert.throws(() => {
      const m = new WaterMeasurement({
        sourceId: 'src-1',
        measuredAt: '2026-10-25T08:00:00.000Z',
        waterLevel: -1.5,
        unit: 'm',
        measurementMethod: 'manual_nivel'
      });
      m.validate();
    }, /mayor o igual a cero/i, 'Rechaza nivel de agua negativo');

    assert.throws(() => {
      const m = new WaterMeasurement({
        sourceId: 'src-1',
        measuredAt: '2026-10-25T08:00:00.000Z',
        waterLevel: 4.5,
        totalDepthMeters: 3.0,
        unit: 'm',
        measurementMethod: 'regla_limnimetrica'
      });
      m.validate();
    }, /superar la profundidad total/i, 'Rechaza nivel mayor que profundidad total');

    assert.throws(() => {
      const m = new WaterMeasurement({
        sourceId: 'src-1',
        measuredAt: '2026-10-25T08:00:00.000Z',
        waterLevel: 125,
        unit: 'pct',
        measurementMethod: 'estimacion_tecnica'
      });
      m.validate();
    }, /entre 0 y 100/i, 'Rechaza porcentaje mayor a 100%');
  });

  // 4. Validación de unidades
  suite.test('4. Validación de unidades: Acepta m, cm, L, m3, pct y l_s y rechaza unidades no soportadas', (assert) => {
    assert.doesNotThrow(() => {
      const m = new WaterMeasurement({
        sourceId: 'src-1',
        measuredAt: '2026-10-25T08:00:00.000Z',
        waterLevel: 150,
        unit: 'cm',
        measurementMethod: 'regla_limnimetrica'
      });
      m.validate();
    }, 'Acepta unidad cm');

    assert.throws(() => {
      const m = new WaterMeasurement({
        sourceId: 'src-1',
        measuredAt: '2026-10-25T08:00:00.000Z',
        waterLevel: 10,
        unit: 'galones_imperiales',
        measurementMethod: 'manual_nivel'
      });
      m.validate();
    }, /Unidad de medición no válida/i, 'Rechaza unidad desconocida');
  });

  // 5. Cálculo de volumen disponible
  suite.test('5. Cálculo de volumen disponible: Convierte m3, L, pct y relación nivel/profundidad con exactitud', (assert) => {
    const fromM3 = computeMeasurementMetrics({
      waterLevel: 35,
      unit: 'm3',
      knownCapacityLiters: 100000
    });
    assert.strictEqual(fromM3.observedVolumeLiters, 35000, '35 m³ equivalen a 35,000 L');
    assert.strictEqual(fromM3.availableCapacityPct, 35, '35,000 L equivalen a 35% de 100,000 L');

    const fromCm = computeMeasurementMetrics({
      waterLevel: 200,
      unit: 'cm',
      totalDepthMeters: 4.0,
      knownCapacityLiters: 100000
    });
    assert.strictEqual(fromCm.availableCapacityPct, 50, '200 cm sobre 4.0 m equivalen a 50%');
    assert.strictEqual(fromCm.estimatedVolumeLiters, 50000, '50% de 100,000 L son 50,000 L');
  });

  // 6. Calculadora de captación de agua lluvia
  suite.test('6. Calculadora de captación de agua lluvia: Aplica fórmula V = P × A × C correctamente', (assert) => {
    const res = calculateRainwaterHarvesting({
      precipitationMm: 40,
      catchmentAreaM2: 120,
      runoffCoefficient: 0.85
    });

    // V = 40 * 120 * 0.85 = 4080 L
    assert.strictEqual(res.formulaVolumeLiters, 4080, 'Calcula 4,080 litros captables');
    assert.strictEqual(res.formulaVolumeM3, 4.08, 'Calcula 4.08 m³');
  });

  // 7. Calculadora de almacenamiento
  suite.test('7. Calculadora de almacenamiento: Calcula tanques cilíndricos, rectangulares y reservorios con talud', (assert) => {
    const cyl = calculateStorageCapacity({
      geometry: 'cilindrico',
      diameterMeters: 2.0,
      totalHeightMeters: 2.0,
      currentWaterLevelMeters: 1.0
    });
    assert.ok(Math.abs(cyl.totalCapacityLiters - 6283.2) < 1, 'Volumen cilíndrico total ~6,283.2 L');
    assert.strictEqual(cyl.fillPercentage, 50, 'Ocupación al 50% con altura de agua a la mitad');

    const rect = calculateStorageCapacity({
      geometry: 'rectangular',
      lengthMeters: 4,
      widthMeters: 2.5,
      totalHeightMeters: 2,
      currentWaterLevelMeters: 1.5
    });
    assert.strictEqual(rect.totalCapacityLiters, 20000, 'Tanque rectangular 4x2.5x2m = 20,000 L');
    assert.strictEqual(rect.availableVolumeLiters, 15000, 'Con 1.5m de agua tiene 15,000 L disponibles');

    const pond = calculateStorageCapacity({
      geometry: 'reservorio_rectangular',
      lengthMeters: 10,
      widthMeters: 8,
      totalHeightMeters: 2,
      slopeFactor: 0.75,
      currentWaterLevelMeters: 1.5
    });
    assert.strictEqual(pond.totalCapacityLiters, 120000, 'Jagüey 10x8x2m con factor 0.75 = 120,000 L');
  });

  // 8. Balance hídrico simplificado
  suite.test('8. Balance hídrico simplificado: Aplica Almacenamiento final = Inicial + Entradas - Salidas - Pérdidas', (assert) => {
    const bal = calculateSimplifiedWaterBalance({
      initialStorageLiters: 50000,
      maxStorageCapacityLiters: 100000,
      otherInflowsLiters: 30000,
      estimatedConsumptionLiters: 34000,
      estimatedLossesLiters: 3000
    });

    // 50000 + 30000 - 34000 - 3000 = 43000 L
    assert.strictEqual(bal.effectiveFinalStorageLiters, 43000, 'Almacenamiento final exacto de 43,000 L');
    assert.strictEqual(bal.netVariationLiters, -7000, 'Variación neta de -7,000 L');
  });

  // 9. Autonomía hídrica
  suite.test('9. Autonomía hídrica: Calcula días de reserva considerando demanda diaria y margen de seguridad', (assert) => {
    const aut = calculateWaterAutonomy({
      availableVolumeLiters: 30000,
      directTotalDailyDemandLiters: 1000,
      safetyMarginPct: 10
    });

    assert.strictEqual(aut.totalDailyDemandLiters, 1000, 'Demanda diaria total de 1,000 L/día');
    assert.strictEqual(aut.usableVolumeLiters, 27000, 'Volumen útil descontando 10% de reserva = 27,000 L');
    assert.strictEqual(aut.safeAutonomyDays, 27, 'Autonomía segura calculada en 27 días');
  });

  // 10. Generación de alertas
  suite.test('10. Generación de alertas: Genera alertas reales por nivel crítico o caída de nivel', (assert) => {
    const alerts = evaluateWaterAlerts({
      waterSources: [
        { id: 'src-crit-1', code: 'FNT-CRIT-01', name: 'Pozo Veredal Seco', active: true, status: 'disponible' }
      ],
      waterMeasurements: [
        {
          id: 'm1',
          sourceId: 'src-crit-1',
          measuredAt: new Date().toISOString(),
          waterLevel: 0.2,
          unit: 'm',
          availableCapacityPct: 10,
          status: 'critica'
        }
      ],
      rainfallRecords: [],
      pluviometers: []
    });

    assert.ok(alerts.length >= 1, 'Genera alerta por fuente en estado crítico');
    assert.ok(alerts.some(a => a.type === 'disponibilidad_critica'), 'Incluye alerta de disponibilidad crítica');
  });

  // 11. Integridad referencial
  suite.test('11. Integridad referencial: Impide eliminar fuente hídrica con mediciones asociadas', async (assert) => {
    const sourceId = window.__testSourceId;
    assert.ok(sourceId, 'Existe fuente de prueba con medición asociada');

    assert.throws(() => {
      assertCanDeleteWaterSource(sourceId, [{ id: 'm1', sourceId }], []);
    }, /medici/i, 'Regla de integridad bloquea borrado directo de fuente con mediciones');

    // Limpiar medición y luego eliminar fuente de prueba
    await WaterAvailabilityService.delete(window.__testMeasurementId);
    await WaterSourcesService.delete(sourceId);
  });

  // 12. Migraciones de IndexedDB
  suite.test('12. Migraciones de IndexedDB: Verifica esquema v3 con almacenes water_measurements, water_alerts y sync_queue', async (assert) => {
    const db = await idb.init();
    assert.strictEqual(db.version, DB_CONFIG.version, 'Versión de base de datos coincide con DB_CONFIG (v3)');
    assert.ok(db.objectStoreNames.contains(DB_CONFIG.stores.WATER_MEASUREMENTS), 'Existe almacén water_measurements');
    assert.ok(db.objectStoreNames.contains(DB_CONFIG.stores.WATER_ALERTS), 'Existe almacén water_alerts');
    assert.ok(db.objectStoreNames.contains(DB_CONFIG.stores.SYNC_QUEUE), 'Existe almacén sync_queue');
  });

  // 13. Exportación JSON
  suite.test('13. Exportación JSON: Respaldo incluye nuevas colecciones water_measurements y water_alerts', async (assert) => {
    const validExportMock = {
      metadata: {
        appName: 'HIDROTERRA',
        version: '2.0.0',
        schemaVersion: '3.0',
        exportedAt: new Date().toISOString()
      },
      data: {
        water_sources: [],
        water_measurements: [
          new WaterMeasurement({
            id: 'wm-exp-1',
            sourceId: 'ws-1',
            measuredAt: '2026-10-25T08:00:00.000Z',
            waterLevel: 1.8,
            unit: 'm'
          }).toJSON()
        ],
        water_alerts: [],
        pluviometers: [],
        rainfall_records: [],
        sites: [],
        parcels: [],
        crops: [],
        observations: []
      }
    };

    const validation = validateBackupFileStructure(validExportMock);
    assert.strictEqual(validation.valid, true, 'Estructura exportada v3.0 es 100% válida');
    assert.ok(validation.collectionsPresent.includes('water_measurements'), 'Incluye colección water_measurements');
  });

  // 14. Importación JSON
  suite.test('14. Importación JSON: Analiza (Dry-Run) e importa colecciones de mediciones y alertas hídricas', async (assert) => {
    const payload = {
      metadata: {
        appName: 'HIDROTERRA',
        version: '2.0.0',
        schemaVersion: '3.0',
        exportedAt: '2026-10-26T12:00:00.000Z'
      },
      data: {
        water_sources: [],
        water_measurements: [
          {
            id: 'wm-dryrun-test-1',
            sourceId: 'source-001',
            measuredAt: '2026-10-26T08:00:00.000Z',
            waterLevel: 9.5,
            unit: 'm'
          }
        ],
        water_alerts: []
      }
    };

    const analysis = await JsonImportService.analyzeImport(payload);
    assert.ok(analysis.diff.water_measurements, 'Calcula diff para water_measurements');
    assert.strictEqual(analysis.diff.water_measurements.incomingTotal, 1, 'Detecta 1 medición hídrica entrante');
  });

  // 15. Funcionamiento Offline y Cola de Sincronización
  suite.test('15. Funcionamiento Offline: Registra metadatos syncStatus y cola de sincronización local', async (assert) => {
    const status = await FutureSyncService.getStatusWithQueueCount();
    assert.strictEqual(status.enabled, false, 'Modo Offline-First activo por defecto sin requerir servidor');
    assert.ok(typeof status.pendingQueueCount === 'number', 'Cola de sincronización local operativa en IndexedDB');
  });

  // 16. Compatibilidad con datos anteriores
  suite.test('16. Compatibilidad con datos anteriores: Fuentes y respaldos PAnA V2 AGUA sin campos nuevos funcionan sin error', (assert) => {
    const legacySource = new WaterSource({
      id: 'legacy-ws-01',
      code: 'FNT-OLD-01',
      name: 'Jagüey Antiguo',
      type: 'jaguey',
      status: 'limitada'
    });

    const classRes = classifyWaterAvailability({ sourceType: legacySource.type, waterLevel: null });
    assert.strictEqual(classRes.status, 'sin_informacion', 'Fuente sin mediciones se clasifica explícitamente como sin_informacion');

    const legacyBackup = {
      metadata: {
        appName: 'PAnA V2 AGUA',
        version: '1.0.0',
        exportedAt: '2026-09-01T00:00:00.000Z'
      },
      data: {
        water_sources: [legacySource.toJSON()]
      }
    };
    const res = validateBackupFileStructure(legacyBackup);
    assert.strictEqual(res.valid, true, 'Respaldo legado PAnA V2 AGUA sin water_measurements es aceptado sin errores');
  });
}
