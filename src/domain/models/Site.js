/**
 * Modelo de Dominio: Sitio / Comunidad (Site)
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export class Site {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.name = (data.name || '').trim();
    this.municipality = (data.municipality || '').trim();
    this.department = (data.department || 'Bolívar').trim();
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.description = (data.description || '').trim();
    this.notes = (data.notes || '').trim();
    this.organizationId = data.organizationId || null;
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.name)) {
      errors.name = 'El nombre de la comunidad o sitio es obligatorio.';
    }
    if (!isRequired(this.municipality)) {
      errors.municipality = 'El municipio es obligatorio.';
    }

    if (this.latitude !== null && !isValidLatitude(this.latitude)) {
      errors.latitude = 'La latitud debe estar entre -90 y 90 grados.';
    }
    if (this.longitude !== null && !isValidLongitude(this.longitude)) {
      errors.longitude = 'La longitud debe estar entre -180 y 180 grados.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos del sitio o comunidad inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      municipality: this.municipality,
      department: this.department,
      latitude: this.latitude,
      longitude: this.longitude,
      description: this.description,
      notes: this.notes,
      organizationId: this.organizationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
