/**
 * Repositorio de Mediciones de Lluvia (RainfallRecord Repository)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';
import { findPotentialDuplicate } from '../../../domain/rules/rainfall.rules.js';

class RainfallRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.rainfall_records.name, 'rainfall_record');
  }

  async getByPluviometer(pluviometerId) {
    const all = await this.getAll();
    return all
      .filter(item => item.pluviometerId === pluviometerId)
      .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  }

  async getByDateRange(startDate, endDate) {
    const all = await this.getAll();
    return all.filter(item => {
      if (!item.measuredAt) return false;
      const t = item.measuredAt.split('T')[0];
      if (startDate && t < startDate) return false;
      if (endDate && t > endDate) return false;
      return true;
    }).sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  }

  async getRecent(limit = 10) {
    const all = await this.getAll();
    return all
      .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
      .slice(0, limit);
  }

  async checkDuplicate(pluviometerId, measuredAt, currentRecordId = null) {
    const all = await this.getAll();
    return findPotentialDuplicate(all, pluviometerId, measuredAt, currentRecordId);
  }
}

export const rainfallRepository = new RainfallRepository();
