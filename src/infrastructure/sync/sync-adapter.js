/**
 * Adaptador y Contratos de Sincronización para Fase 2 (Futura Nube y API REST)
 * Define las interfaces de integración sin simular conexión falsa en la fase 1.
 */

export class SyncAdapterInterface {
  /**
   * Verifica el estado del servidor remoto
   * @returns {Promise<{available: boolean, latencyMs: number}>}
   */
  async ping() {
    throw new Error('Método ping() no implementado en Fase 1 (modo local estricto).');
  }

  /**
   * Obtiene los cambios pendientes de envío hacia el servidor
   * @param {string} entityName
   * @param {string} lastSyncTimestamp
   */
  async getPendingChanges(entityName, lastSyncTimestamp) {
    throw new Error('Método getPendingChanges() reservado para Fase 2.');
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
   * Estrategia de resolución de conflictos (Servidor gana / Cliente gana / Combinación manual)
   */
  resolveConflict(localRecord, remoteRecord, strategy = 'latest-timestamp') {
    if (strategy === 'latest-timestamp') {
      const localTime = new Date(localRecord.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteRecord.updatedAt || 0).getTime();
      return remoteTime >= localTime ? remoteRecord : localRecord;
    }
    return remoteRecord;
  }
}

/**
 * Adaptador nulo para Fase 1 (informa con precisión que la sincronización en la nube aún no está habilitada)
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
      message: 'Fase 1: Datos almacenados estrictamente en el dispositivo local. La sincronización en la nube se activará en la Fase 2.'
    };
  }
}

export const syncAdapter = new OfflineOnlySyncAdapter();
