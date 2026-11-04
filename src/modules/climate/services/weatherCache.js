/**
 * Servicio y Repositorio de Caché Meteorológica Local (IndexedDB + Fallback LocalStorage)
 * Conserva la filosofía Offline-First de HIDROTERRA permitiendo consultar la última
 * información meteorológica disponible cuando no existe conexión a Internet.
 */

import { idb } from '../../../infrastructure/database/indexeddb.js';
import { WEATHER_CONFIG } from '../config/weatherConfig.js';
import { normalizeCoordKey } from '../utils/weatherValidators.js';
import { logger } from '../../../core/logger.js';

class WeatherCacheRepository {
  constructor() {
    this.storeName = WEATHER_CONFIG.cache.storeName;
    this.fallbackKey = WEATHER_CONFIG.cache.localStorageFallbackKey;
    this.lastLocationKey = WEATHER_CONFIG.cache.lastLocationStorageKey;
  }

  /**
   * Lee el mapa de respaldo en localStorage
   */
  _readFallbackMap() {
    try {
      const raw = localStorage.getItem(this.fallbackKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Escribe el mapa de respaldo en localStorage manteniendo un tamaño acotado
   */
  _writeFallbackMap(mapObj) {
    try {
      const keys = Object.keys(mapObj);
      if (keys.length > WEATHER_CONFIG.cache.maxStoredLocations) {
        // Ordenar por fecha de consulta más antigua y recortar
        const sorted = keys.sort((a, b) => {
          const tA = new Date(mapObj[a]?.fetchedAt || 0).getTime();
          const tB = new Date(mapObj[b]?.fetchedAt || 0).getTime();
          return tB - tA;
        });
        const pruned = {};
        sorted.slice(0, WEATHER_CONFIG.cache.maxStoredLocations).forEach(k => {
          pruned[k] = mapObj[k];
        });
        localStorage.setItem(this.fallbackKey, JSON.stringify(pruned));
      } else {
        localStorage.setItem(this.fallbackKey, JSON.stringify(mapObj));
      }
    } catch (err) {
      logger.warn('No se pudo actualizar mirror de caché climática en localStorage:', err);
    }
  }

  /**
   * Verifica si un registro almacenado sigue vigente según el TTL configurado (en minutos)
   */
  isFresh(record, ttlMinutes = WEATHER_CONFIG.cache.ttlMinutes) {
    if (!record || !record.fetchedAt) return false;
    const fetchedMs = new Date(record.fetchedAt).getTime();
    if (isNaN(fetchedMs)) return false;
    const ageMs = Date.now() - fetchedMs;
    return ageMs >= 0 && ageMs <= ttlMinutes * 60 * 1000;
  }

  /**
   * Recupera el pronóstico almacenado para un par de coordenadas (por clave normalizada)
   */
  async getByCoordinates(lat, lon) {
    const coordKey = normalizeCoordKey(lat, lon);
    if (!coordKey) return null;

    // 1. Intentar desde IndexedDB
    try {
      const db = await idb.init();
      if (db && db.objectStoreNames.contains(this.storeName)) {
        const record = await idb.get(this.storeName, coordKey);
        if (record) return record;
      }
    } catch (err) {
      logger.warn('Lectura de weather_cache en IndexedDB recurrió a fallback local:', err);
    }

    // 2. Fallback en LocalStorage
    const mapObj = this._readFallbackMap();
    return mapObj[coordKey] || null;
  }

  /**
   * Guarda o actualiza (Upsert sin duplicados) una consulta meteorológica en IndexedDB y LocalStorage
   */
  async save(weatherRecord) {
    if (!weatherRecord || !weatherRecord.location) return null;
    const { latitude, longitude } = weatherRecord.location;
    const coordKey = normalizeCoordKey(latitude, longitude);
    if (!coordKey) return null;

    const normalizedRecord = {
      id: coordKey,
      coordKey,
      entityId: weatherRecord.location.entityId || null,
      location: {
        name: weatherRecord.location.name || 'Ubicación consultada',
        latitude: Number(latitude),
        longitude: Number(longitude),
        entityType: weatherRecord.location.entityType || 'coordinates',
        entityId: weatherRecord.location.entityId || null,
        municipality: weatherRecord.location.municipality || ''
      },
      source: weatherRecord.source || 'open-meteo',
      fetchedAt: weatherRecord.fetchedAt || new Date().toISOString(),
      current: weatherRecord.current || {},
      hourly: weatherRecord.hourly || {},
      daily: weatherRecord.daily || {},
      metadata: {
        timezone: WEATHER_CONFIG.api.timezone,
        units: 'metric',
        isForecast: true,
        elevation: weatherRecord.metadata?.elevation ?? null
      }
    };

    // Guardar en mirror LocalStorage
    const mapObj = this._readFallbackMap();
    mapObj[coordKey] = normalizedRecord;
    this._writeFallbackMap(mapObj);

    // Guardar en almacén dedicado IndexedDB y podar exceso de ubicaciones antiguas
    try {
      const db = await idb.init();
      if (db && db.objectStoreNames.contains(this.storeName)) {
        await idb.put(this.storeName, normalizedRecord);
        await this._pruneIndexedDBIfNeeded();
      }
    } catch (err) {
      logger.warn('Guardado en IndexedDB weather_cache operó sobre fallback local:', err);
    }

    return normalizedRecord;
  }

  /**
   * Evita consumo excesivo de almacenamiento en IndexedDB manteniendo máximo maxStoredLocations
   */
  async _pruneIndexedDBIfNeeded() {
    try {
      const all = await idb.getAll(this.storeName);
      if (all.length > WEATHER_CONFIG.cache.maxStoredLocations) {
        const sorted = all.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
        const toDelete = sorted.slice(WEATHER_CONFIG.cache.maxStoredLocations);
        for (const oldItem of toDelete) {
          await idb.delete(this.storeName, oldItem.id);
        }
      }
    } catch {
      // Ignorar errores de limpieza en segundo plano
    }
  }

  /**
   * Obtiene todas las consultas meteorológicas guardadas en caché ordenadas por fecha reciente
   */
  async getAllCached() {
    try {
      const db = await idb.init();
      if (db && db.objectStoreNames.contains(this.storeName)) {
        const list = await idb.getAll(this.storeName);
        if (list && list.length > 0) {
          return list.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
        }
      }
    } catch {
      // Fallback
    }

    const mapObj = this._readFallbackMap();
    return Object.values(mapObj).sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }

  /**
   * Guarda la última ubicación consultada por el usuario para restaurarla al abrir el módulo
   */
  saveLastLocation(locationObj) {
    try {
      if (locationObj && locationObj.latitude !== undefined && locationObj.longitude !== undefined) {
        localStorage.setItem(this.lastLocationKey, JSON.stringify(locationObj));
      }
    } catch {
      // Ignorar
    }
  }

  /**
   * Recupera la última ubicación consultada por el usuario
   */
  getLastLocation() {
    try {
      const raw = localStorage.getItem(this.lastLocationKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const weatherCache = new WeatherCacheRepository();

