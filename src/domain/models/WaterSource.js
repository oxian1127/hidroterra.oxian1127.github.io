/**
 * Modelo de Dominio: Fuente de Agua (WaterSource)
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const WATER_SOURCE_TYPES = {
  pozo: 'Pozo profundo / artesanal',
  arroyo: 'Arroyo',
  rio: 'Río',
  manantial: 'Manantial / Ojo de agua',
  jaguey: 'Jagüey',
  reservorio: 'Reservorio / Represa',
  acueducto: 'Acueducto rural / Veredal',
  tanque: 'Tanque de almacenamiento',
  otra: 'Otra fuente'
};

export const WATER_SOURCE_STATUSES = {
  disponible: 'Disponible / Buen caudal',
  limitada: 'Limitada / Caudal bajo',
  seca: 'Seca / Sin caudal',
  contaminada: 'Contaminada / No apta',
  sin_verificar: 'Sin verificar'
};

export const WATER_SOURCE_USES = {
  consumo: 'Consumo humano directo o tratado',
  domestico: 'Uso doméstico general',
  agropecuario: 'Producción agropecuaria (animales)',
  riego: 'Riego agrícola',
  otro: 'Otro uso'
};

export class WaterSource {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.code = (data.code || '').trim().toUpperCase();
    this.name = (data.name || '').trim();
    this.type = data.type || 'pozo';
    this.siteId = data.siteId || null;
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.status = data.status || 'sin_verificar';
    this.observationDate = data.observationDate || nowIso();
    this.mainUse = data.mainUse || 'domestico';
    this.responsible = (data.responsible || '').trim();
    this.notes = (data.notes || '').trim();
    this.active = data.active !== false; // True por defecto (desactivable de forma lógica)
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.name)) {
      errors.name = 'El nombre de la fuente es obligatorio.';
    }
    if (!isRequired(this.code)) {
      errors.code = 'El código de la fuente es obligatorio.';
    }
    if (!WATER_SOURCE_TYPES[this.type]) {
      errors.type = 'Tipo de fuente no válido.';
    }
    if (!WATER_SOURCE_STATUSES[this.status]) {
      errors.status = 'Estado de fuente no válido.';
    }
    if (this.latitude !== null && !isValidLatitude(this.latitude)) {
      errors.latitude = 'La latitud debe estar entre -90 y 90 grados.';
    }
    if (this.longitude !== null && !isValidLongitude(this.longitude)) {
      errors.longitude = 'La longitud debe estar entre -180 y 180 grados.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la fuente de agua inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      type: this.type,
      siteId: this.siteId,
      latitude: this.latitude,
      longitude: this.longitude,
      status: this.status,
      observationDate: this.observationDate,
      mainUse: this.mainUse,
      responsible: this.responsible,
      notes: this.notes,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
