/**
 * Reglas de Dominio: Clasificación de Disponibilidad Hídrica y Tendencias (Sección 4.2, 4.3 y 4.4)
 * Criterios diferenciados según el tipo de infraestructura hídrica (pozo, jagüey, reservorio, tanque, etc.).
 */

/**
 * Umbrales técnicos diferenciados por tipo de infraestructura hídrica.
 * No se aplican los mismos umbrales a un pozo, un jagüey y un reservorio/tanque:
 * - Reservorio / Tanque / Almacenamiento: basado en porcentaje de capacidad útil o relación de nivel.
 * - Jagüey: cuerpo superficial sujeto a alta evaporación y colmatación; niveles bajos implican pérdida rápida de calidad.
 * - Pozo profundo / artesanal: columna de agua útil sobre el fondo o nivel dinámico.
 * - Manantial / Arroyo / Río / Acueducto: basado en caudal (L/s) o tirante hidrométrico relativo.
 */
export const INFRASTRUCTURE_THRESHOLDS = {
  pozo: {
    label: 'Pozo profundo / artesanal',
    recommendedUnits: ['m', 'cm', 'l_s'],
    // Porcentaje de columna de agua disponible respecto a profundidad útil total
    pctThresholds: { alta: 65, moderada: 40, baja: 20 },
    // Si solo se conoce la columna de agua sobre el fondo (en metros)
    levelMetersThresholds: { alta: 3.0, moderada: 1.5, baja: 0.6 },
    flowLsThresholds: { alta: 1.5, moderada: 0.6, baja: 0.2 },
    technicalCriteria: 'En pozos se evalúa la columna de agua disponible sobre el fondo o bomba (mínimo operativo seguro ≥ 1.5 m o ≥ 40% de columna útil).'
  },
  jaguey: {
    label: 'Jagüey comunitario / ganadero',
    recommendedUnits: ['m', 'cm', 'm3', 'L', 'pct'],
    // Los jagüeyes tienen alta tasa de evaporación y sedimento en el fondo (último 25% suele ser lodo/turbidez alta)
    pctThresholds: { alta: 75, moderada: 50, baja: 30 },
    levelMetersThresholds: { alta: 2.2, moderada: 1.3, baja: 0.7 },
    technicalCriteria: 'En jagüeyes superficiales las pérdidas por evaporación y el volumen muerto de sedimentos exigen umbrales preventivos más altos (disponibilidad crítica < 30% o < 0.7 m).'
  },
  reservorio: {
    label: 'Reservorio / Represa predial',
    recommendedUnits: ['m', 'cm', 'm3', 'L', 'pct'],
    pctThresholds: { alta: 70, moderada: 45, baja: 25 },
    levelMetersThresholds: { alta: 2.5, moderada: 1.4, baja: 0.6 },
    technicalCriteria: 'En reservorios multipropósito se clasifica según el porcentaje de volumen útil almacenado o tirante de agua.'
  },
  tanque: {
    label: 'Tanque de almacenamiento',
    recommendedUnits: ['L', 'm3', 'm', 'cm', 'pct'],
    pctThresholds: { alta: 70, moderada: 40, baja: 20 },
    levelMetersThresholds: { alta: 1.5, moderada: 0.9, baja: 0.4 },
    technicalCriteria: 'En tanques cerrados o elevados se evalúa el porcentaje directo de llenado respecto a la capacidad nominal.'
  },
  almacenamiento: {
    label: 'Punto / Sistema de almacenamiento',
    recommendedUnits: ['L', 'm3', 'm', 'cm', 'pct'],
    pctThresholds: { alta: 70, moderada: 40, baja: 20 },
    levelMetersThresholds: { alta: 1.5, moderada: 0.9, baja: 0.4 },
    technicalCriteria: 'Evaluación directa del volumen almacenado frente a la capacidad nominal del depósito.'
  },
  captacion: {
    label: 'Punto de captación de agua lluvia',
    recommendedUnits: ['L', 'm3', 'cm', 'm', 'pct'],
    pctThresholds: { alta: 70, moderada: 40, baja: 20 },
    levelMetersThresholds: { alta: 1.2, moderada: 0.6, baja: 0.25 },
    technicalCriteria: 'Evaluación del volumen captado y retenido en el sistema colector.'
  },
  manantial: {
    label: 'Manantial / Ojo de agua',
    recommendedUnits: ['l_s', 'L', 'cm', 'm'],
    pctThresholds: { alta: 70, moderada: 45, baja: 25 },
    levelMetersThresholds: { alta: 0.6, moderada: 0.35, baja: 0.15 },
    flowLsThresholds: { alta: 0.8, moderada: 0.3, baja: 0.1 },
    technicalCriteria: 'En manantiales y nacimientos se prioriza el aforo volumétrico (L/s) o la lámina en caja de inspección.'
  },
  arroyo: {
    label: 'Arroyo estacional / permanente',
    recommendedUnits: ['m', 'cm', 'l_s'],
    pctThresholds: { alta: 70, moderada: 45, baja: 25 },
    levelMetersThresholds: { alta: 0.8, moderada: 0.4, baja: 0.15 },
    flowLsThresholds: { alta: 5.0, moderada: 1.5, baja: 0.3 },
    technicalCriteria: 'En arroyos de Montes de María se monitorea el tirante hidrométrico en regla limnimétrica o caudal estimado.'
  },
  rio: {
    label: 'Río',
    recommendedUnits: ['m', 'cm', 'l_s'],
    pctThresholds: { alta: 70, moderada: 45, baja: 25 },
    levelMetersThresholds: { alta: 1.5, moderada: 0.8, baja: 0.35 },
    flowLsThresholds: { alta: 15.0, moderada: 5.0, baja: 1.0 },
    technicalCriteria: 'Clasificación por nivel limnimétrico en sección de control.'
  },
  acueducto: {
    label: 'Acueducto rural / Veredal',
    recommendedUnits: ['l_s', 'm3', 'L', 'pct', 'm'],
    pctThresholds: { alta: 75, moderada: 50, baja: 25 },
    levelMetersThresholds: { alta: 1.5, moderada: 0.9, baja: 0.4 },
    flowLsThresholds: { alta: 2.0, moderada: 0.8, baja: 0.25 },
    technicalCriteria: 'Se evalúa el caudal de conducción (L/s) o el porcentaje de reserva en el tanque cabecero.'
  },
  otra: {
    label: 'Otra fuente hídrica',
    recommendedUnits: ['m', 'cm', 'L', 'm3', 'l_s', 'pct'],
    pctThresholds: { alta: 70, moderada: 45, baja: 20 },
    levelMetersThresholds: { alta: 1.5, moderada: 0.8, baja: 0.3 },
    flowLsThresholds: { alta: 1.0, moderada: 0.4, baja: 0.1 },
    technicalCriteria: 'Criterio general por porcentaje de capacidad disponible o nivel relativo.'
  }
};

/**
 * Obtiene la configuración de umbrales según el tipo de fuente
 */
export function getInfrastructureConfig(sourceType = 'otra') {
  return INFRASTRUCTURE_THRESHOLDS[sourceType] || INFRASTRUCTURE_THRESHOLDS.otra;
}

/**
 * Calcula el porcentaje de capacidad disponible y/o volumen estimado cuando existen datos suficientes,
 * diferenciando valores medidos de valores estimados.
 */
export function computeMeasurementMetrics({
  waterLevel,
  unit = 'm',
  totalDepthMeters = null,
  knownCapacityLiters = null,
  observedVolumeLiters = null,
  estimatedVolumeLiters = null
}) {
  const level = waterLevel !== null && waterLevel !== undefined && waterLevel !== '' ? Number(waterLevel) : null;
  const depth = totalDepthMeters !== null && totalDepthMeters !== undefined && totalDepthMeters !== '' ? Number(totalDepthMeters) : null;
  const capacity = knownCapacityLiters !== null && knownCapacityLiters !== undefined && knownCapacityLiters !== '' ? Number(knownCapacityLiters) : null;

  let computedObservedVolL = observedVolumeLiters !== null && observedVolumeLiters !== undefined && observedVolumeLiters !== ''
    ? Number(observedVolumeLiters)
    : null;
  let computedEstimatedVolL = estimatedVolumeLiters !== null && estimatedVolumeLiters !== undefined && estimatedVolumeLiters !== ''
    ? Number(estimatedVolumeLiters)
    : null;
  let availableCapacityPct = null;
  let isEstimatedCalculation = false;

  if (level !== null && Number.isFinite(level) && level >= 0) {
    if (unit === 'L' && computedObservedVolL === null) {
      computedObservedVolL = Number(level.toFixed(2));
    } else if (unit === 'm3' && computedObservedVolL === null) {
      computedObservedVolL = Number((level * 1000).toFixed(2));
    } else if (unit === 'pct') {
      availableCapacityPct = Math.min(100, Math.max(0, Number(level.toFixed(1))));
      if (capacity && capacity > 0 && computedEstimatedVolL === null && computedObservedVolL === null) {
        computedEstimatedVolL = Number(((availableCapacityPct / 100) * capacity).toFixed(1));
        isEstimatedCalculation = true;
      }
    }

    // Si la unidad es longitudinal (m o cm) y existe profundidad total conocida
    const levelMeters = unit === 'm' ? level : unit === 'cm' ? level / 100 : null;
    if (levelMeters !== null && depth && depth > 0 && levelMeters <= depth) {
      const ratio = levelMeters / depth;
      if (availableCapacityPct === null) {
        availableCapacityPct = Number((ratio * 100).toFixed(1));
      }
      if (capacity && capacity > 0 && computedEstimatedVolL === null && computedObservedVolL === null) {
        computedEstimatedVolL = Number((ratio * capacity).toFixed(1));
        isEstimatedCalculation = true;
      }
    }

    // Si se conoce el volumen (observado o estimado) y la capacidad total conocida
    const effectiveVolume = computedObservedVolL !== null ? computedObservedVolL : computedEstimatedVolL;
    if (availableCapacityPct === null && effectiveVolume !== null && capacity && capacity > 0) {
      availableCapacityPct = Math.min(100, Math.max(0, Number(((effectiveVolume / capacity) * 100).toFixed(1))));
    }
  }

  if (computedEstimatedVolL !== null) {
    isEstimatedCalculation = true;
  }

  return {
    observedVolumeLiters: computedObservedVolL,
    estimatedVolumeLiters: computedEstimatedVolL,
    availableCapacityPct,
    isEstimatedCalculation
  };
}

/**
 * Clasifica el estado de disponibilidad hídrica según el tipo de infraestructura y los datos reales medidos.
 * Cuando no existan datos suficientes, devuelve explícitamente 'sin_informacion'.
 *
 * @returns {{ status: 'alta'|'moderada'|'baja'|'critica'|'sin_informacion', reason: string }}
 */
export function classifyWaterAvailability({
  sourceType = 'pozo',
  waterLevel = null,
  unit = 'm',
  totalDepthMeters = null,
  availableCapacityPct = null,
  knownCapacityLiters = null,
  observedVolumeLiters = null,
  estimatedVolumeLiters = null,
  customThresholds = null
}) {
  const config = getInfrastructureConfig(sourceType);
  const pctRules = customThresholds?.pctThresholds || config.pctThresholds;
  const levelRules = customThresholds?.levelMetersThresholds || config.levelMetersThresholds;
  const flowRules = customThresholds?.flowLsThresholds || config.flowLsThresholds;

  const numLevel = waterLevel !== null && waterLevel !== undefined && waterLevel !== '' ? Number(waterLevel) : null;
  if (numLevel === null || !Number.isFinite(numLevel) || numLevel < 0) {
    return {
      status: 'sin_informacion',
      reason: 'No se dispone de una medición numérica válida para determinar el estado.'
    };
  }

  // Si el nivel o caudal medido es exactamente 0, la disponibilidad es crítica
  if (numLevel === 0) {
    return {
      status: 'critica',
      reason: `Nivel o caudal registrado en 0 ${unit} (${config.label}).`
    };
  }

  // 1. Prioridad: Clasificación por porcentaje de capacidad disponible (si está calculado o medido)
  const pct = availableCapacityPct !== null && availableCapacityPct !== undefined && Number.isFinite(Number(availableCapacityPct))
    ? Number(availableCapacityPct)
    : (unit === 'pct' ? numLevel : null);

  if (pct !== null && pctRules) {
    if (pct >= pctRules.alta) {
      return { status: 'alta', reason: `${pct}% de capacidad disponible (Umbral alta ≥ ${pctRules.alta}% para ${config.label}).` };
    }
    if (pct >= pctRules.moderada) {
      return { status: 'moderada', reason: `${pct}% de capacidad disponible (Rango moderado: ${pctRules.moderada}% – ${pctRules.alta - 0.1}% para ${config.label}).` };
    }
    if (pct >= pctRules.baja) {
      return { status: 'baja', reason: `${pct}% de capacidad disponible (Alerta preventiva: ${pctRules.baja}% – ${pctRules.moderada - 0.1}% para ${config.label}).` };
    }
    return { status: 'critica', reason: `${pct}% de capacidad disponible (Umbral crítico < ${pctRules.baja}% para ${config.label}).` };
  }

  // 2. Clasificación por nivel en metros o centímetros
  const levelMeters = unit === 'm' ? numLevel : unit === 'cm' ? numLevel / 100 : null;
  if (levelMeters !== null && levelRules) {
    // Si hay profundidad total, podemos usar relación porcentual de columna de agua
    if (totalDepthMeters && Number(totalDepthMeters) > 0) {
      const depthRatioPct = Number(((levelMeters / Number(totalDepthMeters)) * 100).toFixed(1));
      if (depthRatioPct >= pctRules.alta) {
        return { status: 'alta', reason: `Relación de nivel ${depthRatioPct}% (${levelMeters.toFixed(2)} m de ${totalDepthMeters} m en ${config.label}).` };
      }
      if (depthRatioPct >= pctRules.moderada) {
        return { status: 'moderada', reason: `Relación de nivel ${depthRatioPct}% (${levelMeters.toFixed(2)} m de ${totalDepthMeters} m en ${config.label}).` };
      }
      if (depthRatioPct >= pctRules.baja) {
        return { status: 'baja', reason: `Relación de nivel baja ${depthRatioPct}% (${levelMeters.toFixed(2)} m de ${totalDepthMeters} m en ${config.label}).` };
      }
      return { status: 'critica', reason: `Relación de nivel crítica ${depthRatioPct}% (${levelMeters.toFixed(2)} m de ${totalDepthMeters} m en ${config.label}).` };
    }

    // Si no se registró la profundidad total:
    // Para tanques/almacenamiento sin altura de referencia o capacidad conocida, advertir si no es determinable
    if ((sourceType === 'tanque' || sourceType === 'almacenamiento') && !totalDepthMeters && !knownCapacityLiters) {
      return {
        status: 'sin_informacion',
        reason: 'Para clasificar un tanque por nivel (m/cm) se requiere conocer su profundidad total o capacidad nominal.'
      };
    }

    if (levelMeters >= levelRules.alta) {
      return { status: 'alta', reason: `Lámina/columna de agua de ${levelMeters.toFixed(2)} m (≥ ${levelRules.alta} m para ${config.label}).` };
    }
    if (levelMeters >= levelRules.moderada) {
      return { status: 'moderada', reason: `Lámina/columna de agua de ${levelMeters.toFixed(2)} m (moderada ≥ ${levelRules.moderada} m para ${config.label}).` };
    }
    if (levelMeters >= levelRules.baja) {
      return { status: 'baja', reason: `Lámina/columna de agua reducida de ${levelMeters.toFixed(2)} m (baja ≥ ${levelRules.baja} m para ${config.label}).` };
    }
    return { status: 'critica', reason: `Lámina/columna de agua crítica de ${levelMeters.toFixed(2)} m (< ${levelRules.baja} m para ${config.label}).` };
  }

  // 3. Clasificación por caudal en litros por segundo (L/s)
  if (unit === 'l_s' && flowRules) {
    if (numLevel >= flowRules.alta) {
      return { status: 'alta', reason: `Caudal aforado de ${numLevel} L/s (≥ ${flowRules.alta} L/s para ${config.label}).` };
    }
    if (numLevel >= flowRules.moderada) {
      return { status: 'moderada', reason: `Caudal aforado de ${numLevel} L/s (moderado ≥ ${flowRules.moderada} L/s para ${config.label}).` };
    }
    if (numLevel >= flowRules.baja) {
      return { status: 'baja', reason: `Caudal bajo de ${numLevel} L/s (≥ ${flowRules.baja} L/s para ${config.label}).` };
    }
    return { status: 'critica', reason: `Caudal crítico de ${numLevel} L/s (< ${flowRules.baja} L/s para ${config.label}).` };
  }

  // 4. Si se ingresó volumen en L o m³ pero no se conoce la capacidad nominal de la infraestructura
  const volL = observedVolumeLiters ?? estimatedVolumeLiters ?? (unit === 'L' ? numLevel : unit === 'm3' ? numLevel * 1000 : null);
  if (volL !== null && (!knownCapacityLiters || Number(knownCapacityLiters) <= 0)) {
    return {
      status: 'sin_informacion',
      reason: 'Se registró volumen en litros/m³, pero la fuente no tiene capacidad total conocida configurada para determinar el porcentaje de disponibilidad.'
    };
  }

  return {
    status: 'sin_informacion',
    reason: 'Datos insuficientes (falta capacidad nominal o profundidad de referencia para esta unidad).'
  };
}

/**
 * Calcula la variación porcentual y la tendencia histórica de una serie de mediciones de una fuente
 */
export function calculateSourceAvailabilityTrend(measurements = []) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return {
      hasEnoughData: false,
      trend: 'sin_datos',
      trendLabel: 'Sin mediciones registradas',
      variationPct: null,
      levelDiff: null,
      latestMeasurement: null,
      previousMeasurement: null
    };
  }

  // Ordenar cronológicamente de más reciente a más antigua
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  );

  const latest = sorted[0];
  if (sorted.length < 2) {
    return {
      hasEnoughData: false,
      trend: 'unica_medicion',
      trendLabel: 'Única medición (se requieren ≥ 2 lecturas para tendencia)',
      variationPct: null,
      levelDiff: null,
      latestMeasurement: latest,
      previousMeasurement: null
    };
  }

  // Buscar la medición inmediatamente anterior con la misma unidad o porcentaje comparable
  const previous = sorted[1];

  let currentVal = latest.availableCapacityPct !== null && latest.availableCapacityPct !== undefined
    ? Number(latest.availableCapacityPct)
    : Number(latest.waterLevel);
  let prevVal = previous.availableCapacityPct !== null && previous.availableCapacityPct !== undefined
    ? Number(previous.availableCapacityPct)
    : Number(previous.waterLevel);

  // Normalizar cm a m si comparamos m y cm
  if (latest.availableCapacityPct === null || previous.availableCapacityPct === null) {
    if (latest.unit === 'cm' && previous.unit === 'm') {
      currentVal = Number(latest.waterLevel) / 100;
      prevVal = Number(previous.waterLevel);
    } else if (latest.unit === 'm' && previous.unit === 'cm') {
      currentVal = Number(latest.waterLevel);
      prevVal = Number(previous.waterLevel) / 100;
    } else if (latest.unit !== previous.unit) {
      return {
        hasEnoughData: false,
        trend: 'unidades_distintas',
        trendLabel: 'Últimas mediciones en unidades distintas',
        variationPct: null,
        levelDiff: null,
        latestMeasurement: latest,
        previousMeasurement: previous
      };
    }
  }

  const diff = Number((currentVal - prevVal).toFixed(2));
  const variationPct = prevVal > 0
    ? Number((((currentVal - prevVal) / prevVal) * 100).toFixed(1))
    : (currentVal > 0 ? 100 : 0);

  let trend = 'estable';
  let trendLabel = 'Estable (variación < 3%)';

  if (variationPct >= 3) {
    trend = 'recuperacion';
    trendLabel = `En recuperación (+${variationPct}%)`;
  } else if (variationPct <= -3) {
    trend = 'disminucion';
    trendLabel = `En disminución (${variationPct}%)`;
  }

  return {
    hasEnoughData: true,
    trend,
    trendLabel,
    variationPct,
    levelDiff: diff,
    latestMeasurement: latest,
    previousMeasurement: previous
  };
}

