/**
 * Repositorio de Parcelas (Parcel Repository)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class ParcelRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.parcels.name, 'parcel');
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
    return all.filter(item => item.status === 'activa');
  }
}

export const parcelRepository = new ParcelRepository();
