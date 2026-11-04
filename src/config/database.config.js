/**
 * Configuración de la base de datos IndexedDB para HIDROTERRA
 * Conserva el nombre físico 'pana_v2_agua_db' para garantizar compatibilidad y cero pérdida de datos previos.
 */

export const DB_CONFIG = {
  name: 'pana_v2_agua_db',
  version: 3,

  stores: {
    water_sources: {
      name: 'water_sources',
      keyPath: 'id',
      indexes: [
        { name: 'code', keyPath: 'code', unique: true },
        { name: 'siteId', keyPath: 'siteId', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'type', keyPath: 'type', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    water_measurements: {
      name: 'water_measurements',
      keyPath: 'id',
      indexes: [
        { name: 'sourceId', keyPath: 'sourceId', unique: false },
        { name: 'measuredAt', keyPath: 'measuredAt', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false },
        { name: 'status', keyPath: 'status', unique: false }
      ]
    },

    water_alerts: {
      name: 'water_alerts',
      keyPath: 'id',
      indexes: [
        { name: 'ruleCode', keyPath: 'ruleCode', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'priority', keyPath: 'priority', unique: false },
        { name: 'relatedEntityId', keyPath: 'relatedEntityId', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    pluviometers: {
      name: 'pluviometers',
      keyPath: 'id',
      indexes: [
        { name: 'code', keyPath: 'code', unique: true },
        { name: 'siteId', keyPath: 'siteId', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'equipmentType', keyPath: 'equipmentType', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    rainfall_records: {
      name: 'rainfall_records',
      keyPath: 'id',
      indexes: [
        { name: 'pluviometerId', keyPath: 'pluviometerId', unique: false },
        { name: 'measuredAt', keyPath: 'measuredAt', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    sites: {
      name: 'sites',
      keyPath: 'id',
      indexes: [
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'municipality', keyPath: 'municipality', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    parcels: {
      name: 'parcels',
      keyPath: 'id',
      indexes: [
        { name: 'code', keyPath: 'code', unique: false },
        { name: 'siteId', keyPath: 'siteId', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    crops: {
      name: 'crops',
      keyPath: 'id',
      indexes: [
        { name: 'parcelId', keyPath: 'parcelId', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    observations: {
      name: 'observations',
      keyPath: 'id',
      indexes: [
        { name: 'category', keyPath: 'category', unique: false },
        { name: 'observedAt', keyPath: 'observedAt', unique: false },
        { name: 'relatedEntityId', keyPath: 'relatedEntityId', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },

    system_meta: {
      name: 'system_meta',
      keyPath: 'key',
      indexes: []
    },

    weather_cache: {
      name: 'weather_cache',
      keyPath: 'id',
      indexes: [
        { name: 'coordKey', keyPath: 'coordKey', unique: true },
        { name: 'fetchedAt', keyPath: 'fetchedAt', unique: false },
        { name: 'entityId', keyPath: 'entityId', unique: false }
      ]
    },

    sync_queue: {
      name: 'sync_queue',
      keyPath: 'id',
      indexes: [
        { name: 'entityName', keyPath: 'entityName', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    }
  }
};
