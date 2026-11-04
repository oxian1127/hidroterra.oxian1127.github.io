/**
 * Reglas de Dominio: Sistema de Alertas Hídricas Configurables (Sección 9)
 * Evalúa exclusivamente datos reales almacenados en HIDROTERRA.
 * Nunca genera alertas ficticias cuando no existen registros que las respalden.
 */

import { getMonthKey } from '../../core/date-utils.js';

export const DEFAULT_WATER_ALERT_RULES = {
  // Regla 1: Fuente con disponibilidad crítica en su última medición o estado seco/contaminado
  enableCriticalSourceAlert: true,
  // Regla 2: Disminución significativa del nivel o porcentaje de agua entre las dos últimas mediciones (%)
  significantDropThresholdPct: 25,
  // Regla 3: Tiempo prolongado sin mediciones en una fuente activa (días)
  maxDaysWithoutMeasurement: 30,
  // Regla 4: Baja precipitación acumulada en el mes actual (mm) cuando hay mediciones registradas
  minMonthlyRainfallThresholdMm: 35,
  // Regla 5: Riesgo de insuficiencia de almacenamiento (% de capacidad disponible en reservorios/tanques)
  lowStorageCapacityThresholdPct: 25,
  // Regla 6: Información de fuente o pluviómetro desactualizada (días desde última observación/actualización)
  outdatedEntityDays: 45
};

/**
 * Evalúa las reglas configurables contra los datos reales del territorio y devuelve las alertas detectadas.
 * Cada alerta tiene un `ruleCode` determinista por entidad para evitar duplicar la misma alerta activa.
 */
export function evaluateWaterAlerts({
  waterSources = [],
  waterMeasurements = [],
  rainfallRecords = [],
  pluviometers = [],
  customRules = {},
  referenceDateIso = null
}) {
  const rules = { ...DEFAULT_WATER_ALERT_RULES, ...customRules };
  const nowMs = referenceDateIso ? new Date(referenceDateIso).getTime() : Date.now();
  const generatedAt = referenceDateIso || new Date().toISOString();
  const candidates = [];

  // Agrupar mediciones hídricas por fuente ordenadas de más reciente a más antigua
  const measurementsBySource = new Map();
  waterMeasurements.forEach(m => {
    if (!m || !m.sourceId) return;
    if (!measurementsBySource.has(m.sourceId)) {
      measurementsBySource.set(m.sourceId, []);
    }
    measurementsBySource.get(m.sourceId).push(m);
  });

  measurementsBySource.forEach((list) => {
    list.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
  });

  const activeSources = waterSources.filter(s => s && s.active !== false);

  activeSources.forEach(source => {
    const sourceMeasurements = measurementsBySource.get(source.id) || [];
    const latest = sourceMeasurements[0] || null;
    const previous = sourceMeasurements[1] || null;

    // 1. Fuente con disponibilidad crítica (basada en medición real o estado verificado 'seca')
    if (rules.enableCriticalSourceAlert) {
      if (latest && latest.status === 'critica') {
        candidates.push({
          ruleCode: `CRIT_AVAIL_${source.id}`,
          type: 'disponibilidad_critica',
          priority: 'critica',
          relatedEntityType: 'water_source',
          relatedEntityId: source.id,
          relatedEntityName: `${source.code} — ${source.name}`,
          generatedAt,
          description: `La fuente "${source.name}" (${source.code}) registra disponibilidad crítica en su última medición (${latest.waterLevel} ${latest.unit}${latest.availableCapacityPct !== null ? `, ${latest.availableCapacityPct}% de capacidad` : ''}).`,
          ruleDescription: `Regla: Estado de disponibilidad clasificado como "Crítica" en medición de campo del ${latest.measuredAt.slice(0, 10)}.`
        });
      } else if (!latest && source.status === 'seca') {
        candidates.push({
          ruleCode: `CRIT_DRY_SOURCE_${source.id}`,
          type: 'disponibilidad_critica',
          priority: 'critica',
          relatedEntityType: 'water_source',
          relatedEntityId: source.id,
          relatedEntityName: `${source.code} — ${source.name}`,
          generatedAt,
          description: `La fuente "${source.name}" (${source.code}) fue reportada con estado observado "Seca / Sin caudal".`,
          ruleDescription: 'Regla: Fuente hídrica activa reportada en estado "Seca" en el inventario territorial.'
        });
      }
    }

    // 2. Disminución significativa del nivel o capacidad entre las 2 últimas mediciones reales
    if (latest && previous) {
      let currentVal = latest.availableCapacityPct !== null && latest.availableCapacityPct !== undefined
        ? Number(latest.availableCapacityPct)
        : (latest.unit === previous.unit ? Number(latest.waterLevel) : null);
      let prevVal = previous.availableCapacityPct !== null && previous.availableCapacityPct !== undefined
        ? Number(previous.availableCapacityPct)
        : (latest.unit === previous.unit ? Number(previous.waterLevel) : null);

      if (currentVal !== null && prevVal !== null && prevVal > 0 && currentVal < prevVal) {
        const dropPct = Number((((prevVal - currentVal) / prevVal) * 100).toFixed(1));
        if (dropPct >= rules.significantDropThresholdPct) {
          candidates.push({
            ruleCode: `LEVEL_DROP_${source.id}`,
            type: 'disminucion_nivel',
            priority: dropPct >= 40 ? 'critica' : 'alta',
            relatedEntityType: 'water_source',
            relatedEntityId: source.id,
            relatedEntityName: `${source.code} — ${source.name}`,
            generatedAt,
            description: `Disminución del ${dropPct}% registrada en "${source.name}" entre el ${previous.measuredAt.slice(0, 10)} (${previous.waterLevel} ${previous.unit}) y el ${latest.measuredAt.slice(0, 10)} (${latest.waterLevel} ${latest.unit}).`,
            ruleDescription: `Regla: Reducción de nivel o volumen ≥ ${rules.significantDropThresholdPct}% entre mediciones consecutivas (descenso medido: ${dropPct}%).`
          });
        }
      }
    }

    // 3. Riesgo de insuficiencia de almacenamiento (para reservorios, tanques, jagüeyes o fuentes con % conocido)
    if (latest && latest.availableCapacityPct !== null && latest.availableCapacityPct !== undefined) {
      const capPct = Number(latest.availableCapacityPct);
      if (capPct > 0 && capPct <= rules.lowStorageCapacityThresholdPct && latest.status !== 'critica') {
        candidates.push({
          ruleCode: `LOW_STORAGE_${source.id}`,
          type: 'riesgo_almacenamiento',
          priority: 'alta',
          relatedEntityType: 'water_source',
          relatedEntityId: source.id,
          relatedEntityName: `${source.code} — ${source.name}`,
          generatedAt,
          description: `La reserva disponible en "${source.name}" se encuentra al ${capPct}% de su capacidad conocida (${latest.estimatedVolumeLiters ?? latest.observedVolumeLiters ?? '—'} L).`,
          ruleDescription: `Regla: Capacidad de almacenamiento disponible ≤ ${rules.lowStorageCapacityThresholdPct}% (actual: ${capPct}%).`
        });
      }
    }

    // 4. Tiempo prolongado sin mediciones hídricas (cuando la fuente ya tiene historial pero lleva > N días sin nueva lectura)
    if (latest) {
      const lastMeasTime = new Date(latest.measuredAt).getTime();
      if (!isNaN(lastMeasTime)) {
        const daysSinceMeas = Math.floor((nowMs - lastMeasTime) / (1000 * 60 * 60 * 24));
        if (daysSinceMeas >= rules.maxDaysWithoutMeasurement) {
          candidates.push({
            ruleCode: `STALE_MEAS_${source.id}`,
            type: 'sin_mediciones_recientes',
            priority: 'media',
            relatedEntityType: 'water_source',
            relatedEntityId: source.id,
            relatedEntityName: `${source.code} — ${source.name}`,
            generatedAt,
            description: `Han transcurrido ${daysSinceMeas} días desde la última medición hídrica de "${source.name}" (última lectura: ${latest.measuredAt.slice(0, 10)}).`,
            ruleDescription: `Regla: Tiempo sin nuevas mediciones en fuente monitoreada ≥ ${rules.maxDaysWithoutMeasurement} días.`
          });
        }
      }
    } else if (source.observationDate) {
      // 5. Información desactualizada en fuente activa sin mediciones recientes
      const obsTime = new Date(source.observationDate).getTime();
      if (!isNaN(obsTime)) {
        const daysSinceObs = Math.floor((nowMs - obsTime) / (1000 * 60 * 60 * 24));
        if (daysSinceObs >= rules.outdatedEntityDays) {
          candidates.push({
            ruleCode: `OUTDATED_SOURCE_${source.id}`,
            type: 'informacion_desactualizada',
            priority: 'baja',
            relatedEntityType: 'water_source',
            relatedEntityId: source.id,
            relatedEntityName: `${source.code} — ${source.name}`,
            generatedAt,
            description: `La fuente "${source.name}" no registra mediciones de nivel ni actualización de su ficha desde hace ${daysSinceObs} días.`,
            ruleDescription: `Regla: Ficha de fuente sin actualización ni mediciones durante ≥ ${rules.outdatedEntityDays} días.`
          });
        }
      }
    }
  });

  // 6. Baja precipitación acumulada por pluviómetro en el mes más reciente con datos reales
  if (rainfallRecords.length > 0 && pluviometers.length > 0) {
    // Determinar el mes más reciente con mediciones reales
    const monthsWithData = Array.from(new Set(rainfallRecords.map(r => getMonthKey(r.measuredAt)).filter(Boolean))).sort();
    const latestMonth = monthsWithData[monthsWithData.length - 1];

    if (latestMonth) {
      const monthRecords = rainfallRecords.filter(r => getMonthKey(r.measuredAt) === latestMonth);
      // Agrupar por pluviómetro que tenga al menos 2 lecturas en el mes
      const byPluv = new Map();
      monthRecords.forEach(r => {
        if (!byPluv.has(r.pluviometerId)) {
          byPluv.set(r.pluviometerId, { totalMm: 0, count: 0 });
        }
        const entry = byPluv.get(r.pluviometerId);
        entry.totalMm = Number((entry.totalMm + (Number(r.precipitationMm) || 0)).toFixed(1));
        entry.count += 1;
      });

      byPluv.forEach((stats, pluvId) => {
        if (stats.count >= 2 && stats.totalMm < rules.minMonthlyRainfallThresholdMm) {
          const pluv = pluviometers.find(p => p.id === pluvId);
          const pluvName = pluv ? `${pluv.code} — ${pluv.name}` : pluvId;
          candidates.push({
            ruleCode: `LOW_RAIN_${pluvId}_${latestMonth}`,
            type: 'baja_precipitacion',
            priority: 'media',
            relatedEntityType: 'pluviometer',
            relatedEntityId: pluvId,
            relatedEntityName: pluvName,
            generatedAt,
            description: `El pluviómetro "${pluvName}" registra una precipitación acumulada baja de ${stats.totalMm} mm en el periodo ${latestMonth} (${stats.count} lecturas realizadas).`,
            ruleDescription: `Regla: Precipitación acumulada mensual < ${rules.minMonthlyRainfallThresholdMm} mm en pluviómetro con lecturas activas.`
          });
        }
      });
    }
  }

  return candidates;
}

