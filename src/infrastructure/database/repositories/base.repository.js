/**
 * Interfaz y Repositorio Base (Contrato uniforme para IndexedDB y Firebase Firestore)
 * Integra aislamiento demostrativo por organizationId, validación de permisos por rol,
 * sincronización centralizada con Firestore y auditoría de operaciones.
 */

import { idb } from '../indexeddb.js';
import { events } from '../../../core/events.js';
import { nowIso } from '../../../core/date-utils.js';
import { syncAdapter } from '../../sync/sync-adapter.js';
import { sessionService } from '../../../core/session.service.js';
import { firebaseService } from '../../../../js/firebase-service.js';
import { auditService } from '../../../application/audit.service.js';
import { inferOrganizationForRecord } from '../../../application/firebase-sync.service.js';
import { PermissionError } from '../../../core/errors.js';

export class BaseRepository {
  /**
   * @param {string} storeName - Nombre del almacén en IndexedDB
   * @param {string} entityName - Nombre humano de la entidad
   */
  constructor(storeName, entityName) {
    this.storeName = storeName;
    this.entityName = entityName;
  }

  /**
   * Obtiene todos los registros en crudo sin filtro de sesión (para análisis y migración)
   */
  async getAllRaw() {
    return await idb.getAll(this.storeName);
  }

  /**
   * Obtiene los registros filtrados según la organización y rol del usuario autenticado
   */
  async getAll() {
    const raw = await idb.getAll(this.storeName);
    const normalized = raw.map(item => {
      if (item && !item.organizationId) {
        const inferred = inferOrganizationForRecord(item, this.storeName);
        if (inferred) {
          return { ...item, organizationId: inferred };
        }
      }
      return item;
    });

    if (sessionService.isAuthenticated()) {
      return sessionService.filterRecordsForCurrentSession(normalized);
    }
    return normalized;
  }

  async getById(id) {
    const item = await idb.get(this.storeName, id);
    if (!item) return null;
    if (!item.organizationId) {
      const inferred = inferOrganizationForRecord(item, this.storeName);
      if (inferred) item.organizationId = inferred;
    }
    return item;
  }

  async create(data) {
    if (sessionService.isAuthenticated() && !sessionService.canCreateRecord(this.entityName)) {
      throw new PermissionError('Su rol actual (Consulta) solo permite visualizar información, no crear nuevos registros.');
    }

    const activeOrgId = data.organizationId
      || inferOrganizationForRecord(data, this.storeName)
      || sessionService.getActiveOrganizationIdForCreation();

    const currentUser = sessionService.getCurrentUser();
    const item = {
      ...data,
      organizationId: activeOrgId || null,
      createdByUserId: data.createdByUserId || currentUser?.id || null,
      createdByUserName: data.createdByUserName || currentUser?.name || null,
      syncStatus: data.syncStatus || 'pending',
      createdAt: data.createdAt || nowIso(),
      updatedAt: data.updatedAt || nowIso()
    };

    await idb.put(this.storeName, item);
    await syncAdapter.enqueueOperation(this.entityName, 'create', item.id, item);

    // Sincronizar con Firestore y registrar auditoría
    const syncRes = await firebaseService.syncStoreRecordToFirestore(this.storeName, item);
    if (syncRes && syncRes._syncedToFirestore) {
      item.syncStatus = 'synced';
      await idb.put(this.storeName, item);
    }

    if (currentUser) {
      await auditService.logEvent({
        user: currentUser,
        organization: sessionService.getCurrentOrganization(),
        module: this.storeName,
        action: 'create',
        recordId: item.id,
        targetOrganizationId: item.organizationId,
        newValues: item,
        details: `Creación de registro en ${this.storeName} (${item.name || item.code || item.id}).`
      });
    }

    events.emit(`${this.entityName}:created`, item);
    events.emit('data:changed', { entity: this.entityName, action: 'create', id: item.id });
    return item;
  }

  async update(id, data) {
    const existing = await this.getById(id);

    if (sessionService.isAuthenticated() && !sessionService.canEditRecord(existing)) {
      throw new PermissionError('No tiene permisos para modificar este registro.');
    }

    const currentUser = sessionService.getCurrentUser();
    const updated = {
      ...existing,
      ...data,
      id,
      organizationId: data.organizationId || existing?.organizationId || sessionService.getActiveOrganizationIdForCreation(),
      updatedByUserId: currentUser?.id || null,
      syncStatus: 'pending',
      updatedAt: nowIso()
    };

    await idb.put(this.storeName, updated);
    await syncAdapter.enqueueOperation(this.entityName, 'update', id, updated);

    const syncRes = await firebaseService.syncStoreRecordToFirestore(this.storeName, updated);
    if (syncRes && syncRes._syncedToFirestore) {
      updated.syncStatus = 'synced';
      await idb.put(this.storeName, updated);
    }

    if (currentUser) {
      await auditService.logEvent({
        user: currentUser,
        organization: sessionService.getCurrentOrganization(),
        module: this.storeName,
        action: 'update',
        recordId: id,
        targetOrganizationId: updated.organizationId,
        previousValues: existing,
        newValues: updated,
        details: `Modificación de registro en ${this.storeName} (${updated.name || updated.code || id}).`
      });
    }

    events.emit(`${this.entityName}:updated`, updated);
    events.emit('data:changed', { entity: this.entityName, action: 'update', id });
    return updated;
  }

  async delete(id) {
    const existing = await this.getById(id);

    if (sessionService.isAuthenticated() && !sessionService.canDeleteRecord(existing)) {
      throw new PermissionError('Su rol actual no tiene permisos para eliminar registros.');
    }

    await idb.delete(this.storeName, id);
    await syncAdapter.enqueueOperation(this.entityName, 'delete', id, existing || { id });
    await firebaseService.deleteStoreRecordFromFirestore(this.storeName, id);

    const currentUser = sessionService.getCurrentUser();
    if (currentUser) {
      await auditService.logEvent({
        user: currentUser,
        organization: sessionService.getCurrentOrganization(),
        module: this.storeName,
        action: 'delete',
        recordId: id,
        targetOrganizationId: existing?.organizationId,
        previousValues: existing,
        details: `Eliminación de registro en ${this.storeName} (${existing?.name || existing?.code || id}).`
      });
    }

    events.emit(`${this.entityName}:deleted`, { id, item: existing });
    events.emit('data:changed', { entity: this.entityName, action: 'delete', id });
    return true;
  }

  async count() {
    const filtered = await this.getAll();
    return filtered.length;
  }

  async countRaw() {
    return await idb.count(this.storeName);
  }

  async clear() {
    await idb.clear(this.storeName);
    events.emit(`${this.entityName}:cleared`);
    events.emit('data:changed', { entity: this.entityName, action: 'clear' });
    return true;
  }

  async saveBatch(items) {
    if (!items || items.length === 0) return [];
    const enriched = items.map(item => ({
      ...item,
      organizationId: item.organizationId || inferOrganizationForRecord(item, this.storeName) || sessionService.getActiveOrganizationIdForCreation()
    }));
    await idb.putBatch(this.storeName, enriched);
    events.emit(`${this.entityName}:batch_saved`, { count: enriched.length });
    events.emit('data:changed', { entity: this.entityName, action: 'batch', count: enriched.length });
    return enriched;
  }
}
