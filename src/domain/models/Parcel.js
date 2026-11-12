/**
 * Modelo de Dominio: Parcela (Parcel)
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const PARCEL_STATUSES = {
  activa: 'Activa en producción',
  inactiva: 'Inactiva / En descanso'
};

export const AREA_UNITS = {
  hectareas: 'Hectáreas (ha)',
  metros_cuadrados: 'Metros cuadrados (m²)'
};

export class Parcel {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.code = (data.code || '').trim().toUpperCase();
    this.name = (data.name || '').trim();
    this.siteId = data.siteId || null;
    this.responsible = (data.responsible || '').trim();
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.area = data.area !== undefined && data.area !== '' && data.area !== null ? Number(data.area) : null;
    this.areaUnit = data.areaUnit || 'hectareas';
    this.status = data.status || 'activa';
    this.notes = (data.notes || '').trim();
    this.organizationId = data.organizationId || null;
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.name)) {
      errors.name = 'El nombre de la parcela es obligatorio.';
    }
    if (!isRequired(this.code)) {
      errors.code = 'El código de la parcela es obligatorio.';
    }

    if (this.latitude !== null && !isValidLatitude(this.latitude)) {
      errors.latitude = 'La latitud debe estar entre -90 y 90 grados.';
    }
    if (this.longitude !== null && !isValidLongitude(this.longitude)) {
      errors.longitude = 'La longitud debe estar entre -180 y 180 grados.';
    }

    if (this.area !== null && (!Number.isFinite(this.area) || this.area < 0)) {
      errors.area = 'El área debe ser un número positivo.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la parcela inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      siteId: this.siteId,
      responsible: this.responsible,
      latitude: this.latitude,
      longitude: this.longitude,
      area: this.area,
      areaUnit: this.areaUnit,
      status: this.status,
      notes: this.notes,
      organizationId: this.organizationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
