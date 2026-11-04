/**
 * Adaptador y Contratos de Sincronización para Fase 2 (Futura Nube y API REST PostgreSQL/PostGIS)
 * Gestiona la cola local de operaciones pendientes (`sync_queue`), estados de sincronización,
 * detección de conflictos y registro de errores sin simular conexión falsa en la Fase 1.
 */

import { idb } from '../database/indexeddb.js';
import { DB_CONFIG } from '../../config/database.config.js';
import { generateId } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';

export class SyncAdapterInterface {
  /**
   * Verifica el estado del servidor remoto
   * @returns {Promise<{available: boolean, latencyMs: number}>}
   */
  async ping() {
    throw new Error('Método ping() no implementado en Fase 1 (modo local estricto).');
  }

  /**
   * Registra una operación en la cola local de sincronización (`sync_queue`)
   */
  async enqueueOperation(entityName, operationType, recordId, payloadSnapshot = {}) {
    if (!DB_CONFIG.stores.sync_queue) return null;
    try {
      const queueItem = {
        id: generateId(),
        entityName,
        operationType, // 'create' | 'update' | 'delete'
        recordId,
        status: 'pending',
        attempts: 0,
        lastError: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        snapshotTimestamp: payloadSnapshot?.updatedAt || nowIso()
      };
      await idb.put(DB_CONFIG.stores.sync_queue.name, queueItem);
      return queueItem;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene los cambios pendientes de envío hacia el servidor desde `sync_queue`
   * @param {string|null} entityName
   */
  async getPendingChanges(entityName = null) {
    if (!DB_CONFIG.stores.sync_queue) return [];
    try {
      const all = await idb.getAll(DB_CONFIG.stores.sync_queue.name);
      return all.filter(item => {
        const matchStatus = item.status === 'pending' || item.status === 'error';
        const matchEntity = !entityName || item.entityName === entityName;
        return matchStatus && matchEntity;
      });
    } catch {
      return [];
    }
  }

  /**
   * Registra un error de sincronización en un elemento de la cola
   */
  async recordSyncError(queueId, errorMessage) {
    if (!DB_CONFIG.stores.sync_queue) return null;
    const existing = await idb.get(DB_CONFIG.stores.sync_queue.name, queueId);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'error',
      attempts: (existing.attempts || 0) + 1,
      lastError: String(errorMessage),
      updatedAt: nowIso()
    };
    return await idb.put(DB_CONFIG.stores.sync_queue.name, updated);
  }

  /**
   * Detecta si existe conflicto entre el registro local y el remoto
   */
  detectConflict(localRecord, remoteRecord) {
    if (!localRecord || !remoteRecord) return { hasConflict: false };
    const localUpdated = new Date(localRecord.updatedAt || 0).getTime();
    const remoteUpdated = new Date(remoteRecord.updatedAt || 0).getTime();
    const isModifiedBoth = localRecord.syncStatus === 'pending' && remoteUpdated > 0 && localUpdated !== remoteUpdated;
    return {
      hasConflict: isModifiedBoth,
      localUpdatedAt: localRecord.updatedAt,
      remoteUpdatedAt: remoteRecord.updatedAt
    };
  }

  /**
   * Envía lote de registros locales hacia el servidor remoto
   */
  async pushBatch(entityName, records) {
    throw new Error('Método pushBatch() reservado para Fase 2.');
  }

  /**
   * Descarga registros nuevos o modificados desde el servidor remoto
   */
  async pullBatch(entityName, sinceTimestamp) {
    throw new Error('Método pullBatch() reservado para Fase 2.');
  }

  /**
   * Estrategia de resolución de conflictos (Servidor gana / Cliente gana / Marca temporal más reciente)
   */
  resolveConflict(localRecord, remoteRecord, strategy = 'latest-timestamp') {
    if (strategy === 'client-wins') return { ...localRecord, syncStatus: 'pending' };
    if (strategy === 'server-wins') return { ...remoteRecord, syncStatus: 'synced' };
    if (strategy === 'latest-timestamp') {
      const localTime = new Date(localRecord.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteRecord.updatedAt || 0).getTime();
      return remoteTime >= localTime
        ? { ...remoteRecord, syncStatus: 'synced' }
        : { ...localRecord, syncStatus: 'pending' };
    }
    return remoteRecord;
  }
}

/**
 * Adaptador para Fase 1: gestiona la cola local y reporta con transparencia que el servidor remoto no está conectado
 */
export class OfflineOnlySyncAdapter extends SyncAdapterInterface {
  constructor() {
    super();
    this.status = 'offline_only';
  }

  isCloudConfigured() {
    return false;
  }

  getCloudStatus() {
    return {
      connected: false,
      message: 'Fase 1: Datos almacenados estrictamente en el dispositivo local (IndexedDB). Las operaciones se registran con UUID v4, marcas temporales ISO 8601 y cola de sincronización preparada para la Fase 2 (PostgreSQL/PostGIS).'
    };
  }
}

export const syncAdapter = new OfflineOnlySyncAdapter();
