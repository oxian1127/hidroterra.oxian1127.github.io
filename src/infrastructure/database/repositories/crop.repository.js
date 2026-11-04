/**
 * Repositorio de Cultivos (Crop Repository)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class CropRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.crops.name, 'crop');
  }

  async getByParcelId(parcelId) {
    const all = await this.getAll();
    return all.filter(item => item.parcelId === parcelId);
  }

  async getActive() {
    const all = await this.getAll();
    return all.filter(item => item.status === 'activo');
  }
}

export const cropRepository = new CropRepository();
