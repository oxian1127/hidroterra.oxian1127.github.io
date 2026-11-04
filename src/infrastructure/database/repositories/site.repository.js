/**
 * Repositorio de Sitios y Comunidades (Site Repository)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class SiteRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.sites.name, 'site');
  }

  async getByName(name) {
    if (!name) return null;
    const all = await this.getAll();
    const clean = name.trim().toLowerCase();
    return all.find(item => item.name && item.name.toLowerCase() === clean) || null;
  }

  async getByMunicipality(muni) {
    if (!muni) return [];
    const all = await this.getAll();
    const clean = muni.trim().toLowerCase();
    return all.filter(item => item.municipality && item.municipality.toLowerCase() === clean);
  }
}

export const siteRepository = new SiteRepository();
