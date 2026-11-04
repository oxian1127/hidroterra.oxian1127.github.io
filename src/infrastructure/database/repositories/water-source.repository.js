/**
 * Repositorio de Fuentes de Agua
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class WaterSourceRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.water_sources.name, 'water_source');
  }

  async getByCode(code) {
    if (!code) return null;
    const all = await this.getAll();
    const clean = code.trim().toUpperCase();
    return all.find(item => item.code && item.code.toUpperCase() === clean) || null;
  }

  async getBySiteId(siteId) {
    const all = await this.getAll();
    return all.filter(item => item.siteId === siteId);
  }

  async getActive() {
    const all = await this.getAll();
    return all.filter(item => item.active !== false);
  }
}

export const waterSourceRepository = new WaterSourceRepository();
