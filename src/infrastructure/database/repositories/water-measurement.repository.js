/**
 * Repositorio de Mediciones de Disponibilidad Hídrica (water_measurements)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class WaterMeasurementRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.water_measurements.name, 'water_measurement');
  }

  async getBySourceId(sourceId) {
    if (!sourceId) return [];
    const all = await this.getAll();
    return all
      .filter(item => item.sourceId === sourceId)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
  }

  async getLatestBySourceId(sourceId) {
    const list = await this.getBySourceId(sourceId);
    return list[0] || null;
  }

  async getRecent(limit = 5) {
    const all = await this.getAll();
    return all
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .slice(0, limit);
  }
}

export const waterMeasurementRepository = new WaterMeasurementRepository();

