/**
 * Pruebas unitarias: Validación de Respaldos JSON y Esquemas
 */

import { validateBackupFileStructure } from '../src/infrastructure/files/file-validation.js';
import { JsonImportService } from '../src/infrastructure/files/json-import.js';

export function runBackupTests(suite) {
  suite.test('Validación de Respaldo: Acepta archivo válido con metadata y colecciones correctas', (assert) => {
    const validPayload = {
      metadata: {
        appName: 'PAnA V2 AGUA',
        version: '2.0.0',
        schemaVersion: '2.0',
        exportedAt: '2026-10-26T12:00:00.000Z'
      },
      data: {
        water_sources: [{ id: 'ws1', code: 'FNT-01', name: 'Pozo', type: 'pozo', status: 'disponible' }],
        pluviometers: [],
        rainfall_records: [],
        sites: [],
        parcels: [],
        crops: [],
        observations: []
      }
    };

    const res = validateBackupFileStructure(validPayload);
    assert.strictEqual(res.valid, true, 'Estructura válida aprobada');
    assert.ok(res.collectionsPresent.includes('water_sources'), 'Detecta colección de fuentes presente');

    // Comprobar que appName 'HIDROTERRA' también es aceptado válidamente
    const hidroterraPayload = {
      ...validPayload,
      metadata: { ...validPayload.metadata, appName: 'HIDROTERRA' }
    };
    const resHidro = validateBackupFileStructure(hidroterraPayload);
    assert.strictEqual(resHidro.valid, true, 'Respaldo con appName HIDROTERRA aprobado con éxito');
  });

  suite.test('Validación de Respaldo: Rechaza archivos de otras aplicaciones o esquemas corruptos', (assert) => {
    assert.throws(() => {
      validateBackupFileStructure(null);
    }, /objeto JSON válido/, 'Rechaza null');

    assert.throws(() => {
      validateBackupFileStructure({ sinMetadata: true });
    }, /sección obligatoria "metadata"/, 'Rechaza falta de metadata');

    assert.throws(() => {
      validateBackupFileStructure({
        metadata: { appName: 'OtraAppDiferente' },
        data: {}
      });
    }, /pertenecer a otra aplicación/, 'Rechaza aplicaciones no compatibles');

    assert.throws(() => {
      validateBackupFileStructure({
        metadata: { appName: 'PAnA V2 AGUA' },
        data: { water_sources: 'no-es-un-arreglo' }
      });
    }, /no tienen formato de lista válida/, 'Rechaza colecciones que no sean arreglos');
  });

  suite.test('Análisis Previo (Dry-Run): Comprueba detección de registros nuevos vs actualización', async (assert) => {
    const payload = {
      metadata: {
        appName: 'PAnA V2 AGUA',
        exportedAt: '2026-10-26T12:00:00.000Z'
      },
      data: {
        sites: [
          { id: 'site-temp-1', name: 'Sitio A', municipality: 'El Carmen' },
          { id: 'site-temp-2', name: 'Sitio B', municipality: 'San Jacinto' }
        ],
        water_sources: [],
        pluviometers: [],
        rainfall_records: [],
        parcels: [],
        crops: [],
        observations: []
      }
    };

    const analysis = await JsonImportService.analyzeImport(payload);
    assert.ok(analysis.diff.sites, 'Calcula diff para sitios');
    assert.strictEqual(analysis.diff.sites.incomingTotal, 2, '2 sitios entrantes detectados');
  });
}
