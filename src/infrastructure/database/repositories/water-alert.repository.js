/**
 * Repositorio de Alertas Hídricas (water_alerts)
 */

import { BaseRepository } from './base.repository.js';
import { DB_CONFIG } from '../../../config/database.config.js';

class WaterAlertRepository extends BaseRepository {
  constructor() {
    super(DB_CONFIG.stores.water_alerts.name, 'water_alert');
  }

  async getByStatus(status = 'activa') {
    const all = await this.getAll();
    if (!status || status === 'all') {
      return all.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    }
    return all
      .filter(item => item.status === status)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getByRuleCode(ruleCode) {
    if (!ruleCode) return null;
    const all = await this.getAll();
    return all.find(item => item.ruleCode === ruleCode && item.status === 'activa') || null;
  }

  async getByEntityId(entityId) {
    if (!entityId) return [];
    const all = await this.getAll();
    return all
      .filter(item => item.relatedEntityId === entityId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }
}

export const waterAlertRepository = new WaterAlertRepository();

