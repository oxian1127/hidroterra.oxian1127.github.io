/**
 * Pruebas unitarias: Repositorios e Integridad Referencial
 */

import { siteRepository } from '../src/infrastructure/database/repositories/site.repository.js';
import { pluviometerRepository } from '../src/infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../src/infrastructure/database/repositories/rainfall.repository.js';
import { waterSourceRepository } from '../src/infrastructure/database/repositories/water-source.repository.js';
import { assertCanDeletePluviometer, assertCanDeleteSite } from '../src/domain/rules/data-integrity.rules.js';

export function runRepositoriesTests(suite) {
  suite.test('Regla de Integridad: Prohíbe eliminación física de un pluviómetro con mediciones asociadas', (assert) => {
    const pluvId = 'pluv-con-registros-123';
    const fakeRainRecords = [
      { id: 'rain-1', pluviometerId: pluvId, precipitationMm: 25 }
    ];

    assert.throws(() => {
      assertCanDeletePluviometer(pluvId, fakeRainRecords);
    }, /No se puede eliminar físicamente el pluviómetro porque tiene 1 mediciones/, 'Bloquea borrado y exige estado retirado');

    // Sin registros -> permitido
    assert.doesNotThrow(() => {
      assertCanDeletePluviometer('pluv-vacio', []);
    }, 'Permite eliminar pluviómetro sin historial de mediciones');
  });

  suite.test('Regla de Integridad: Prohíbe eliminar comunidad si tiene fuentes o pluviómetros vinculados', (assert) => {
    const siteId = 'site-carmen';
    const fakeSources = [{ id: 's1', siteId: 'site-carmen' }];

    assert.throws(() => {
      assertCanDeleteSite(siteId, { waterSources: fakeSources });
    }, /No se puede eliminar la comunidad o sitio porque tiene elementos vinculados: 1 fuentes de agua/, 'Bloquea borrado de comunidad vinculada');

    assert.doesNotThrow(() => {
      assertCanDeleteSite('site-libre', { waterSources: [], pluviometers: [], parcels: [] });
    }, 'Permite eliminar comunidad libre de dependencias');
  });

  suite.test('Persistencia IndexedDB: Crear, consultar y actualizar registro en repositorio de sitios', async (assert) => {
    const testSite = {
      id: 'test-site-' + Date.now(),
      name: 'Vereda Prueba Unitaria',
      municipality: 'San Jacinto',
      department: 'Bolívar'
    };

    // Crear
    await siteRepository.create(testSite);
    const retrieved = await siteRepository.getById(testSite.id);
    assert.ok(retrieved !== null, 'Registro recuperado de IndexedDB');
    assert.strictEqual(retrieved.name, testSite.name, 'Nombre persistido correctamente');

    // Actualizar
    await siteRepository.update(testSite.id, { name: 'Vereda Prueba Actualizada' });
    const updated = await siteRepository.getById(testSite.id);
    assert.strictEqual(updated.name, 'Vereda Prueba Actualizada', 'Actualización persistida con éxito');

    // Limpieza
    await siteRepository.delete(testSite.id);
    const deleted = await siteRepository.getById(testSite.id);
    assert.strictEqual(deleted, null, 'Registro eliminado tras la prueba');
  });
}
