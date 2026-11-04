/**
 * Manejo de migraciones versionadas de esquema para IndexedDB — HIDROTERRA
 */

import { DB_CONFIG } from '../../config/database.config.js';
import { logger } from '../../core/logger.js';

export function runMigrations(db, oldVersion, newVersion, transaction = null) {
  logger.info(`Ejecutando migración de base de datos HIDROTERRA desde v${oldVersion} a v${newVersion}`);

  // Migración incremental no destructiva (v1 -> v2 -> v3):
  // Crea los almacenes nuevos (como water_measurements, water_alerts, sync_queue en v3)
  // y garantiza los índices definidos sin eliminar ni alterar los registros existentes.
  Object.values(DB_CONFIG.stores).forEach(storeDef => {
    let store = null;

    if (!db.objectStoreNames.contains(storeDef.name)) {
      store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
      logger.info(`Almacén "${storeDef.name}" creado con éxito (v${newVersion}).`);
    } else if (transaction) {
      try {
        store = transaction.objectStore(storeDef.name);
      } catch {
        store = null;
      }
    }

    if (store && Array.isArray(storeDef.indexes)) {
      storeDef.indexes.forEach(idx => {
        if (!store.indexNames.contains(idx.name)) {
          store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
          logger.info(`Índice "${idx.name}" asegurado en almacén "${storeDef.name}".`);
        }
      });
    }
  });
}
