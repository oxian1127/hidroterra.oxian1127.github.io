/**
 * Servicio de Aplicación: Registro de Lluvias (Rainfall Service)
 */

import { RainfallRecord } from '../domain/models/RainfallRecord.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import {
  calculateDailyAccumulations,
  calculateMonthlyAccumulations,
  calculatePeriodTotal,
  comparePluviometers
} from '../domain/rules/rainfall.rules.js';
import { ValidationError } from '../core/errors.js';

export class RainfallService {
  static async getAll(filters = {}) {
    let list = await rainfallRepository.getAll();

    if (filters.pluviometerId && filters.pluviometerId !== 'all') {
      list = list.filter(r => r.pluviometerId === filters.pluviometerId);
    }

    if (filters.startDate) {
      list = list.filter(r => r.measuredAt && r.measuredAt.split('T')[0] >= filters.startDate);
    }

    if (filters.endDate) {
      list = list.filter(r => r.measuredAt && r.measuredAt.split('T')[0] <= filters.endDate);
    }

    if (filters.responsible) {
      const q = filters.responsible.trim().toLowerCase();
      list = list.filter(r => r.responsible && r.responsible.toLowerCase().includes(q));
    }

    return list.sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  }

  static async getById(id) {
    return await rainfallRepository.getById(id);
  }

  /**
   * Crea un registro de lluvia con verificación preventiva de duplicados
   */
  static async create(data, forceConfirm = false) {
    const model = new RainfallRecord(data);
    model.validate();

    // Verificar que el pluviómetro exista
    const pluv = await pluviometerRepository.getById(model.pluviometerId);
    if (!pluv) {
      throw new ValidationError('El pluviómetro seleccionado no existe en la base de datos.');
    }

    // Verificar posible duplicado si no viene confirmado expresamente
    if (!forceConfirm) {
      const potentialDup = await rainfallRepository.checkDuplicate(model.pluviometerId, model.measuredAt);
      if (potentialDup) {
        return {
          warning: true,
          type: 'DUPLICATE_MEASUREMENT',
          message: `Atención: Ya existe un registro para este pluviómetro con fecha/hora cercana (${potentialDup.measuredAt}, ${potentialDup.precipitationMm} mm). ¿Desea guardarlo de todos modos?`,
          duplicateRecord: potentialDup,
          pendingData: model.toJSON()
        };
      }
    }

    const saved = await rainfallRepository.create(model.toJSON());
    return {
      success: true,
      data: saved
    };
  }

  static async update(id, data) {
    const current = await rainfallRepository.getById(id);
    if (!current) throw new ValidationError('Registro de lluvia no encontrado.');

    const model = new RainfallRecord({ ...current, ...data, id });
    model.validate();

    return await rainfallRepository.update(id, model.toJSON());
  }

  static async delete(id) {
    return await rainfallRepository.delete(id);
  }

  /**
   * Obtiene agregados y comparaciones para vistas y reportes
   */
  static async getStatistics(filters = {}) {
    const records = await this.getAll(filters);
    const pluviometers = await pluviometerRepository.getAll();

    const daily = calculateDailyAccumulations(records);
    const monthly = calculateMonthlyAccumulations(records);
    const totals = calculatePeriodTotal(records);
    const comparison = comparePluviometers(records, pluviometers);

    return {
      records,
      daily,
      monthly,
      totals,
      comparison
    };
  }
}
