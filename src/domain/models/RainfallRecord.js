/**
 * Modelo de Dominio: Registro de Lluvia / Precipitación (RainfallRecord)
 */

import { generateId, isValidPrecipitation, isRequired, isValidDate } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const MEASUREMENT_TYPES = {
  manual: 'Medición manual (Lectura en campo)',
  automatica: 'Lectura de sensor/estación automática',
  importado: 'Dato importado / Respaldo histórico'
};

export class RainfallRecord {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.pluviometerId = data.pluviometerId || '';
    this.measuredAt = data.measuredAt || nowIso();
    this.precipitationMm = data.precipitationMm !== undefined && data.precipitationMm !== '' ? Number(data.precipitationMm) : null;
    this.measurementType = data.measurementType || 'manual';
    this.responsible = (data.responsible || '').trim();
    this.notes = (data.notes || '').trim();
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.pluviometerId)) {
      errors.pluviometerId = 'Debe seleccionar un pluviómetro asociado.';
    }

    if (!isValidDate(this.measuredAt)) {
      errors.measuredAt = 'La fecha y hora de la medición es inválida o requerida.';
    }

    if (!isValidPrecipitation(this.precipitationMm)) {
      errors.precipitationMm = 'La precipitación debe ser un número finito mayor o igual a cero (0 mm). No se admiten valores negativos.';
    }

    if (!MEASUREMENT_TYPES[this.measurementType]) {
      errors.measurementType = 'Tipo de medición no válido.';
    }

    if (!isRequired(this.responsible)) {
      errors.responsible = 'El nombre de la persona responsable de la medición es obligatorio.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la medición de lluvia inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      pluviometerId: this.pluviometerId,
      measuredAt: this.measuredAt,
      precipitationMm: this.precipitationMm,
      measurementType: this.measurementType,
      responsible: this.responsible,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
