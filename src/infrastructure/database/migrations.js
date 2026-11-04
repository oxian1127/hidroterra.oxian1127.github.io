/**
 * Manejo de migraciones de esquema para IndexedDB
 */

import { DB_CONFIG } from '../../config/database.config.js';
import { logger } from '../../core/logger.js';

export function runMigrations(db, oldVersion, newVersion) {
  logger.info(`Ejecutando migración de base de datos desde v${oldVersion} a v${newVersion}`);

  // Migración v1 y v2: Asegurar la creación de todos los almacenes configurados (incluyendo weather_cache en v2)
  Object.values(DB_CONFIG.stores).forEach(storeDef => {
    if (!db.objectStoreNames.contains(storeDef.name)) {
      const store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
      storeDef.indexes.forEach(idx => {
        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
      });
      logger.info(`Almacén "${storeDef.name}" creado con éxito.`);
    }
  });

  // Las versiones futuras (v2, v3, etc.) se agregarán aquí condicionalmente
  // sin perder los datos previamente almacenados.
}
