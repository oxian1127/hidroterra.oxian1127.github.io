/**
 * Servicio de Aplicación: Preparación para Sincronización Futura (Phase 2 Cloud Sync)
 * Expone la información de arquitectura y puntos de extensión para conectar backend REST
 */

import { syncAdapter } from '../infrastructure/sync/sync-adapter.js';

export class FutureSyncService {
  static getStatus() {
    return syncAdapter.getCloudStatus();
  }

  static getArchitectureGuide() {
    return {
      phase: 1,
      mode: 'IndexedDB Local First (PWA Offline)',
      nextPhasePlan: {
        phase: 2,
        backendType: 'REST API / Microservicio Node o Python',
        databaseTarget: 'PostgreSQL / PostGIS para consultas geoespaciales complejas',
        authModel: 'OAuth2 / JWT con roles (Monitor local, Coordinador municipal, Administrador regional)',
        syncProtocol: 'Pivoteo por timestamp updatedAt y UUID v4',
        offlineConflictStrategy: 'Resolución basada en timestamps más recientes y confirmación manual en interfaz para colisiones'
      }
    };
  }
}
