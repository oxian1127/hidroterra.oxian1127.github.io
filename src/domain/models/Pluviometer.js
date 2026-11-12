/**
 * Modelo de Dominio: Pluviómetro (Pluviometer)
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const PLUVIOMETER_TYPES = {
  manual: 'Manual (Lectura directa / Probeta)',
  automatico: 'Automático / Balancín digital',
  otro: 'Otro pluviómetro artesanal / comunitario'
};

export const PLUVIOMETER_STATUSES = {
  activo: 'Activo / Operativo',
  inactivo: 'Inactivo temporalmente',
  mantenimiento: 'En mantenimiento / Calibración',
  retirado: 'Retirado / Desactivado'
};

export class Pluviometer {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.code = (data.code || '').trim().toUpperCase();
    this.name = (data.name || '').trim();
    this.equipmentType = data.equipmentType || 'manual';
    this.siteId = data.siteId || null;
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.altitudeMeters = data.altitudeMeters !== undefined && data.altitudeMeters !== '' && data.altitudeMeters !== null ? Number(data.altitudeMeters) : null;
    this.installDate = data.installDate || null;
    this.responsible = (data.responsible || '').trim();
    this.status = data.status || 'activo';
    this.notes = (data.notes || '').trim();
    this.organizationId = data.organizationId || null;
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.name)) {
      errors.name = 'El nombre identificador del pluviómetro es obligatorio.';
    }
    if (!isRequired(this.code)) {
      errors.code = 'El código del pluviómetro es obligatorio.';
    }
    if (!PLUVIOMETER_TYPES[this.equipmentType]) {
      errors.equipmentType = 'Tipo de equipo no válido.';
    }
    if (!PLUVIOMETER_STATUSES[this.status]) {
      errors.status = 'Estado del pluviómetro no válido.';
    }
    if (!isRequired(this.responsible)) {
      errors.responsible = 'El nombre de la persona responsable del equipo o lectura es obligatorio.';
    }

    // Coordenadas manuales o por GPS
    if (this.latitude !== null) {
      if (!isValidLatitude(this.latitude)) {
        errors.latitude = 'La latitud debe ser un valor decimal entre -90 y 90 grados.';
      }
    }
    if (this.longitude !== null) {
      if (!isValidLongitude(this.longitude)) {
        errors.longitude = 'La longitud debe ser un valor decimal entre -180 y 180 grados.';
      }
    }

    if (this.altitudeMeters !== null && (!Number.isFinite(this.altitudeMeters) || this.altitudeMeters < -500 || this.altitudeMeters > 9000)) {
      errors.altitudeMeters = 'La altitud debe ser un número válido en metros.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos del pluviómetro inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      equipmentType: this.equipmentType,
      siteId: this.siteId,
      latitude: this.latitude,
      longitude: this.longitude,
      altitudeMeters: this.altitudeMeters,
      installDate: this.installDate,
      responsible: this.responsible,
      status: this.status,
      notes: this.notes,
      organizationId: this.organizationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
