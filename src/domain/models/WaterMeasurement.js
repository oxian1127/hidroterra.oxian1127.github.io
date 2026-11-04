/**
 * Modelo de Dominio: Medición de Disponibilidad Hídrica (WaterMeasurement) — HIDROTERRA
 * Representa mediciones periódicas de nivel, caudal o volumen en fuentes hídricas.
 * Diferencia explícitamente mediciones observadas de valores estimados por cálculo.
 */

import { generateId, isValidLatitude, isValidLongitude, isRequired, isValidDate } from '../../core/validators.js';
import { nowIso, getDayKey } from '../../core/date-utils.js';
import { ValidationError } from '../../core/errors.js';

export const WATER_MEASUREMENT_METHODS = {
  manual_nivel: 'Medición manual de nivel',
  regla_limnimetrica: 'Regla limnimétrica',
  cinta_sonda: 'Cinta o sonda de profundidad',
  volumetrico: 'Medición volumétrica (aforo directo)',
  estimacion_tecnica: 'Estimación técnica',
  otro: 'Otro método documentado'
};

export const WATER_MEASUREMENT_UNITS = {
  m: 'Metros (m)',
  cm: 'Centímetros (cm)',
  L: 'Litros (L)',
  m3: 'Metros cúbicos (m³)',
  l_s: 'Litros por segundo (L/s)',
  pct: 'Porcentaje de llenado (%)'
};

export const WATER_AVAILABILITY_STATUSES = {
  alta: 'Disponibilidad alta',
  moderada: 'Disponibilidad moderada',
  baja: 'Disponibilidad baja',
  critica: 'Disponibilidad crítica',
  sin_informacion: 'Sin información suficiente'
};

export const AVAILABILITY_STATUS_LABELS = WATER_AVAILABILITY_STATUSES;
export const MEASUREMENT_METHOD_LABELS = WATER_MEASUREMENT_METHODS;

export class WaterMeasurement {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.sourceId = data.sourceId || data.waterSourceId || '';
    this.sourceCode = (data.sourceCode || data.waterSourceCode || '').trim().toUpperCase();
    this.sourceType = data.sourceType || null;
    this.measuredAt = data.measuredAt || nowIso();
    this.measuredDate = data.measuredDate || getDayKey(this.measuredAt);
    this.measuredTime = data.measuredTime || (this.measuredAt.includes('T') ? this.measuredAt.split('T')[1].slice(0, 5) : '08:00');

    // Nivel de agua o valor principal medido
    this.waterLevel = data.waterLevel !== undefined && data.waterLevel !== '' && data.waterLevel !== null
      ? Number(data.waterLevel)
      : null;
    this.unit = data.unit === '%' ? 'pct' : (data.unit || 'm');

    // Profundidad total cuando corresponda (pozos, jagüeyes, reservorios, tanques)
    const rawDepth = data.totalDepthMeters ?? data.totalDepth;
    this.totalDepthMeters = rawDepth !== undefined && rawDepth !== '' && rawDepth !== null
      ? Number(rawDepth)
      : null;

    // Separación estricta entre volumen observado y volumen estimado mediante cálculo
    this.observedVolumeLiters = data.observedVolumeLiters !== undefined && data.observedVolumeLiters !== '' && data.observedVolumeLiters !== null
      ? Number(data.observedVolumeLiters)
      : null;
    this.estimatedVolumeLiters = data.estimatedVolumeLiters !== undefined && data.estimatedVolumeLiters !== '' && data.estimatedVolumeLiters !== null
      ? Number(data.estimatedVolumeLiters)
      : null;

    this.knownCapacityLiters = data.knownCapacityLiters !== undefined && data.knownCapacityLiters !== '' && data.knownCapacityLiters !== null
      ? Number(data.knownCapacityLiters)
      : null;
    const rawCapPct = data.availableCapacityPct ?? data.percentageAvailable;
    this.availableCapacityPct = rawCapPct !== undefined && rawCapPct !== '' && rawCapPct !== null
      ? Number(rawCapPct)
      : null;

    this.measurementMethod = data.measurementMethod || 'manual_nivel';
    // Indica explícitamente si el registro incluye o proviene de estimación técnica / cálculo
    this.isEstimatedCalculation = Boolean(
      data.isEstimatedCalculation ||
      this.measurementMethod === 'estimacion_tecnica' ||
      this.estimatedVolumeLiters !== null
    );

    this.status = data.status || data.availabilityStatus || 'sin_informacion';
    this.responsible = (data.responsible || '').trim();
    this.latitude = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : null;
    this.longitude = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : null;
    this.photoDataUrl = data.photoDataUrl || null;
    this.notes = (data.notes || data.observations || '').trim();
    this.syncStatus = data.syncStatus || 'pending';
    this.createdAt = data.createdAt || nowIso();
    this.updatedAt = data.updatedAt || nowIso();
  }

  /**
   * Convierte el nivel de agua a metros si la unidad es 'm' o 'cm'
   */
  getWaterLevelInMeters() {
    if (this.waterLevel === null || !Number.isFinite(this.waterLevel)) return null;
    if (this.unit === 'm') return this.waterLevel;
    if (this.unit === 'cm') return Number((this.waterLevel / 100).toFixed(4));
    return null;
  }

  validate() {
    const errors = {};

    if (!isRequired(this.sourceId)) {
      errors.sourceId = 'Debe seleccionar una fuente hídrica existente.';
    }
    if (!isValidDate(this.measuredAt)) {
      errors.measuredAt = 'La fecha y hora de la medición es obligatoria y debe ser válida.';
    }
    if (!WATER_MEASUREMENT_METHODS[this.measurementMethod]) {
      errors.measurementMethod = 'Método de medición no válido.';
    }
    if (!WATER_MEASUREMENT_UNITS[this.unit]) {
      errors.unit = 'Unidad de medición no válida.';
    }
    if (!WATER_AVAILABILITY_STATUSES[this.status]) {
      errors.status = 'Estado de disponibilidad hídrica no válido.';
    }

    if (this.waterLevel === null || !Number.isFinite(this.waterLevel) || this.waterLevel < 0) {
      errors.waterLevel = 'El nivel o valor medido de agua es obligatorio y debe ser un número mayor o igual a cero.';
    }

    if (this.unit === 'pct' && this.waterLevel !== null && (this.waterLevel < 0 || this.waterLevel > 100)) {
      errors.waterLevel = 'Cuando la unidad es porcentaje (%), el valor debe estar entre 0 y 100.';
    }

    if (this.totalDepthMeters !== null) {
      if (!Number.isFinite(this.totalDepthMeters) || this.totalDepthMeters <= 0) {
        errors.totalDepthMeters = 'La profundidad total debe ser un número positivo mayor a cero.';
      } else {
        const levelM = this.getWaterLevelInMeters();
        if (levelM !== null && levelM > this.totalDepthMeters) {
          errors.waterLevel = `El nivel de agua (${levelM} m) no puede superar la profundidad total registrada (${this.totalDepthMeters} m).`;
        }
      }
    }

    if (this.observedVolumeLiters !== null && (!Number.isFinite(this.observedVolumeLiters) || this.observedVolumeLiters < 0)) {
      errors.observedVolumeLiters = 'El volumen observado debe ser un número mayor o igual a cero.';
    }

    if (this.estimatedVolumeLiters !== null && (!Number.isFinite(this.estimatedVolumeLiters) || this.estimatedVolumeLiters < 0)) {
      errors.estimatedVolumeLiters = 'El volumen estimado debe ser un número mayor o igual a cero.';
    }

    if (this.availableCapacityPct !== null && (!Number.isFinite(this.availableCapacityPct) || this.availableCapacityPct < 0 || this.availableCapacityPct > 100)) {
      errors.availableCapacityPct = 'El porcentaje de capacidad disponible debe estar entre 0 y 100%.';
    }

    if (this.latitude !== null && !isValidLatitude(this.latitude)) {
      errors.latitude = 'La latitud debe estar entre -90 y 90 grados.';
    }
    if (this.longitude !== null && !isValidLongitude(this.longitude)) {
      errors.longitude = 'La longitud debe estar entre -180 y 180 grados.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Datos de la medición hídrica inválidos.', errors);
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      sourceCode: this.sourceCode,
      sourceType: this.sourceType,
      measuredAt: this.measuredAt,
      measuredDate: this.measuredDate,
      measuredTime: this.measuredTime,
      waterLevel: this.waterLevel,
      unit: this.unit,
      totalDepthMeters: this.totalDepthMeters,
      observedVolumeLiters: this.observedVolumeLiters,
      estimatedVolumeLiters: this.estimatedVolumeLiters,
      knownCapacityLiters: this.knownCapacityLiters,
      availableCapacityPct: this.availableCapacityPct,
      measurementMethod: this.measurementMethod,
      isEstimatedCalculation: this.isEstimatedCalculation,
      status: this.status,
      responsible: this.responsible,
      latitude: this.latitude,
      longitude: this.longitude,
      photoDataUrl: this.photoDataUrl,
      notes: this.notes,
      syncStatus: this.syncStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

