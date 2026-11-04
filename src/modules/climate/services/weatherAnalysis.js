/**
 * Motor de Análisis Agroclimático y Generador de Alertas Informativas (Sección 5 y 6)
 * Procesa los datos meteorológicos de Open-Meteo e integra las mediciones reales de HIDROTERRA.
 */

import { WEATHER_CONFIG } from '../config/weatherConfig.js';
import { safeNumber } from '../utils/weatherValidators.js';

/**
 * Calcula los 4 grupos de indicadores agroclimáticos a partir de la consulta meteorológica
 */
export function computeAgroclimaticIndicators(weatherRecord, customRules = {}) {
  const rules = { ...WEATHER_CONFIG.alertRules, ...customRules };
  const current = weatherRecord?.current || {};
  const next24h = weatherRecord?.hourly?.next24Hours || [];
  const days = weatherRecord?.daily?.days || [];
  const today = days[0] || {};

  // 1. Indicador de Precipitación
  const rainNext24hMm = Number(
    next24h.reduce((sum, h) => sum + (safeNumber(h.precipitationMm, 0) || 0), 0).toFixed(1)
  );
  const rainNext7dMm = Number(
    days.reduce((sum, d) => sum + (safeNumber(d.precipitationSumMm, 0) || 0), 0).toFixed(1)
  );

  // Días consecutivos sin lluvia significativa pronosticada (< dryDayThresholdMm)
  let maxConsecutiveDryDays = 0;
  let currentDryStreak = 0;
  let totalDryDays7d = 0;

  days.forEach((d) => {
    const rain = safeNumber(d.precipitationSumMm, 0);
    if (rain < rules.dryDayThresholdMm) {
      currentDryStreak++;
      totalDryDays7d++;
      if (currentDryStreak > maxConsecutiveDryDays) {
        maxConsecutiveDryDays = currentDryStreak;
      }
    } else {
      currentDryStreak = 0;
    }
  });

  const maxRainProb24hPct = next24h.reduce(
    (max, h) => Math.max(max, safeNumber(h.precipitationProbabilityPct, 0)),
    safeNumber(today.precipitationProbabilityMaxPct, 0)
  );

  // 2. Indicador de Temperatura
  const validMaxTemps = days.map(d => safeNumber(d.tempMaxC, null)).filter(v => v !== null);
  const validMinTemps = days.map(d => safeNumber(d.tempMinC, null)).filter(v => v !== null);

  const tempMax7dC = validMaxTemps.length > 0 ? Math.max(...validMaxTemps) : safeNumber(current.temperatureC, null);
  const tempMin7dC = validMinTemps.length > 0 ? Math.min(...validMinTemps) : safeNumber(current.temperatureC, null);

  const todayTempMaxC = safeNumber(today.tempMaxC, tempMax7dC);
  const todayTempMinC = safeNumber(today.tempMinC, tempMin7dC);
  const todayThermalAmplitudeC = (todayTempMaxC !== null && todayTempMinC !== null)
    ? Number((todayTempMaxC - todayTempMinC).toFixed(1))
    : null;

  const amplitudes = days
    .filter(d => safeNumber(d.tempMaxC, null) !== null && safeNumber(d.tempMinC, null) !== null)
    .map(d => d.tempMaxC - d.tempMinC);
  const avgThermalAmplitude7dC = amplitudes.length > 0
    ? Number((amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length).toFixed(1))
    : todayThermalAmplitudeC;

  // 3. Indicador de Evapotranspiración de Referencia (FAO ET0)
  const todayEt0Mm = Number((safeNumber(today.et0SumMm, 0)).toFixed(2));
  const cumulativeEt07dMm = Number(
    days.reduce((sum, d) => sum + (safeNumber(d.et0SumMm, 0) || 0), 0).toFixed(1)
  );
  const estimatedAtmosphericBalance7dMm = Number((rainNext7dMm - cumulativeEt07dMm).toFixed(1));

  // 4. Indicador de Humedad (Aire y Suelo Estimado)
  const currentAirHumidityPct = safeNumber(current.humidityPct, null);
  const validHum24 = next24h.map(h => safeNumber(h.humidityPct, null)).filter(v => v !== null);
  const avgAirHumidity24hPct = validHum24.length > 0
    ? Math.round(validHum24.reduce((a, b) => a + b, 0) / validHum24.length)
    : currentAirHumidityPct;

  const estimatedSoilMoistureM3 = safeNumber(current.soilMoistureM3, null);
  const estimatedSoilMoisturePct = estimatedSoilMoistureM3 !== null
    ? Number((estimatedSoilMoistureM3 * 100).toFixed(1))
    : null;

  return {
    precipitation: {
      rainNext24hMm,
      rainNext7dMm,
      consecutiveDryDays: maxConsecutiveDryDays,
      totalDryDays7d,
      maxRainProb24hPct
    },
    temperature: {
      currentTempC: safeNumber(current.temperatureC, null),
      todayTempMaxC,
      todayTempMinC,
      tempMax7dC,
      tempMin7dC,
      todayThermalAmplitudeC,
      avgThermalAmplitude7dC
    },
    evapotranspiration: {
      todayEt0Mm,
      cumulativeEt07dMm,
      estimatedAtmosphericBalance7dMm
    },
    humidity: {
      currentAirHumidityPct,
      avgAirHumidity24hPct,
      estimatedSoilMoistureM3,
      estimatedSoilMoisturePct
    }
  };
}

/**
 * Genera alertas agroclimáticas informativas basadas en reglas configurables (Sección 6).
 * Nunca afirma sequía confirmada ni riesgo agronómico definitivo basándose solo en pronósticos.
 */
export function generateAgroclimaticAlerts(weatherRecord, indicators, customRules = {}) {
  if (!weatherRecord || !indicators) return [];

  const rules = { ...WEATHER_CONFIG.alertRules, ...customRules };
  const locationName = weatherRecord.location?.name || 'Ubicación consultada';
  const generatedAt = new Date().toISOString();
  const alerts = [];

  const { precipitation, temperature, evapotranspiration } = indicators;

  // Regla 1: Posible periodo seco (días consecutivos sin precipitación significativa pronosticada)
  if (precipitation.consecutiveDryDays >= rules.consecutiveDryDaysAlert) {
    alerts.push({
      id: 'alert-dry-spell',
      type: 'Posible periodo seco en pronóstico',
      location: locationName,
      generatedAt,
      attentionLevel: precipitation.consecutiveDryDays >= 6 ? 'seguimiento' : 'atencion',
      badgeClass: precipitation.consecutiveDryDays >= 6 ? 'badge-warning' : 'badge-info',
      icon: 'fa-sun-plant-wilt',
      triggerVariables: `${precipitation.consecutiveDryDays} días consecutivos con lluvia pronosticada < ${rules.dryDayThresholdMm} mm (Acumulado 7d: ${precipitation.rainNext7dMm} mm)`,
      description: `El modelo meteorológico proyecta ${precipitation.consecutiveDryDays} días seguidos sin precipitaciones significativas en el entorno de ${locationName}.`,
      recommendation: 'Indicador orientativo de pronóstico: se sugiere verificar en campo el nivel de las fuentes de agua locales y priorizar la conservación de humedad del suelo (coberturas vegetales o mulching) en las parcelas activas.'
    });
  }

  // Regla 2: Precipitación próxima o lluvia significativa estimada
  if (
    precipitation.maxRainProb24hPct >= rules.rainProbabilityThresholdPct ||
    precipitation.rainNext24hMm >= rules.significantDailyRainMm
  ) {
    const isHeavy = precipitation.rainNext24hMm >= rules.heavyDailyRainMm;
    alerts.push({
      id: 'alert-upcoming-rain',
      type: isHeavy ? 'Pronóstico de lluvia intensa próxima' : 'Probabilidad de precipitación próxima',
      location: locationName,
      generatedAt,
      attentionLevel: isHeavy ? 'seguimiento' : 'informativo',
      badgeClass: isHeavy ? 'badge-warning' : 'badge-info',
      icon: 'fa-cloud-showers-heavy',
      triggerVariables: `Probabilidad máx. 24h: ${precipitation.maxRainProb24hPct}% | Lluvia estimada 24h: ${precipitation.rainNext24hMm} mm`,
      description: `Se estima alta probabilidad de lluvias en las próximas 24 horas (${precipitation.maxRainProb24hPct}%), con una lámina estimada por el modelo de ${precipitation.rainNext24hMm} mm.`,
      recommendation: 'Recomendación orientativa: preparar sistemas comunitarios de cosecha de agua lluvia, verificar que los pluviómetros manuales estén limpios y nivelados para tomar la lectura, y revisar canales de escorrentía en parcelas.'
    });
  }

  // Regla 3: Temperatura elevada
  if (
    temperature.todayTempMaxC !== null &&
    (temperature.todayTempMaxC >= rules.highTemperatureThresholdC || temperature.tempMax7dC >= rules.highTemperatureThresholdC)
  ) {
    const peakTemp = Math.max(temperature.todayTempMaxC || 0, temperature.tempMax7dC || 0);
    alerts.push({
      id: 'alert-high-temp',
      type: 'Temperatura diurna elevada proyectada',
      location: locationName,
      generatedAt,
      attentionLevel: peakTemp >= rules.veryHighTemperatureThresholdC ? 'seguimiento' : 'atencion',
      badgeClass: 'badge-warning',
      icon: 'fa-temperature-high',
      triggerVariables: `Temp. máxima proyectada: ${peakTemp.toFixed(1)} °C (Umbral: ${rules.highTemperatureThresholdC} °C) | Variación térmica hoy: ${temperature.todayThermalAmplitudeC ?? '—'} °C`,
      description: `Se proyectan temperaturas máximas de hasta ${peakTemp.toFixed(1)} °C, lo cual incrementa la tasa de evaporación en reservorios abiertos y la transpiración de los cultivos.`,
      recommendation: 'Recomendación orientativa: si realiza labores de riego o aplicación en parcelas, priorice las primeras horas de la mañana o el final de la tarde para reducir pérdidas por evaporación.'
    });
  }

  // Regla 4: Posible necesidad de seguimiento hídrico (Combinación de días sin lluvia + ET0 elevada)
  if (
    precipitation.consecutiveDryDays >= rules.waterFollowUpDryDays &&
    (evapotranspiration.cumulativeEt07dMm >= rules.waterFollowUpWeeklyEt0Mm || evapotranspiration.todayEt0Mm >= rules.highDailyEt0Mm)
  ) {
    alerts.push({
      id: 'alert-water-followup',
      type: 'Posible necesidad de seguimiento hídrico',
      location: locationName,
      generatedAt,
      attentionLevel: 'seguimiento',
      badgeClass: 'badge-warning',
      icon: 'fa-droplet-slash',
      triggerVariables: `${precipitation.consecutiveDryDays} días sin lluvia pronosticada + ET₀ 7 días: ${evapotranspiration.cumulativeEt07dMm} mm (ET₀ hoy: ${evapotranspiration.todayEt0Mm} mm/día)`,
      description: `La combinación de varios días sin lluvia pronosticada y una evapotranspiración de referencia (FAO ET₀) de ${evapotranspiration.cumulativeEt07dMm} mm en 7 días sugiere una mayor demanda atmosférica de agua.`,
      recommendation: 'Aviso orientativo (no constituye diagnóstico de sequía): se aconseja registrar observaciones de humedad del suelo en campo y monitorear el caudal observado de las fuentes comunitarias.'
    });
  }

  // Si no se activó ninguna alerta por umbral, proporcionar estado informativo de normalidad
  if (alerts.length === 0) {
    alerts.push({
      id: 'alert-normal-conditions',
      type: 'Condiciones agroclimáticas dentro de rangos habituales',
      location: locationName,
      generatedAt,
      attentionLevel: 'informativo',
      badgeClass: 'badge-success',
      icon: 'fa-circle-check',
      triggerVariables: `Lluvia 24h est.: ${precipitation.rainNext24hMm} mm | Temp. máx.: ${temperature.todayTempMaxC ?? '—'} °C | ET₀ hoy: ${evapotranspiration.todayEt0Mm} mm`,
      description: 'Las variables pronosticadas de temperatura, precipitación y evapotranspiración para los próximos días no superan los umbrales de alerta configurados.',
      recommendation: 'Mantenga la rutina habitual de lectura de pluviómetros a las 7:00 a. m. y el registro periódico de observaciones en HIDROTERRA.'
    });
  }

  return alerts;
}

/**
 * Construye el análisis comparativo de precipitaciones diferenciando estrictamente:
 * 1. Lluvia observada y registrada por pluviómetro (Medición Real en campo).
 * 2. Precipitación estimada por el modelo meteorológico (Hoy / Próximas 24h).
 * 3. Precipitación pronosticada para fechas futuras (Próximos 7 días).
 */
export function buildPrecipitationComparison(weatherRecord, rainfallRecords = [], selectedPluviometer = null) {
  const days = weatherRecord?.daily?.days || [];
  const next24h = weatherRecord?.hourly?.next24Hours || [];

  // Filtrar registros reales observados (del pluviómetro seleccionado o de la red territorial)
  const relevantRecords = selectedPluviometer
    ? rainfallRecords.filter(r => r.pluviometerId === selectedPluviometer.id)
    : rainfallRecords;

  // Ordenar de más reciente a más antiguo
  const sortedObserved = [...relevantRecords].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  );

  const lastObservedRecord = sortedObserved[0] || null;

  // Agregar lluvia observada por fecha YYYY-MM-DD
  const observedByDate = {};
  sortedObserved.forEach(r => {
    const dateKey = (r.measuredAt || '').slice(0, 10);
    if (!dateKey) return;
    observedByDate[dateKey] = Number(((observedByDate[dateKey] || 0) + (Number(r.precipitationMm) || 0)).toFixed(1));
  });

  // Calcular acumulado observado en los últimos 7 días y 30 días
  const nowMs = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  let observedLast7dMm = 0;
  let observedLast30dMm = 0;

  sortedObserved.forEach(r => {
    const t = new Date(r.measuredAt).getTime();
    const mm = Number(r.precipitationMm) || 0;
    if (!isNaN(t)) {
      if (nowMs - t <= ms7d) observedLast7dMm += mm;
      if (nowMs - t <= ms30d) observedLast30dMm += mm;
    }
  });

  observedLast7dMm = Number(observedLast7dMm.toFixed(1));
  observedLast30dMm = Number(observedLast30dMm.toFixed(1));

  // Estimación modelo próximas 24h y pronóstico 7 días
  const estimatedNext24hMm = Number(
    next24h.reduce((acc, h) => acc + (safeNumber(h.precipitationMm, 0) || 0), 0).toFixed(1)
  );
  const forecasted7dMm = Number(
    days.reduce((acc, d) => acc + (safeNumber(d.precipitationSumMm, 0) || 0), 0).toFixed(1)
  );
  const dryDaysCount7d = days.filter(d => (safeNumber(d.precipitationSumMm, 0) || 0) < 1.0).length;

  // Diferencia neta entre precipitación observada reciente (últimos 7d) y pronosticada (próximos 7d)
  const diffObservedVsForecast7dMm = Number((forecasted7dMm - observedLast7dMm).toFixed(1));
  let precipitationTrendLabel = 'Comportamiento estable';
  if (forecasted7dMm > observedLast7dMm + 15) {
    precipitationTrendLabel = 'Tendencia al incremento de lluvias en los próximos 7 días';
  } else if (forecasted7dMm + 15 < observedLast7dMm) {
    precipitationTrendLabel = 'Tendencia a la disminución de lluvias respecto a la semana previa';
  }

  // Serie para tabla y gráfico comparativo (fechas recientes con observación + 7 días de pronóstico)
  const recentObservedDates = Object.keys(observedByDate).sort().slice(-5);
  const forecastDates = days.map(d => d.date);
  const allTimelineDates = Array.from(new Set([...recentObservedDates, ...forecastDates])).sort();

  const todayDateStr = days[0]?.date || new Date().toISOString().slice(0, 10);

  const timeline = allTimelineDates.map(dateStr => {
    const forecastDay = days.find(d => d.date === dateStr);
    const hasObserved = observedByDate[dateStr] !== undefined;
    const isToday = dateStr === todayDateStr;
    const isFuture = dateStr > todayDateStr;

    return {
      date: dateStr,
      // 1. Medición real en pluviómetro (null si no se ha registrado lectura ese día)
      observedMm: hasObserved ? observedByDate[dateStr] : null,
      // 2. Estimación del modelo para el día actual
      estimatedModelTodayMm: isToday && forecastDay ? safeNumber(forecastDay.precipitationSumMm, 0) : null,
      // 3. Pronóstico futuro para los días siguientes
      forecastFutureMm: isFuture && forecastDay ? safeNumber(forecastDay.precipitationSumMm, 0) : null,
      probabilityPct: forecastDay ? safeNumber(forecastDay.precipitationProbabilityMaxPct, null) : null
    };
  });

  return {
    scopeLabel: selectedPluviometer
      ? `Pluviómetro ${selectedPluviometer.code} — ${selectedPluviometer.name}`
      : 'Red general de pluviómetros registrados',
    totalObservedRecordsCount: sortedObserved.length,
    lastObservedRecord,
    observedLast7dMm,
    observedLast30dMm,
    estimatedNext24hMm,
    forecasted7dMm,
    diffObservedVsForecast7dMm,
    precipitationTrendLabel,
    dryDaysCount7d,
    timeline
  };
}

