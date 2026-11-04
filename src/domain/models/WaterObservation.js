/**
 * Modelo de Dominio: Observación Hídrica / Nota de Campo (WaterObservation)
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const OBSERVATION_CATEGORIES = {
  disponibilidad_agua: 'Disponibilidad y acceso al agua',
  condicion_fuente: 'Estado físico o turbidez de la fuente',
  sequia: 'Afectación por sequía / Estiaje',
  condicion_suelo: 'Humedad o erosión del suelo',
  productiva: 'Afectación en cultivos o animales',
  otra: 'Otra observación territorial'
};

export const RELATED_ENTITY_TYPES = {
  none: 'Sin vinculación directa',
  site: 'Sitio o Comunidad',
  water_source: 'Fuente de Agua',
  pluviometer: 'Pluviómetro',
  parcel: 'Parcela productiva'
};

export class WaterObservation {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.observedAt = data.observedAt || nowIso();
    this.category = data.category || 'disponibilidad_agua';
    this.relatedEntityType = data.relatedEntityType || 'none';
    this.relatedEntityId = data.relatedEntityId || null;
    this.description = (data.description || '').trim();
    this.observedStatus = (data.observedStatus || '').trim();
    this.responsible = (data.responsible || '').trim();
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.notes = (data.notes || '').trim();
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.description)) {
      errors.description = 'La descripción de la observación es obligatoria.';
    }
    if (!OBSERVATION_CATEGORIES[this.category]) {
      errors.category = 'Categoría de observación no válida.';
    }
    if (this.latitude !== null && !isValidLatitude(this.latitude)) {
      errors.latitude = 'La latitud debe estar entre -90 y 90 grados.';
    }
    if (this.longitude !== null && !isValidLongitude(this.longitude)) {
      errors.longitude = 'La longitud debe estar entre -180 y 180 grados.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la observación hídrica inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      observedAt: this.observedAt,
      category: this.category,
      relatedEntityType: this.relatedEntityType,
      relatedEntityId: this.relatedEntityId,
      description: this.description,
      observedStatus: this.observedStatus,
      responsible: this.responsible,
      latitude: this.latitude,
      longitude: this.longitude,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
