/**
 * Servicio de Aplicación: Sitios y Comunidades (Sites Service)
 */

import { Site } from '../domain/models/Site.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { assertCanDeleteSite } from '../domain/rules/data-integrity.rules.js';
import { ValidationError } from '../core/errors.js';

export class SitesService {
  static async getAll(filters = {}) {
    let list = await siteRepository.getAll();

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.municipality && s.municipality.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q))
      );
    }

    if (filters.municipality && filters.municipality !== 'all') {
      list = list.filter(s => s.municipality === filters.municipality);
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getById(id) {
    return await siteRepository.getById(id);
  }

  static async create(data) {
    const model = new Site(data);
    model.validate();
    return await siteRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await siteRepository.getById(id);
    if (!current) throw new ValidationError('Comunidad o sitio no encontrado.');

    const model = new Site({ ...current, ...data, id });
    model.validate();

    return await siteRepository.update(id, model.toJSON());
  }

  static async delete(id) {
    // Comprobar integridad referencial
    const [sources, pluviometers, parcels] = await Promise.all([
      waterSourceRepository.getAll(),
      pluviometerRepository.getAll(),
      parcelRepository.getAll()
    ]);

    assertCanDeleteSite(id, { waterSources: sources, pluviometers, parcels });
    return await siteRepository.delete(id);
  }
}
