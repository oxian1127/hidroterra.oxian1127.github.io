/**
 * Servicio de Aplicación: Pluviómetros (Pluviometers Service)
 */

import { Pluviometer } from '../domain/models/Pluviometer.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { assertCanDeletePluviometer } from '../domain/rules/data-integrity.rules.js';
import { ValidationError } from '../core/errors.js';

export class PluviometersService {
  /**
   * Extrae el prefijo territorial de 4 letras a partir de la comunidad seleccionada
   * siguiendo el modelo PLUV-CARM-01 (ej. CARM, SJAC, SJNP, OVEJ o las 4 letras de la comunidad).
   */
  static extractSitePrefix(site) {
    if (!site) return 'TERR';

    const id = String(site.id || '').toLowerCase();
    const name = String(site.name || '').trim();
    const municipality = String(site.municipality || '').trim();

    if (id === 'site-carmen-caracoli' || (/carmen/i.test(municipality) && /caracol/i.test(name))) {
      return 'CARM';
    }
    if (id === 'site-sanjacinto-palmas') return 'SJAC';
    if (id === 'site-sanjuan-sanpedro') return 'SJNP';
    if (id === 'site-ovejas-canutalito') return 'OVEJ';

    const normalize = (str) =>
      String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .trim();

    const stopWords = new Set([
      'VEREDA', 'CORREGIMIENTO', 'COMUNIDAD', 'SITIO', 'SECTOR',
      'CASERIO', 'BARRIO', 'FINCA', 'PREDIO', 'PARCELA',
      'EL', 'LA', 'LOS', 'LAS', 'DE', 'DEL', 'Y'
    ]);

    const cleanWords = normalize(name)
      .split(/\s+/)
      .filter(w => w && !stopWords.has(w));

    let base = cleanWords.join('');
    if (base.length < 4) {
      const munWords = normalize(municipality)
        .split(/\s+/)
        .filter(w => w && !stopWords.has(w));
      base = (base + munWords.join('')).slice(0, 4);
    }

    return base.slice(0, 4).padEnd(4, 'X');
  }

  /**
   * Genera automáticamente un código único aleatorio para el pluviómetro a partir de la comunidad seleccionada,
   * siguiendo el formato PLUV-XXXX-NN (ej. PLUV-CARM-01) y verificando que no existan duplicados.
   */
  static async generateUniqueCodeForSite(siteOrId) {
    let site = null;
    if (siteOrId && typeof siteOrId === 'object') {
      site = siteOrId;
    } else if (siteOrId) {
      site = await siteRepository.getById(String(siteOrId));
    }

    const prefix4 = this.extractSitePrefix(site);
    const allPluvs = await pluviometerRepository.getAllRaw();
    const existingCodes = new Set(
      (allPluvs || [])
        .map(p => (p && p.code ? String(p.code).trim().toUpperCase() : ''))
        .filter(Boolean)
    );

    const getRandomInt = (maxExclusive) => {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0] % maxExclusive;
      }
      return Math.floor(Math.random() * maxExclusive);
    };

    // Generar sufijo aleatorio de 2 dígitos (01 a 99) siguiendo el modelo PLUV-CARM-01
    for (let attempt = 0; attempt < 250; attempt++) {
      const randomNum = (getRandomInt(99) + 1);
      const twoDigits = String(randomNum).padStart(2, '0');
      const candidate = `PLUV-${prefix4}-${twoDigits}`;
      if (!existingCodes.has(candidate)) {
        return candidate;
      }
    }

    // Búsqueda exhaustiva 01..99 si hubo colisiones aleatorias
    for (let n = 1; n <= 99; n++) {
      const candidate = `PLUV-${prefix4}-${String(n).padStart(2, '0')}`;
      if (!existingCodes.has(candidate)) {
        return candidate;
      }
    }

    // Respaldo alfanumérico de 2 caracteres en caso de superar 99 equipos en la misma comunidad
    const alphaNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 200; attempt++) {
      const s1 = alphaNum[getRandomInt(alphaNum.length)];
      const s2 = String(getRandomInt(10));
      const candidate = `PLUV-${prefix4}-${s1}${s2}`;
      if (!existingCodes.has(candidate)) {
        return candidate;
      }
    }

    return `PLUV-${prefix4}-${Date.now().toString(36).slice(-2).toUpperCase()}`;
  }

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
    if (!data || !data.siteId) {
      throw new ValidationError('Debe seleccionar primero la comunidad o sitio asociado para generar el código del pluviómetro.');
    }

    let assignedCode = data.code ? String(data.code).trim().toUpperCase() : '';
    if (!assignedCode || await pluviometerRepository.getByCode(assignedCode)) {
      assignedCode = await this.generateUniqueCodeForSite(data.siteId);
    }

    const model = new Pluviometer({ ...data, code: assignedCode });
    model.validate();

    return await pluviometerRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await pluviometerRepository.getById(id);
    if (!current) throw new ValidationError('Pluviómetro no encontrado.');

    const immutableCode = current.code || await this.generateUniqueCodeForSite(data?.siteId || current.siteId);
    const model = new Pluviometer({ ...current, ...data, code: immutableCode, id });
    model.validate();

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
