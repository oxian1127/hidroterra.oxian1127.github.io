/**
 * Servicio de Aplicación: Fuentes de Agua (WaterSources Service)
 */

import { WaterSource } from '../domain/models/WaterSource.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../infrastructure/database/repositories/water-measurement.repository.js';
import { assertCanDeleteWaterSource } from '../domain/rules/data-integrity.rules.js';
import { ValidationError } from '../core/errors.js';

export class WaterSourcesService {
  static async getAll(filters = {}) {
    let sources = await waterSourceRepository.getAll();

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      sources = sources.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.responsible && s.responsible.toLowerCase().includes(q))
      );
    }

    if (filters.type && filters.type !== 'all') {
      sources = sources.filter(s => s.type === filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      sources = sources.filter(s => s.status === filters.status);
    }

    if (filters.siteId && filters.siteId !== 'all') {
      sources = sources.filter(s => s.siteId === filters.siteId);
    }

    if (filters.onlyActive) {
      sources = sources.filter(s => s.active !== false);
    }

    return sources.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getById(id) {
    return await waterSourceRepository.getById(id);
  }

  static async create(data) {
    const model = new WaterSource(data);
    model.validate();

    // Comprobar código único
    const existing = await waterSourceRepository.getByCode(model.code);
    if (existing) {
      throw new ValidationError(`Ya existe una fuente de agua con el código "${model.code}".`);
    }

    return await waterSourceRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await waterSourceRepository.getById(id);
    if (!current) throw new ValidationError('Fuente de agua no encontrada.');

    const model = new WaterSource({ ...current, ...data, id });
    model.validate();

    // Comprobar código único si cambió
    if (model.code !== current.code) {
      const existing = await waterSourceRepository.getByCode(model.code);
      if (existing && existing.id !== id) {
        throw new ValidationError(`Ya existe otra fuente de agua con el código "${model.code}".`);
      }
    }

    return await waterSourceRepository.update(id, model.toJSON());
  }

  static async toggleActive(id, activeState) {
    return await waterSourceRepository.update(id, { active: activeState });
  }

  static async delete(id) {
    const measurements = await waterMeasurementRepository.getBySourceId(id);
    assertCanDeleteWaterSource(id, measurements);
    return await waterSourceRepository.delete(id);
  }
}
