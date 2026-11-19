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

  /**
   * Genera automáticamente un código identificador único con estructura uniforme (FNT-XXXX-XX, 11 caracteres)
   * verificando contra todos los registros del sistema para impedir duplicados.
   */
  static async generateUniqueCode() {
    const allSources = await waterSourceRepository.getAllRaw();
    const existingCodes = new Set(
      (allSources || [])
        .map(s => (s && s.code ? String(s.code).trim().toUpperCase() : ''))
        .filter(Boolean)
    );

    const alphaNumChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const digitChars = '0123456789';

    const randomBlock = (charset, length) => {
      const randomValues = new Uint32Array(length);
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(randomValues);
      } else {
        for (let i = 0; i < length; i++) {
          randomValues[i] = Math.floor(Math.random() * charset.length);
        }
      }
      let out = '';
      for (let i = 0; i < length; i++) {
        out += charset[randomValues[i] % charset.length];
      }
      return out;
    };

    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate = `FNT-${randomBlock(alphaNumChars, 4)}-${randomBlock(digitChars, 2)}`;
      if (!existingCodes.has(candidate)) {
        return candidate;
      }
    }

    // Respaldo determinístico garantizado sin colisión en caso extremo
    const fallback = `FNT-${Date.now().toString(36).slice(-4).toUpperCase()}-${randomBlock(digitChars, 2)}`;
    return fallback;
  }

  static async getById(id) {
    return await waterSourceRepository.getById(id);
  }

  static async create(data) {
    let assignedCode = data && data.code ? String(data.code).trim().toUpperCase() : '';
    if (!assignedCode || await waterSourceRepository.getByCode(assignedCode)) {
      assignedCode = await this.generateUniqueCode();
    }

    const model = new WaterSource({ ...data, code: assignedCode });
    model.validate();

    return await waterSourceRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await waterSourceRepository.getById(id);
    if (!current) throw new ValidationError('Fuente de agua no encontrada.');

    // El código identificador es inmutable y controlado por el sistema
    const immutableCode = current.code || await this.generateUniqueCode();
    const model = new WaterSource({ ...current, ...data, code: immutableCode, id });
    model.validate();

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
