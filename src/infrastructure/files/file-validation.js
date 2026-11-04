/**
 * Validación estricta de estructura y tipos para archivos JSON importados
 */

import { ValidationError } from '../../core/errors.js';

export function validateBackupFileStructure(parsedData) {
  if (!parsedData || typeof parsedData !== 'object') {
    throw new ValidationError('El archivo no contiene un objeto JSON válido.');
  }

  // Comprobar metadatos mínimos
  if (!parsedData.metadata) {
    throw new ValidationError('El archivo no contiene la sección obligatoria "metadata".');
  }

  const { metadata, data } = parsedData;

  if (metadata.appName && !metadata.appName.includes('PAnA') && !metadata.appName.includes('HIDROTERRA')) {
    throw new ValidationError(`El archivo parece pertenecer a otra aplicación ("${metadata.appName}"). Solo se admiten respaldos de HIDROTERRA / PAnA AGUA.`);
  }

  if (!data || typeof data !== 'object') {
    throw new ValidationError('El archivo no contiene el bloque de entidades "data".');
  }

  // Validar que las colecciones presentes sean arreglos
  const expectedCollections = ['water_sources', 'pluviometers', 'rainfall_records', 'sites', 'parcels', 'crops', 'observations'];
  const presentCollections = Object.keys(data);

  const invalidCollections = presentCollections.filter(c => expectedCollections.includes(c) && !Array.isArray(data[c]));
  if (invalidCollections.length > 0) {
    throw new ValidationError(`Las siguientes entidades no tienen formato de lista válida: ${invalidCollections.join(', ')}`);
  }

  return {
    valid: true,
    metadata,
    collectionsPresent: presentCollections.filter(c => expectedCollections.includes(c) && Array.isArray(data[c]))
  };
}
