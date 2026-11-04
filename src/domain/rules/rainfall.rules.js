/**
 * Reglas de Negocio de Precipitaciones (Rainfall Rules)
 * Cálculos explícitos, validaciones y reglas de agregación de lluvia
 */

import { getDayKey, getMonthKey } from '../../core/date-utils.js';

/**
 * Detecta si una nueva medición podría ser un duplicado de un registro existente
 * Criterio: mismo pluviómetro con medición en una ventana menor o igual a umbral (minutos)
 */
export function findPotentialDuplicate(records, newPluviometerId, newMeasuredAt, currentRecordId = null, thresholdMinutes = 60) {
  if (!records || !Array.isArray(records) || !newPluviometerId || !newMeasuredAt) {
    return null;
  }

  const newTime = new Date(newMeasuredAt).getTime();
  if (isNaN(newTime)) return null;

  const thresholdMs = thresholdMinutes * 60 * 1000;

  return records.find(rec => {
    if (currentRecordId && rec.id === currentRecordId) return false;
    if (rec.pluviometerId !== newPluviometerId) return false;

    const existingTime = new Date(rec.measuredAt).getTime();
    if (isNaN(existingTime)) return false;

    const diff = Math.abs(newTime - existingTime);
    return diff <= thresholdMs;
  }) || null;
}

/**
 * Calcula el acumulado diario agrupando por fecha (YYYY-MM-DD).
 * Regla: La ausencia de mediciones NO se asume como 0 mm. Los días sin registros no se inventan.
 * @param {Array} records - Lista de registros válidos de lluvia
 * @returns {Object} Mapa de { 'YYYY-MM-DD': { totalMm: number, count: number, records: Array } }
 */
export function calculateDailyAccumulations(records) {
  if (!records || !Array.isArray(records)) return {};

  const dailyMap = {};

  records.forEach(rec => {
    const dayKey = getDayKey(rec.measuredAt);
    if (!dayKey) return;

    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = {
        date: dayKey,
        totalMm: 0,
        count: 0,
        records: []
      };
    }

    const mm = Number(rec.precipitationMm) || 0;
    dailyMap[dayKey].totalMm = Math.round((dailyMap[dayKey].totalMm + mm) * 10) / 10;
    dailyMap[dayKey].count += 1;
    dailyMap[dayKey].records.push(rec);
  });

  return dailyMap;
}

/**
 * Calcula el acumulado mensual agrupando por mes (YYYY-MM).
 * @param {Array} records
 * @returns {Object} Mapa de { 'YYYY-MM': { month: string, totalMm: number, count: number, daysWithRain: number } }
 */
export function calculateMonthlyAccumulations(records) {
  if (!records || !Array.isArray(records)) return {};

  const monthlyMap = {};

  records.forEach(rec => {
    const monthKey = getMonthKey(rec.measuredAt);
    const dayKey = getDayKey(rec.measuredAt);
    if (!monthKey) return;

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthKey,
        totalMm: 0,
        count: 0,
        measuredDays: new Set(),
        daysWithRain: new Set()
      };
    }

    const mm = Number(rec.precipitationMm) || 0;
    monthlyMap[monthKey].totalMm = Math.round((monthlyMap[monthKey].totalMm + mm) * 10) / 10;
    monthlyMap[monthKey].count += 1;
    monthlyMap[monthKey].measuredDays.add(dayKey);
    if (mm > 0) {
      monthlyMap[monthKey].daysWithRain.add(dayKey);
    }
  });

  // Convertir sets a conteos limpios
  const result = {};
  Object.keys(monthlyMap).forEach(key => {
    result[key] = {
      month: monthlyMap[key].month,
      totalMm: monthlyMap[key].totalMm,
      count: monthlyMap[key].count,
      totalDaysMeasured: monthlyMap[key].measuredDays.size,
      daysWithRainCount: monthlyMap[key].daysWithRain.size
    };
  });

  return result;
}

/**
 * Calcula el acumulado total para un periodo y lista de registros
 */
export function calculatePeriodTotal(records) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return { totalMm: 0, count: 0, maxDailyMm: 0, averageDailyMm: 0 };
  }

  const daily = calculateDailyAccumulations(records);
  const dailyValues = Object.values(daily);

  let totalMm = 0;
  let maxDailyMm = 0;

  dailyValues.forEach(d => {
    totalMm += d.totalMm;
    if (d.totalMm > maxDailyMm) {
      maxDailyMm = d.totalMm;
    }
  });

  totalMm = Math.round(totalMm * 10) / 10;
  const averageDailyMm = dailyValues.length > 0 ? Math.round((totalMm / dailyValues.length) * 10) / 10 : 0;

  return {
    totalMm,
    count: records.length,
    measuredDaysCount: dailyValues.length,
    maxDailyMm,
    averageDailyMm
  };
}

/**
 * Compara precipitaciones acumuladas entre varios pluviómetros
 */
export function comparePluviometers(records, pluviometers) {
  if (!pluviometers || !Array.isArray(pluviometers)) return [];

  const pluvMap = new Map();
  pluviometers.forEach(p => {
    pluvMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      totalMm: 0,
      recordCount: 0,
      maxReading: 0,
      lastReadingDate: null
    });
  });

  if (records && Array.isArray(records)) {
    records.forEach(rec => {
      const entry = pluvMap.get(rec.pluviometerId);
      if (entry) {
        const mm = Number(rec.precipitationMm) || 0;
        entry.totalMm = Math.round((entry.totalMm + mm) * 10) / 10;
        entry.recordCount += 1;
        if (mm > entry.maxReading) entry.maxReading = mm;
        if (!entry.lastReadingDate || rec.measuredAt > entry.lastReadingDate) {
          entry.lastReadingDate = rec.measuredAt;
        }
      }
    });
  }

  return Array.from(pluvMap.values());
}
