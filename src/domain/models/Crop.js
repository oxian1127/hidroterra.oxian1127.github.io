/**
 * Modelo de Dominio: Cultivo (Crop)
 */

import { generateId, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const CROP_STATUSES = {
  activo: 'Activo / En crecimiento',
  cosechado: 'Cosechado',
  perdido: 'Perdido (sequía, plaga o inundación)'
};

export class Crop {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.parcelId = data.parcelId || '';
    this.name = (data.name || '').trim();
    this.plantDate = data.plantDate || null;
    this.cropArea = data.cropArea !== undefined && data.cropArea !== '' && data.cropArea !== null ? Number(data.cropArea) : null;
    this.status = data.status || 'activo';
    this.notes = (data.notes || '').trim();
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!isRequired(this.parcelId)) {
      errors.parcelId = 'Debe seleccionar una parcela asociada.';
    }
    if (!isRequired(this.name)) {
      errors.name = 'El nombre del cultivo es obligatorio.';
    }
    if (!CROP_STATUSES[this.status]) {
      errors.status = 'Estado de cultivo no válido.';
    }
    if (this.cropArea !== null && (!Number.isFinite(this.cropArea) || this.cropArea < 0)) {
      errors.cropArea = 'El área sembrada debe ser un número positivo.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos del cultivo inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      parcelId: this.parcelId,
      name: this.name,
      plantDate: this.plantDate,
      cropArea: this.cropArea,
      status: this.status,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
