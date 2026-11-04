/**
 * Servicio de Aplicación: Preparación para Sincronización Futura (Phase 2 Cloud Sync)
 * Expone la información de arquitectura, cola de operaciones pendientes y puntos de extensión para conectar backend REST
 */

import { syncAdapter } from '../infrastructure/sync/sync-adapter.js';

export class FutureSyncService {
  static getStatus() {
    return syncAdapter.getCloudStatus();
  }

  static async getPendingQueueSummary() {
    const pending = await syncAdapter.getPendingChanges();
    const byEntity = {};
    pending.forEach(item => {
      byEntity[item.entityName] = (byEntity[item.entityName] || 0) + 1;
    });
    return {
      totalPendingOperations: pending.length,
      byEntity,
      items: pending.slice(0, 20)
    };
  }

  static getArchitectureGuide() {
    return {
      phase: 1,
      mode: 'IndexedDB Local First (PWA Offline — HIDROTERRA)',
      nextPhasePlan: {
        phase: 2,
        backendType: 'REST API / Microservicio Node o Python',
        databaseTarget: 'PostgreSQL / PostGIS para consultas geoespaciales complejas',
        authModel: 'OAuth2 / JWT con roles (Monitor local, Coordinador municipal, Administrador regional)',
        syncProtocol: 'Pivoteo por timestamp updatedAt, estado syncStatus y cola sync_queue con UUID v4',
        offlineConflictStrategy: 'Resolución determinista basada en timestamps más recientes o confirmación manual en interfaz para colisiones'
      }
    };
  }
}
