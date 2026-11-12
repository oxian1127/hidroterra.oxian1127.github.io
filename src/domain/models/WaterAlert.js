/**
 * Modelo de Dominio: Alerta Hídrica (WaterAlert) — HIDROTERRA
 * Representa alertas generadas a partir de datos reales del territorio bajo reglas configurables.
 */

import { generateId, isRequired } from '../../core/validators.js';
import { nowIso } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const WATER_ALERT_TYPES = {
  disponibilidad_critica: 'Fuente con disponibilidad crítica',
  disminucion_nivel: 'Disminución significativa del nivel de agua',
  sin_mediciones_recientes: 'Tiempo prolongado sin mediciones',
  baja_precipitacion: 'Baja precipitación acumulada',
  riesgo_almacenamiento: 'Riesgo de insuficiencia de almacenamiento',
  informacion_desactualizada: 'Información territorial desactualizada'
};

export const WATER_ALERT_PRIORITIES = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Informativa / Baja'
};

export const WATER_ALERT_STATUSES = {
  activa: 'Pendiente de atención',
  atendida: 'Atendida / Resuelta'
};

export class WaterAlert {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.ruleCode = (data.ruleCode || 'RULE_CUSTOM').trim();
    this.type = data.type || 'disponibilidad_critica';
    this.priority = data.priority || 'media';
    this.relatedEntityType = data.relatedEntityType || 'water_source';
    this.relatedEntityId = data.relatedEntityId || null;
    this.relatedEntityName = (data.relatedEntityName || '').trim();
    this.generatedAt = data.generatedAt || nowIso();
    this.description = (data.description || '').trim();
    this.ruleDescription = (data.ruleDescription || '').trim();
    this.status = data.status || 'activa';
    this.resolvedAt = data.resolvedAt || null;
    this.resolutionNotes = (data.resolutionNotes || '').trim();
    this.organizationId = data.organizationId || null;
    this.syncStatus = data.syncStatus || 'pending';
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  validate() {
    const errors = {};

    if (!WATER_ALERT_TYPES[this.type]) {
      errors.type = 'Tipo de alerta hídrica no válido.';
    }
    if (!WATER_ALERT_PRIORITIES[this.priority]) {
      errors.priority = 'Nivel de prioridad no válido.';
    }
    if (!WATER_ALERT_STATUSES[this.status]) {
      errors.status = 'Estado de atención de alerta no válido.';
    }
    if (!isRequired(this.description)) {
      errors.description = 'La descripción de la alerta es obligatoria.';
    }
    if (!isRequired(this.ruleDescription)) {
      errors.ruleDescription = 'Debe especificarse la regla que originó la alerta.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la alerta hídrica inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      ruleCode: this.ruleCode,
      type: this.type,
      priority: this.priority,
      relatedEntityType: this.relatedEntityType,
      relatedEntityId: this.relatedEntityId,
      relatedEntityName: this.relatedEntityName,
      generatedAt: this.generatedAt,
      description: this.description,
      ruleDescription: this.ruleDescription,
      status: this.status,
      resolvedAt: this.resolvedAt,
      resolutionNotes: this.resolutionNotes,
      organizationId: this.organizationId,
      syncStatus: this.syncStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

