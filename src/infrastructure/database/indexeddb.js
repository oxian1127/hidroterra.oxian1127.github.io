/**
 * Conexión y operaciones de bajo nivel sobre IndexedDB para PAnA V2 AGUA
 */

import { DB_CONFIG } from '../../config/database.config.js';
import { runMigrations } from './migrations.js';
import { StorageError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { events } from '../../core/events.js';

class IndexedDBAdapter {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Inicializa la conexión con IndexedDB
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        const err = new StorageError('IndexedDB no está soportado en este entorno de navegador.');
        logger.error(err.message);
        return reject(err);
      }

      const request = window.indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        try {
          runMigrations(db, event.oldVersion, event.newVersion, event.target.transaction);
        } catch (mErr) {
          logger.error('Error durante la migración de esquema', mErr);
          reject(new StorageError('Fallo al migrar esquema de base de datos local.', mErr));
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        logger.info(`Base de datos IndexedDB "${DB_CONFIG.name}" inicializada correctamente.`);
        events.emit('database:ready', { dbName: DB_CONFIG.name, version: DB_CONFIG.version });
        resolve(this.db);
      };

      request.onerror = (event) => {
        const err = new StorageError('Error al abrir la base de datos local IndexedDB.', event.target.error);
        logger.error(err.message, event.target.error);
        events.emit('database:error', err);
        reject(err);
      };

      request.onblocked = () => {
        logger.warn('La apertura de la base de datos está bloqueada por otra pestaña abierta.');
      };
    });

    return this.initPromise;
  }

  /**
   * Obtiene todos los registros de un almacén
   */
  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new StorageError(`Error al leer datos de "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al acceder a "${storeName}"`, err));
      }
    });
  }

  /**
   * Obtiene un registro por su clave primaria
   */
  async get(storeName, key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(new StorageError(`Error al obtener registro ${key} de "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al obtener registro de "${storeName}"`, err));
      }
    });
  }

  /**
   * Guarda o actualiza un registro (Upsert)
   */
  async put(storeName, item) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve(item);
        request.onerror = () => reject(new StorageError(`Error al guardar en "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al guardar en "${storeName}"`, err));
      }
    });
  }

  /**
   * Inserta o actualiza un lote de registros dentro de una sola transacción
   */
  async putBatch(storeName, items) {
    if (!items || items.length === 0) return [];
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => resolve(items);
        transaction.onerror = () => reject(new StorageError(`Error en lote sobre "${storeName}"`, transaction.error));

        items.forEach(item => store.put(item));
      } catch (err) {
        reject(new StorageError(`Excepción en transacción por lotes sobre "${storeName}"`, err));
      }
    });
  }

  /**
   * Elimina un registro por clave
   */
  async delete(storeName, key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new StorageError(`Error al eliminar de "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al eliminar de "${storeName}"`, err));
      }
    });
  }

  /**
   * Limpia todos los registros de un almacén
   */
  async clear(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new StorageError(`Error al limpiar "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al limpiar "${storeName}"`, err));
      }
    });
  }

  /**
   * Cuenta los registros en un almacén
   */
  async count(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(new StorageError(`Error al contar en "${storeName}"`, request.error));
      } catch (err) {
        reject(new StorageError(`Excepción al contar en "${storeName}"`, err));
      }
    });
  }
}

export const idb = new IndexedDBAdapter();
