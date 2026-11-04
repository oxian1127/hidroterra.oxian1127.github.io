/**
 * Interfaz y Repositorio Base (Contrato uniforme para IndexedDB y futura API Nube)
 */

import { idb } from '../indexeddb.js';
import { events } from '../../../core/events.js';
import { nowIso } from '../../../core/date-utils.js';

export class BaseRepository {
  /**
   * @param {string} storeName - Nombre del almacén en IndexedDB
   * @param {string} entityName - Nombre humano de la entidad
   */
  constructor(storeName, entityName) {
    this.storeName = storeName;
    this.entityName = entityName;
  }

  async getAll() {
    return await idb.getAll(this.storeName);
  }

  async getById(id) {
    return await idb.get(this.storeName, id);
  }

  async create(data) {
    const item = {
      ...data,
      createdAt: data.createdAt || nowIso(),
      updatedAt: data.updatedAt || nowIso()
    };
    await idb.put(this.storeName, item);
    events.emit(`${this.entityName}:created`, item);
    events.emit('data:changed', { entity: this.entityName, action: 'create', id: item.id });
    return item;
  }

  async update(id, data) {
    const existing = await this.getById(id);
    const updated = {
      ...existing,
      ...data,
      id,
      updatedAt: nowIso()
    };
    await idb.put(this.storeName, updated);
    events.emit(`${this.entityName}:updated`, updated);
    events.emit('data:changed', { entity: this.entityName, action: 'update', id });
    return updated;
  }

  async delete(id) {
    const existing = await this.getById(id);
    await idb.delete(this.storeName, id);
    events.emit(`${this.entityName}:deleted`, { id, item: existing });
    events.emit('data:changed', { entity: this.entityName, action: 'delete', id });
    return true;
  }

  async count() {
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
    await idb.putBatch(this.storeName, items);
    events.emit(`${this.entityName}:batch_saved`, { count: items.length });
    events.emit('data:changed', { entity: this.entityName, action: 'batch', count: items.length });
    return items;
  }
}
