/**
 * Servicio centralizado de operaciones con Firebase Firestore para HIDROTERRA
 * Todas las lecturas, escrituras y lotes hacia Firestore pasan exclusivamente por este módulo.
 * Mantiene además un espejo local en IndexedDB (system_meta) para garantizar resiliencia Offline-First.
 */

import {
  getFirebaseInstance,
  FIRESTORE_COLLECTIONS,
  STORE_TO_FIRESTORE_COLLECTION
} from './firebase-config.js';
import { idb } from '../src/infrastructure/database/indexeddb.js';
import { events } from '../src/core/events.js';
import { logger } from '../src/core/logger.js';
import { nowIso } from '../src/core/date-utils.js';

const LOCAL_MIRROR_PREFIX = 'firestore_mirror_';
const MAX_BATCH_SIZE = 400; // Límite seguro inferior al máximo de 500 operaciones por lote de Firestore

class FirebaseService {
  constructor() {
    this.status = 'connecting'; // 'connected' | 'connecting' | 'offline' | 'error'
    this.lastSyncAt = null;
    this.lastError = null;
  }

  _setStatus(newStatus, errorMsg = null) {
    this.status = newStatus;
    if (errorMsg) {
      this.lastError = errorMsg;
    } else if (newStatus === 'connected') {
      this.lastError = null;
      this.lastSyncAt = nowIso();
    }
    events.emit('firebase:status', {
      status: this.status,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError
    });
  }

  getStatus() {
    return {
      status: this.status,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError
    };
  }

  /**
   * Lee el espejo local almacenado en IndexedDB (system_meta) para una colección administrativa
   */
  async _getLocalMirror(collectionName) {
    try {
      const entry = await idb.get('system_meta', `${LOCAL_MIRROR_PREFIX}${collectionName}`);
      return Array.isArray(entry?.items) ? entry.items : [];
    } catch {
      return [];
    }
  }

  /**
   * Actualiza el espejo local almacenado en IndexedDB (system_meta)
   */
  async _setLocalMirror(collectionName, items) {
    try {
      await idb.put('system_meta', {
        key: `${LOCAL_MIRROR_PREFIX}${collectionName}`,
        items: Array.isArray(items) ? items : [],
        updatedAt: nowIso()
      });
    } catch (err) {
      logger.warn(`No se pudo guardar espejo local para ${collectionName}`, err);
    }
  }

  async _upsertInLocalMirror(collectionName, docId, data) {
    const items = await this._getLocalMirror(collectionName);
    const record = { ...data, id: docId };
    const idx = items.findIndex(item => String(item.id) === String(docId));
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...record };
    } else {
      items.push(record);
    }
    await this._setLocalMirror(collectionName, items);
    return record;
  }

  async _deleteFromLocalMirror(collectionName, docId) {
    const items = await this._getLocalMirror(collectionName);
    const filtered = items.filter(item => String(item.id) !== String(docId));
    await this._setLocalMirror(collectionName, filtered);
  }

  /**
   * Limpia valores undefined antes de enviar a Firestore
   */
  _sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this._sanitizeForFirestore(item));
    }
    const clean = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = this._sanitizeForFirestore(val);
      }
    });
    return clean;
  }

  /**
   * Comprueba la conexión real con Firestore
   */
  async checkConnection() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._setStatus('offline', 'Sin conexión a Internet');
      return { connected: false, status: 'offline' };
    }

    const { db, sdk, available, error } = await getFirebaseInstance();
    if (!available || !db || !sdk) {
      this._setStatus('offline', error?.message || 'SDK de Firebase no disponible');
      return { connected: false, status: 'offline', error: error?.message };
    }

    try {
      const ref = sdk.doc(db, FIRESTORE_COLLECTIONS.app_settings, 'connection_probe');
      await sdk.getDoc(ref);
      this._setStatus('connected');
      return { connected: true, status: 'connected' };
    } catch (err) {
      this._setStatus('error', err.message);
      return { connected: false, status: 'error', error: err.message };
    }
  }

  /**
   * Obtiene un documento por su ID desde una colección de Firestore
   */
  async getDocument(collectionName, docId) {
    if (!docId) return null;
    const { db, sdk, available } = await getFirebaseInstance();

    if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const docRef = sdk.doc(db, collectionName, String(docId));
        const snap = await sdk.getDoc(docRef);
        this._setStatus('connected');
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          await this._upsertInLocalMirror(collectionName, snap.id, data);
          return data;
        }
        return null;
      } catch (err) {
        logger.warn(`Fallback a espejo local al leer ${collectionName}/${docId}: ${err.message}`);
        this._setStatus('error', err.message);
      }
    }

    const localItems = await this._getLocalMirror(collectionName);
    return localItems.find(item => String(item.id) === String(docId)) || null;
  }

  /**
   * Obtiene todos los documentos de una colección de Firestore (o filtrados por organizationId)
   */
  async getCollection(collectionName, filters = {}) {
    const { db, sdk, available } = await getFirebaseInstance();

    if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const colRef = sdk.collection(db, collectionName);
        let q = colRef;

        if (filters.organizationId) {
          q = sdk.query(colRef, sdk.where('organizationId', '==', filters.organizationId));
        } else if (filters.field && filters.value !== undefined) {
          q = sdk.query(colRef, sdk.where(filters.field, '==', filters.value));
        }

        const snap = await sdk.getDocs(q);
        const results = [];
        snap.forEach(docSnap => {
          results.push({ id: docSnap.id, ...docSnap.data() });
        });

        this._setStatus('connected');

        if (!filters.organizationId && !filters.field) {
          await this._setLocalMirror(collectionName, results);
        } else {
          // Actualizar elementos individuales en el espejo local
          for (const item of results) {
            await this._upsertInLocalMirror(collectionName, item.id, item);
          }
        }

        return results;
      } catch (err) {
        logger.warn(`Fallback a espejo local al consultar colección ${collectionName}: ${err.message}`);
        this._setStatus('error', err.message);
      }
    }

    let localItems = await this._getLocalMirror(collectionName);
    if (filters.organizationId) {
      localItems = localItems.filter(item => item.organizationId === filters.organizationId);
    } else if (filters.field && filters.value !== undefined) {
      localItems = localItems.filter(item => item[filters.field] === filters.value);
    }
    return localItems;
  }

  /**
   * Crea o reemplaza (con merge opcional) un documento en Firestore y en el espejo local
   */
  async setDocument(collectionName, docId, data, merge = true) {
    const cleanId = String(docId || data?.id || crypto.randomUUID());
    const payload = this._sanitizeForFirestore({
      ...data,
      id: cleanId,
      updatedAt: data?.updatedAt || nowIso()
    });

    await this._upsertInLocalMirror(collectionName, cleanId, payload);

    const { db, sdk, available } = await getFirebaseInstance();
    if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const docRef = sdk.doc(db, collectionName, cleanId);
        await sdk.setDoc(docRef, payload, { merge });
        this._setStatus('connected');
        return { ...payload, _syncedToFirestore: true };
      } catch (err) {
        logger.error(`Error al escribir en Firestore (${collectionName}/${cleanId})`, err);
        this._setStatus('error', err.message);
        return { ...payload, _syncedToFirestore: false, _syncError: err.message };
      }
    } else {
      this._setStatus('offline');
      return { ...payload, _syncedToFirestore: false };
    }
  }

  /**
   * Elimina un documento de Firestore y del espejo local
   */
  async deleteDocument(collectionName, docId) {
    if (!docId) return false;
    const cleanId = String(docId);
    await this._deleteFromLocalMirror(collectionName, cleanId);

    const { db, sdk, available } = await getFirebaseInstance();
    if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const docRef = sdk.doc(db, collectionName, cleanId);
        await sdk.deleteDoc(docRef);
        this._setStatus('connected');
        return true;
      } catch (err) {
        logger.error(`Error al eliminar en Firestore (${collectionName}/${cleanId})`, err);
        this._setStatus('error', err.message);
        return false;
      }
    }
    return true;
  }

  /**
   * Escritura por lotes idempotente en Firestore respetando el límite de 500 operaciones por batch.
   * @param {Array<{collection: string, id: string, data: object}>} operations
   * @param {function} onProgress - Callback opcional (processed, total)
   */
  async batchUpsert(operations, onProgress = null) {
    if (!Array.isArray(operations) || operations.length === 0) {
      return { total: 0, succeeded: 0, failed: 0, errors: [] };
    }

    const total = operations.length;
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    // Actualizar espejo local primero
    for (const op of operations) {
      const cleanId = String(op.id || op.data?.id);
      await this._upsertInLocalMirror(op.collection, cleanId, { ...op.data, id: cleanId });
    }

    const { db, sdk, available } = await getFirebaseInstance();
    if (!available || !db || !sdk || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      this._setStatus('offline', 'Sin conexión activa a Firestore durante la escritura por lotes.');
      return {
        total,
        succeeded: 0,
        failed: total,
        errors: ['No hay conexión disponible con Firebase Firestore. Verifique su conexión a Internet.']
      };
    }

    for (let i = 0; i < total; i += MAX_BATCH_SIZE) {
      const chunk = operations.slice(i, i + MAX_BATCH_SIZE);
      try {
        const batch = sdk.writeBatch(db);
        chunk.forEach(op => {
          const cleanId = String(op.id || op.data?.id);
          const docRef = sdk.doc(db, op.collection, cleanId);
          const cleanData = this._sanitizeForFirestore({
            ...op.data,
            id: cleanId,
            updatedAt: op.data?.updatedAt || nowIso()
          });
          batch.set(docRef, cleanData, { merge: true });
        });
        await batch.commit();
        succeeded += chunk.length;
        this._setStatus('connected');
      } catch (err) {
        failed += chunk.length;
        errors.push(`Error en lote [${i + 1} - ${Math.min(i + chunk.length, total)}]: ${err.message}`);
        this._setStatus('error', err.message);
      }

      if (typeof onProgress === 'function') {
        onProgress(Math.min(i + chunk.length, total), total);
      }
    }

    return { total, succeeded, failed, errors };
  }

  /**
   * Sincroniza los almacenes operativos desde Firestore hacia IndexedDB local
   * para que todos los módulos existentes dispongan de los datos centralizados.
   */
  async pullOperationalDataToIndexedDB(organizationId = null) {
    const { db, sdk, available } = await getFirebaseInstance();
    if (!available || !db || !sdk || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { synced: false, reason: 'offline' };
    }

    const summary = {};
    try {
      for (const [storeName, collectionName] of Object.entries(STORE_TO_FIRESTORE_COLLECTION)) {
        const filters = organizationId ? { organizationId } : {};
        const remoteDocs = await this.getCollection(collectionName, filters);
        if (Array.isArray(remoteDocs) && remoteDocs.length > 0) {
          const markedDocs = remoteDocs.map(docItem => ({
            ...docItem,
            syncStatus: 'synced'
          }));
          await idb.putBatch(storeName, markedDocs);
        }
        summary[storeName] = remoteDocs.length;
      }
      this._setStatus('connected');
      return { synced: true, summary };
    } catch (err) {
      logger.warn('Error parcial al descargar datos operativos desde Firestore', err);
      return { synced: false, error: err.message, summary };
    }
  }

  /**
   * Sincroniza un registro operativo individual desde un repositorio hacia su colección en Firestore
   */
  async syncStoreRecordToFirestore(storeName, record) {
    const collectionName = STORE_TO_FIRESTORE_COLLECTION[storeName];
    if (!collectionName || !record || !record.id) return null;
    return await this.setDocument(collectionName, record.id, {
      ...record,
      syncStatus: 'synced'
    }, true);
  }

  /**
   * Elimina un registro operativo individual de su colección en Firestore
   */
  async deleteStoreRecordFromFirestore(storeName, recordId) {
    const collectionName = STORE_TO_FIRESTORE_COLLECTION[storeName];
    if (!collectionName || !recordId) return false;
    return await this.deleteDocument(collectionName, recordId);
  }

  /**
   * Vacía colecciones en Firebase Firestore y en el espejo local por lotes (máx. 400 operaciones por lote).
   * Permite filtrar opcionalmente por organizationId si solo se desea limpiar una organización específica.
   * @param {string[]} collectionNames - Lista de colecciones de Firestore a vaciar
   * @param {string|null} organizationId - ID de organización opcional ('all' o null para vaciar todo)
   * @param {function|null} onProgress - Callback opcional (deletedCount, totalFound)
   */
  async clearCollections(collectionNames, organizationId = null, onProgress = null) {
    const targetOrg = organizationId && organizationId !== 'all' ? organizationId : null;
    const { db, sdk, available } = await getFirebaseInstance();

    const docsToDelete = [];
    const perCollectionCount = {};

    for (const colName of collectionNames) {
      perCollectionCount[colName] = 0;

      // Limpiar espejo local en IndexedDB (system_meta)
      const mirrorItems = await this._getLocalMirror(colName);
      if (targetOrg) {
        const remaining = mirrorItems.filter(item => item.organizationId !== targetOrg);
        await this._setLocalMirror(colName, remaining);
      } else {
        await this._setLocalMirror(colName, []);
      }

      if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
        try {
          const colRef = sdk.collection(db, colName);
          const q = targetOrg
            ? sdk.query(colRef, sdk.where('organizationId', '==', targetOrg))
            : colRef;
          const snap = await sdk.getDocs(q);
          snap.forEach(docSnap => {
            docsToDelete.push({ collection: colName, id: docSnap.id, ref: docSnap.ref });
            perCollectionCount[colName] += 1;
          });
        } catch (err) {
          logger.warn(`Error al listar colección ${colName} para vaciado: ${err.message}`);
        }
      }
    }

    const total = docsToDelete.length;
    let deleted = 0;
    let failed = 0;
    const errors = [];

    if (total === 0) {
      if (typeof onProgress === 'function') onProgress(0, 0);
      return { total: 0, deleted: 0, failed: 0, perCollectionCount, errors };
    }

    if (available && db && sdk && (typeof navigator === 'undefined' || navigator.onLine)) {
      for (let i = 0; i < total; i += MAX_BATCH_SIZE) {
        const chunk = docsToDelete.slice(i, i + MAX_BATCH_SIZE);
        try {
          const batch = sdk.writeBatch(db);
          chunk.forEach(item => {
            batch.delete(item.ref);
          });
          await batch.commit();
          deleted += chunk.length;
          this._setStatus('connected');
        } catch (err) {
          failed += chunk.length;
          errors.push(`Error eliminando lote [${i + 1} - ${Math.min(i + chunk.length, total)}]: ${err.message}`);
          this._setStatus('error', err.message);
        }

        if (typeof onProgress === 'function') {
          onProgress(Math.min(i + chunk.length, total), total);
        }
      }
    }

    return { total, deleted, failed, perCollectionCount, errors };
  }
}

export const firebaseService = new FirebaseService();
export { FIRESTORE_COLLECTIONS, STORE_TO_FIRESTORE_COLLECTION };

