/**
 * Repositorio de Observaciones Hídricas (Observation Repository)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class ObservationRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.observations.name, 'observation');
  }

  async getByCategory(category) {
    const all = await this.getAll();
    return all.filter(item => item.category === category);
  }

  async getByRelatedEntity(entityType, entityId) {
    const all = await this.getAll();
    return all.filter(item => item.relatedEntityType === entityType && item.relatedEntityId === entityId);
  }

  async getRecent(limit = 10) {
    const all = await this.getAll();
    return all
      .sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))
      .slice(0, limit);
  }
}

export const observationRepository = new ObservationRepository();
