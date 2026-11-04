/**
 * Servicio de Aplicación: Pluviómetros (Pluviometers Service)
 */

import { Pluviometer } from '../domain/models/Pluviometer.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { assertCanDeletePluviometer } from '../domain/rules/data-integrity.rules.js';
import { ValidationError } from '../core/errors.js';

export class PluviometersService {
  static async getAll(filters = {}) {
    let list = await pluviometerRepository.getAll();

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.responsible && p.responsible.toLowerCase().includes(q))
      );
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter(p => p.status === filters.status);
    }

    if (filters.equipmentType && filters.equipmentType !== 'all') {
      list = list.filter(p => p.equipmentType === filters.equipmentType);
    }

    if (filters.siteId && filters.siteId !== 'all') {
      list = list.filter(p => p.siteId === filters.siteId);
    }

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }

  static async getById(id) {
    return await pluviometerRepository.getById(id);
  }

  static async create(data) {
    const model = new Pluviometer(data);
    model.validate();

    // Comprobar código único
    const existing = await pluviometerRepository.getByCode(model.code);
    if (existing) {
      throw new ValidationError(`Ya existe un pluviómetro con el código "${model.code}".`);
    }

    return await pluviometerRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await pluviometerRepository.getById(id);
    if (!current) throw new ValidationError('Pluviómetro no encontrado.');

    const model = new Pluviometer({ ...current, ...data, id });
    model.validate();

    if (model.code !== current.code) {
      const existing = await pluviometerRepository.getByCode(model.code);
      if (existing && existing.id !== id) {
        throw new ValidationError(`Ya existe otro pluviómetro con el código "${model.code}".`);
      }
    }

    return await pluviometerRepository.update(id, model.toJSON());
  }

  static async changeStatus(id, newStatus) {
    return await pluviometerRepository.update(id, { status: newStatus });
  }

  static async delete(id) {
    // Regla de integridad: verificar si existen registros de lluvia
    const records = await rainfallRepository.getByPluviometer(id);
    assertCanDeletePluviometer(id, records);
    return await pluviometerRepository.delete(id);
  }

  static async getMeasurements(pluviometerId) {
    return await rainfallRepository.getByPluviometer(pluviometerId);
  }
}
