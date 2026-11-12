/**
 * Servicio Prioritario de Sincronización y Migración de Datos Locales hacia Firebase Firestore
 * (Sección 9 — Sincronización Idempotente de Datos Locales con Firestore)
 *
 * Funcionalidades:
 * 1. Analizar datos locales en IndexedDB (clasificación por módulo, detección de duplicados y registros sin organización).
 * 2. Clasificación manual por el Superadministrador de registros sin organización identificada (sin asignaciones arbitrarias).
 * 3. Vista previa de migración detallada sin alterar los datos originales.
 * 4. Sincronización idempotente por lotes hacia Firestore conservando IDs, fechas y coordenadas GPS.
 * 5. Historial de sincronizaciones en Firestore y espejo local.
 */

import { idb } from '../infrastructure/database/indexeddb.js';
import {
  firebaseService,
  FIRESTORE_COLLECTIONS,
  STORE_TO_FIRESTORE_COLLECTION
} from '../../js/firebase-service.js';
import {
  sessionService,
  IDENTIFIED_BASE_ORGANIZATIONS
} from '../core/session.service.js';
import { auditService } from './audit.service.js';
import { JsonExportService } from '../infrastructure/files/json-export.js';
import { nowIso } from '../core/date-utils.js';
import { generateId } from '../core/validators.js';

export const MODULE_SYNC_METADATA = [
  {
    storeName: 'rainfall_records',
    firestoreCollection: FIRESTORE_COLLECTIONS.rain_events,
    label: 'Registros de Lluvias (rain_events)',
    shortLabel: 'Registros de lluvias'
  },
  {
    storeName: 'pluviometers',
    firestoreCollection: FIRESTORE_COLLECTIONS.pluviometers,
    label: 'Pluviómetros (pluviometers)',
    shortLabel: 'Pluviómetros'
  },
  {
    storeName: 'water_sources',
    firestoreCollection: FIRESTORE_COLLECTIONS.water_sources,
    label: 'Fuentes Hídricas (water_sources)',
    shortLabel: 'Fuentes hídricas'
  },
  {
    storeName: 'water_measurements',
    firestoreCollection: FIRESTORE_COLLECTIONS.water_measurements,
    label: 'Mediciones de Agua (water_measurements)',
    shortLabel: 'Mediciones'
  },
  {
    storeName: 'water_alerts',
    firestoreCollection: FIRESTORE_COLLECTIONS.water_alerts,
    label: 'Alertas Hídricas (water_alerts)',
    shortLabel: 'Alertas hídricas'
  },
  {
    storeName: 'sites',
    firestoreCollection: FIRESTORE_COLLECTIONS.sites,
    label: 'Sitios y Comunidades (sites)',
    shortLabel: 'Sitios y comunidades'
  },
  {
    storeName: 'parcels',
    firestoreCollection: FIRESTORE_COLLECTIONS.parcels,
    label: 'Parcelas Productivas (parcels)',
    shortLabel: 'Parcelas'
  },
  {
    storeName: 'crops',
    firestoreCollection: FIRESTORE_COLLECTIONS.crops,
    label: 'Cultivos Asociados (crops)',
    shortLabel: 'Cultivos'
  },
  {
    storeName: 'observations',
    firestoreCollection: FIRESTORE_COLLECTIONS.observations,
    label: 'Observaciones Hídricas (observations)',
    shortLabel: 'Observaciones'
  }
];

// Mapas deterministas basados estrictamente en los datos reales existentes en HIDROTERRA
const KNOWN_SITE_TO_ORG = {
  'site-carmen-caracoli': 'org-comite-agua-caracoli',
  'site-sanjacinto-palmas': 'org-asociacion-las-palmas',
  'site-sanjuan-sanpedro': 'org-comite-ambiental-colorados',
  'site-ovejas-canutalito': 'org-jac-canutalito'
};

const KNOWN_SOURCE_TO_ORG = {
  'source-001': 'org-comite-agua-caracoli',
  'source-002': 'org-asociacion-las-palmas',
  'source-003': 'org-comite-ambiental-colorados',
  'source-004': 'org-jac-canutalito'
};

const KNOWN_PLUV_TO_ORG = {
  'pluv-001': 'org-comite-agua-caracoli',
  'pluv-002': 'org-asociacion-las-palmas',
  'pluv-003': 'org-comite-ambiental-colorados',
  'pluv-004': 'org-jac-canutalito'
};

const KNOWN_PARCEL_TO_ORG = {
  'parcel-001': 'org-comite-agua-caracoli',
  'parcel-002': 'org-asociacion-las-palmas',
  'parcel-003': 'org-jac-canutalito'
};

/**
 * Infiere con certeza el organizationId de un registro a partir de las relaciones y responsables reales.
 * Si no se puede identificar con certeza, devuelve null (pendiente de asignación).
 */
export function inferOrganizationForRecord(record, storeName = '', contextMaps = null) {
  if (!record || typeof record !== 'object') return null;

  if (record.organizationId && String(record.organizationId).trim()) {
    return String(record.organizationId).trim();
  }

  // 1. Si es un sitio conocido
  if (storeName === 'sites' && KNOWN_SITE_TO_ORG[record.id]) {
    return KNOWN_SITE_TO_ORG[record.id];
  }

  // 2. Por siteId directo
  if (record.siteId) {
    if (KNOWN_SITE_TO_ORG[record.siteId]) {
      return KNOWN_SITE_TO_ORG[record.siteId];
    }
    if (contextMaps?.siteOrgMap?.has(record.siteId)) {
      return contextMaps.siteOrgMap.get(record.siteId);
    }
  }

  // 3. Por sourceId (mediciones de agua)
  if (record.sourceId) {
    if (KNOWN_SOURCE_TO_ORG[record.sourceId]) {
      return KNOWN_SOURCE_TO_ORG[record.sourceId];
    }
    if (contextMaps?.sourceOrgMap?.has(record.sourceId)) {
      return contextMaps.sourceOrgMap.get(record.sourceId);
    }
  }

  // 4. Por pluviometerId (registros de lluvia)
  if (record.pluviometerId) {
    if (KNOWN_PLUV_TO_ORG[record.pluviometerId]) {
      return KNOWN_PLUV_TO_ORG[record.pluviometerId];
    }
    if (contextMaps?.pluvOrgMap?.has(record.pluviometerId)) {
      return contextMaps.pluvOrgMap.get(record.pluviometerId);
    }
  }

  // 5. Por parcelId (cultivos)
  if (record.parcelId) {
    if (KNOWN_PARCEL_TO_ORG[record.parcelId]) {
      return KNOWN_PARCEL_TO_ORG[record.parcelId];
    }
    if (contextMaps?.parcelOrgMap?.has(record.parcelId)) {
      return contextMaps.parcelOrgMap.get(record.parcelId);
    }
  }

  // 6. Por relatedEntityId (alertas y observaciones)
  if (record.relatedEntityId) {
    const relId = record.relatedEntityId;
    if (KNOWN_SOURCE_TO_ORG[relId]) return KNOWN_SOURCE_TO_ORG[relId];
    if (KNOWN_PLUV_TO_ORG[relId]) return KNOWN_PLUV_TO_ORG[relId];
    if (KNOWN_PARCEL_TO_ORG[relId]) return KNOWN_PARCEL_TO_ORG[relId];
    if (KNOWN_SITE_TO_ORG[relId]) return KNOWN_SITE_TO_ORG[relId];
    if (contextMaps?.sourceOrgMap?.has(relId)) return contextMaps.sourceOrgMap.get(relId);
    if (contextMaps?.pluvOrgMap?.has(relId)) return contextMaps.pluvOrgMap.get(relId);
    if (contextMaps?.parcelOrgMap?.has(relId)) return contextMaps.parcelOrgMap.get(relId);
  }

  // 7. Por nombre exacto del responsable en los registros existentes
  if (record.responsible) {
    const respClean = String(record.responsible).trim().toLowerCase();
    for (const org of IDENTIFIED_BASE_ORGANIZATIONS) {
      const matched = org.knownResponsibles.some(kr => kr.toLowerCase() === respClean);
      if (matched) return org.id;
    }
  }

  return null;
}

export class FirebaseSyncService {
  /**
   * 1. Analiza todos los datos almacenados localmente en IndexedDB
   */
  static async analyzeLocalData() {
    const organizations = await sessionService.getOrganizations(true);
    const orgMap = new Map(organizations.map(o => [o.id, o]));

    // Cargar todos los almacenes locales en crudo desde IndexedDB
    const rawStores = {};
    for (const mod of MODULE_SYNC_METADATA) {
      rawStores[mod.storeName] = await idb.getAll(mod.storeName);
    }

    // Construir mapas relacionales para inferir organización de entidades hijas con certeza
    const siteOrgMap = new Map();
    (rawStores.sites || []).forEach(s => {
      const orgId = inferOrganizationForRecord(s, 'sites');
      if (orgId) siteOrgMap.set(s.id, orgId);
    });

    const sourceOrgMap = new Map();
    (rawStores.water_sources || []).forEach(src => {
      const orgId = inferOrganizationForRecord(src, 'water_sources', { siteOrgMap });
      if (orgId) sourceOrgMap.set(src.id, orgId);
    });

    const pluvOrgMap = new Map();
    (rawStores.pluviometers || []).forEach(plv => {
      const orgId = inferOrganizationForRecord(plv, 'pluviometers', { siteOrgMap });
      if (orgId) pluvOrgMap.set(plv.id, orgId);
    });

    const parcelOrgMap = new Map();
    (rawStores.parcels || []).forEach(prc => {
      const orgId = inferOrganizationForRecord(prc, 'parcels', { siteOrgMap });
      if (orgId) parcelOrgMap.set(prc.id, orgId);
    });

    const contextMaps = { siteOrgMap, sourceOrgMap, pluvOrgMap, parcelOrgMap };

    let totalRecords = 0;
    let assignedCount = 0;
    let unassignedCount = 0;
    let duplicateCount = 0;
    let alreadySyncedCount = 0;

    const byModule = {};
    const byOrganization = {};
    const unassignedRecords = [];
    const duplicateRecords = [];
    const preparedRecordsByStore = {};

    organizations.forEach(o => {
      byOrganization[o.id] = {
        organizationId: o.id,
        organizationName: o.name,
        municipality: o.municipality,
        count: 0,
        byStore: {}
      };
    });

    for (const mod of MODULE_SYNC_METADATA) {
      const records = rawStores[mod.storeName] || [];
      const seenIds = new Set();
      const seenNaturalKeys = new Set();

      let modAssigned = 0;
      let modUnassigned = 0;
      let modDuplicates = 0;
      let modSynced = 0;
      const preparedList = [];

      for (const rec of records) {
        totalRecords++;

        // Detectar duplicados por ID o clave natural (ej. código o pluviometerId+measuredAt)
        const naturalKey = rec.code
          ? `code:${String(rec.code).trim().toUpperCase()}`
          : (rec.pluviometerId && rec.measuredAt)
            ? `rain:${rec.pluviometerId}_${rec.measuredAt}`
            : (rec.sourceId && rec.measuredAt)
              ? `wmeas:${rec.sourceId}_${rec.measuredAt}`
              : null;

        let isDuplicate = false;
        if (seenIds.has(rec.id) || (naturalKey && seenNaturalKeys.has(naturalKey))) {
          isDuplicate = true;
          modDuplicates++;
          duplicateCount++;
          duplicateRecords.push({
            storeName: mod.storeName,
            moduleLabel: mod.shortLabel,
            id: rec.id,
            naturalKey: naturalKey || rec.id,
            label: rec.name || rec.code || rec.description || rec.id
          });
        } else {
          seenIds.add(rec.id);
          if (naturalKey) seenNaturalKeys.add(naturalKey);
        }

        const resolvedOrgId = inferOrganizationForRecord(rec, mod.storeName, contextMaps);
        const orgObj = resolvedOrgId ? orgMap.get(resolvedOrgId) : null;

        if (rec.syncStatus === 'synced') {
          modSynced++;
          alreadySyncedCount++;
        }

        if (resolvedOrgId && orgObj) {
          modAssigned++;
          assignedCount++;
          if (byOrganization[resolvedOrgId]) {
            byOrganization[resolvedOrgId].count++;
            byOrganization[resolvedOrgId].byStore[mod.storeName] =
              (byOrganization[resolvedOrgId].byStore[mod.storeName] || 0) + 1;
          }
        } else {
          modUnassigned++;
          unassignedCount++;
          unassignedRecords.push({
            storeName: mod.storeName,
            firestoreCollection: mod.firestoreCollection,
            moduleLabel: mod.shortLabel,
            id: rec.id,
            label: rec.name || rec.code || rec.sourceCode || rec.description || `Registro ${rec.id}`,
            responsible: rec.responsible || 'Sin responsable especificado',
            date: rec.measuredAt || rec.observedAt || rec.createdAt || '—',
            currentOrganizationId: rec.organizationId || null
          });
        }

        preparedList.push({
          ...rec,
          organizationId: resolvedOrgId || null,
          organizationName: orgObj ? orgObj.name : 'Pendiente de asignación',
          _isDuplicate: isDuplicate,
          _storeName: mod.storeName,
          _firestoreCollection: mod.firestoreCollection,
          _moduleLabel: mod.shortLabel
        });
      }

      preparedRecordsByStore[mod.storeName] = preparedList;
      byModule[mod.storeName] = {
        storeName: mod.storeName,
        firestoreCollection: mod.firestoreCollection,
        label: mod.label,
        shortLabel: mod.shortLabel,
        total: records.length,
        assigned: modAssigned,
        unassigned: modUnassigned,
        duplicates: modDuplicates,
        synced: modSynced
      };
    }

    return {
      analyzedAt: nowIso(),
      totalRecords,
      assignedCount,
      unassignedCount,
      duplicateCount,
      alreadySyncedCount,
      byModule,
      byOrganization: Object.values(byOrganization),
      unassignedRecords,
      duplicateRecords,
      preparedRecordsByStore
    };
  }

  /**
   * 2. Permite al Superadministrador clasificar registros locales sin organización identificada
   * @param {Array<{storeName: string, id: string, organizationId: string}>} assignments
   */
  static async classifyUnassignedRecords(assignments = []) {
    if (!Array.isArray(assignments) || assignments.length === 0) return { updated: 0 };
    let updatedCount = 0;

    for (const item of assignments) {
      if (!item.storeName || !item.id || !item.organizationId) continue;
      const existing = await idb.get(item.storeName, item.id);
      if (existing) {
        await idb.put(item.storeName, {
          ...existing,
          organizationId: item.organizationId,
          updatedAt: nowIso()
        });
        updatedCount++;
      }
    }

    await auditService.logEvent({
      user: sessionService.getCurrentUser(),
      organization: sessionService.getCurrentOrganization(),
      module: 'firebase_sync',
      action: 'classify_unassigned_records',
      recordId: 'batch_classification',
      details: `Clasificación manual de ${updatedCount} registros locales sin organización previa.`
    });

    return { updated: updatedCount };
  }

  /**
   * 3. Genera la Vista Previa de Migración sin modificar los datos originales
   */
  static async buildMigrationPreview(targetOrganizationId = 'all') {
    const analysis = await this.analyzeLocalData();
    const previewItems = [];

    for (const mod of MODULE_SYNC_METADATA) {
      const list = analysis.preparedRecordsByStore[mod.storeName] || [];
      for (const item of list) {
        if (item._isDuplicate) continue;
        if (targetOrganizationId !== 'all' && item.organizationId !== targetOrganizationId) {
          continue;
        }
        previewItems.push({
          id: item.id,
          storeName: mod.storeName,
          firestoreCollection: mod.firestoreCollection,
          moduleLabel: mod.shortLabel,
          nameOrSummary: item.name || item.code || item.sourceCode || item.description || `${item.precipitationMm ?? item.waterLevel ?? ''} (${item.id})`,
          organizationId: item.organizationId,
          organizationName: item.organizationName,
          date: item.measuredAt || item.observedAt || item.createdAt || '—',
          coordinates: (item.latitude !== undefined && item.longitude !== undefined && item.latitude !== null)
            ? `${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`
            : '—',
          willTransfer: Boolean(item.organizationId)
        });
      }
    }

    const transferable = previewItems.filter(i => i.willTransfer);
    const blockedUnassigned = previewItems.filter(i => !i.willTransfer);

    return {
      generatedAt: nowIso(),
      targetOrganizationId,
      totalInPreview: previewItems.length,
      transferableCount: transferable.length,
      blockedUnassignedCount: blockedUnassigned.length,
      duplicateSkippedCount: analysis.duplicateCount,
      items: previewItems,
      analysis
    };
  }

  /**
   * 4. Ejecuta la sincronización idempotente hacia Firestore por lotes
   */
  static async synchronizeWithFirestore({ targetOrganizationId = 'all', onProgress = null } = {}) {
    await sessionService.ensureBaseOrganizationsInFirestore();
    const preview = await this.buildMigrationPreview(targetOrganizationId);

    const operations = [];
    const localUpdatesByStore = {};

    for (const mod of MODULE_SYNC_METADATA) {
      const list = preview.analysis.preparedRecordsByStore[mod.storeName] || [];
      for (const item of list) {
        if (item._isDuplicate) continue;
        if (!item.organizationId) continue; // No asignar ni migrar arbitrariamente registros sin organización
        if (targetOrganizationId !== 'all' && item.organizationId !== targetOrganizationId) continue;

        const {
          _isDuplicate,
          _storeName,
          _firestoreCollection,
          _moduleLabel,
          organizationName,
          ...cleanRecord
        } = item;

        const payload = {
          ...cleanRecord,
          id: String(cleanRecord.id),
          sourceRecordId: String(cleanRecord.id),
          organizationId: item.organizationId,
          syncStatus: 'synced',
          lastSyncedAt: nowIso(),
          createdAt: cleanRecord.createdAt || nowIso(),
          updatedAt: cleanRecord.updatedAt || nowIso()
        };

        operations.push({
          collection: mod.firestoreCollection,
          id: String(cleanRecord.id),
          data: payload
        });

        if (!localUpdatesByStore[mod.storeName]) {
          localUpdatesByStore[mod.storeName] = [];
        }
        localUpdatesByStore[mod.storeName].push(payload);
      }
    }

    const batchResult = await firebaseService.batchUpsert(operations, onProgress);

    // Si la transferencia a Firestore tuvo éxito, actualizar copia local en IndexedDB sin eliminarla
    if (batchResult.succeeded > 0) {
      for (const [storeName, records] of Object.entries(localUpdatesByStore)) {
        await idb.putBatch(storeName, records);
      }
    }

    // Registrar ejecución en el historial de sincronizaciones
    const historyEntry = {
      id: `sync-${Date.now()}-${generateId().slice(0, 6)}`,
      executedAt: nowIso(),
      executedByUserId: sessionService.getCurrentUser()?.id || 'system',
      executedByUserName: sessionService.getCurrentUser()?.name || 'Administrador',
      targetOrganizationId,
      totalAnalyzed: preview.analysis.totalRecords,
      attemptedCount: operations.length,
      succeededCount: batchResult.succeeded,
      failedCount: batchResult.failed,
      skippedUnassignedCount: preview.blockedUnassignedCount,
      skippedDuplicatesCount: preview.duplicateSkippedCount,
      errors: batchResult.errors || [],
      status: batchResult.failed === 0 && batchResult.succeeded > 0
        ? 'exitosa'
        : batchResult.succeeded > 0
          ? 'parcial'
          : operations.length === 0
            ? 'sin_cambios'
            : 'fallida'
    };

    await this._appendSyncHistory(historyEntry);

    await auditService.logEvent({
      user: sessionService.getCurrentUser(),
      organization: sessionService.getCurrentOrganization(),
      module: 'firebase_sync',
      action: 'firebase_sync',
      recordId: historyEntry.id,
      details: `Sincronización con Firestore (${historyEntry.status}): ${historyEntry.succeededCount} registros sincronizados, ${historyEntry.skippedUnassignedCount} pendientes de organización, ${historyEntry.failedCount} errores.`
    });

    return {
      ...historyEntry,
      preview
    };
  }

  static async _appendSyncHistory(entry) {
    const existingDoc = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.app_settings, 'sync_history');
    const historyList = Array.isArray(existingDoc?.runs) ? existingDoc.runs : [];
    const updatedRuns = [entry, ...historyList].slice(0, 50);

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.app_settings, 'sync_history', {
      id: 'sync_history',
      runs: updatedRuns,
      updatedAt: nowIso()
    }, true);
  }

  /**
   * 5. Consulta el historial de sincronizaciones realizadas
   */
  static async getSyncHistory() {
    const doc = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.app_settings, 'sync_history');
    return Array.isArray(doc?.runs) ? doc.runs : [];
  }

  /**
   * 6. Exporta respaldo local JSON antes de la migración
   */
  static async exportLocalBackupBeforeMigration() {
    const result = await JsonExportService.exportFullBackup();
    await auditService.logEvent({
      user: sessionService.getCurrentUser(),
      organization: sessionService.getCurrentOrganization(),
      module: 'firebase_sync',
      action: 'export_local_backup',
      recordId: result.filename,
      details: `Exportación preventiva de respaldo local JSON (${result.filename}).`
    });
    return result;
  }

  /**
   * 7. Vacía los registros operativos en Firebase Firestore (y opcionalmente en IndexedDB local)
   * al finalizar el periodo de pruebas para iniciar con datos reales de campo.
   */
  static async clearFirestoreForProduction({
    organizationId = 'all',
    alsoClearLocalIndexedDB = true,
    resetSyncHistory = true
  } = {}, onProgress = null) {
    const isSuper = sessionService.isSuperAdmin();
    const currentUserOrgId = sessionService.getCurrentUser()?.organizationId || null;
    const effectiveOrg = isSuper ? organizationId : (currentUserOrgId || organizationId);

    const operationalCollections = MODULE_SYNC_METADATA.map(m => m.firestoreCollection);

    const fbResult = await firebaseService.clearCollections(
      operationalCollections,
      effectiveOrg,
      onProgress
    );

    let localDeletedCount = 0;
    if (alsoClearLocalIndexedDB) {
      if (!effectiveOrg || effectiveOrg === 'all') {
        for (const meta of MODULE_SYNC_METADATA) {
          const allLocal = await idb.getAll(meta.storeName).catch(() => []);
          localDeletedCount += allLocal.length;
          await idb.clear(meta.storeName).catch(() => {});
        }
        try {
          localStorage.setItem('hidroterra_test_period_cleared', 'true');
        } catch {
          // Ignorar restricciones de almacenamiento
        }
      } else {
        for (const meta of MODULE_SYNC_METADATA) {
          const allLocal = await idb.getAll(meta.storeName).catch(() => []);
          for (const rec of allLocal) {
            if (rec.organizationId === effectiveOrg) {
              await idb.delete(meta.storeName, rec.id).catch(() => {});
              localDeletedCount += 1;
            }
          }
        }
      }
    }

    if (resetSyncHistory && (!effectiveOrg || effectiveOrg === 'all')) {
      await firebaseService.setDocument(FIRESTORE_COLLECTIONS.app_settings, 'sync_history', {
        id: 'sync_history',
        runs: [],
        updatedAt: nowIso()
      }, true);
    }

    await auditService.logEvent({
      user: sessionService.getCurrentUser(),
      organization: sessionService.getCurrentOrganization(),
      module: 'firebase_sync',
      action: 'clear_firestore_test_data',
      recordId: effectiveOrg || 'all',
      details: `Vaciado de datos de prueba en Firestore (${effectiveOrg === 'all' ? 'Todas las organizaciones' : effectiveOrg}): ${fbResult.deleted} documentos eliminados en Firestore y ${localDeletedCount} registros locales en IndexedDB.`
    });

    return {
      ...fbResult,
      localDeletedCount,
      effectiveOrg
    };
  }
}

export const firebaseSyncService = FirebaseSyncService;


