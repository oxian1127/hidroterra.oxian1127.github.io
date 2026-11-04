/**
 * Servicio de Aplicación: Observaciones Hídricas (Observations Service)
 */

import { WaterObservation } from '../domain/models/WaterObservation.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import { ValidationError } from '../core/errors.js';

export class ObservationsService {
  static async getAll(filters = {}) {
    let list = await observationRepository.getAll();

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(o =>
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.observedStatus && o.observedStatus.toLowerCase().includes(q)) ||
        (o.responsible && o.responsible.toLowerCase().includes(q))
      );
    }

    if (filters.category && filters.category !== 'all') {
      list = list.filter(o => o.category === filters.category);
    }

    if (filters.relatedEntityType && filters.relatedEntityType !== 'all') {
      list = list.filter(o => o.relatedEntityType === filters.relatedEntityType);
    }

    return list.sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt));
  }

  static async getById(id) {
    return await observationRepository.getById(id);
  }

  static async create(data) {
    const model = new WaterObservation(data);
    model.validate();
    return await observationRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await observationRepository.getById(id);
    if (!current) throw new ValidationError('Observación no encontrada.');

    const model = new WaterObservation({ ...current, ...data, id });
    model.validate();

    return await observationRepository.update(id, model.toJSON());
  }

  static async delete(id) {
    return await observationRepository.delete(id);
  }
}
