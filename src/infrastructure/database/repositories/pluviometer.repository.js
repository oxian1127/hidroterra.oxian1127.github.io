/**
 * Repositorio de Pluviómetros
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class PluviometerRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.pluviometers.name, 'pluviometer');
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
    return all.filter(item => item.status === 'activo');
  }
}

export const pluviometerRepository = new PluviometerRepository();
