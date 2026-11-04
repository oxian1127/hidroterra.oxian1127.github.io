/**
 * Servicio de Aplicación: Sistema de Alertas Hídricas (WaterAlertsService — Sección 9)
 * Evalúa reglas configurables sobre datos reales, persiste alertas en IndexedDB y permite marcarlas como atendidas.
 */

import { WaterAlert } from '../domain/models/WaterAlert.js';
import { DEFAULT_WATER_ALERT_RULES, evaluateWaterAlerts } from '../domain/rules/water-alerts.rules.js';
import { waterAlertRepository } from '../infrastructure/database/repositories/water-alert.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../infrastructure/database/repositories/water-measurement.repository.js';
import { rainfallRepository } from '../infrastructure/database/repositories/rainfall.repository.js';
import { pluviometerRepository } from '../infrastructure/database/repositories/pluviometer.repository.js';
import { nowIso } from '../core/date-utils.js';

const RULES_STORAGE_KEY = 'hidroterra_water_alert_rules_v1';

export class WaterAlertsService {
  /**
   * Obtiene los umbrales configurados para las reglas de alertas hídricas
   */
  static getRulesConfig() {
    try {
      const raw = localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_WATER_ALERT_RULES, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback silencioso a valores por defecto
    }
    return { ...DEFAULT_WATER_ALERT_RULES };
  }

  /**
   * Guarda umbrales personalizados de alertas hídricas
   */
  static saveRulesConfig(newRules = {}) {
    const merged = {
      ...DEFAULT_WATER_ALERT_RULES,
      significantDropThresholdPct: Number(newRules.significantDropThresholdPct) || DEFAULT_WATER_ALERT_RULES.significantDropThresholdPct,
      maxDaysWithoutMeasurement: Number(newRules.maxDaysWithoutMeasurement) || DEFAULT_WATER_ALERT_RULES.maxDaysWithoutMeasurement,
      minMonthlyRainfallThresholdMm: Number(newRules.minMonthlyRainfallThresholdMm) || DEFAULT_WATER_ALERT_RULES.minMonthlyRainfallThresholdMm,
      lowStorageCapacityThresholdPct: Number(newRules.lowStorageCapacityThresholdPct) || DEFAULT_WATER_ALERT_RULES.lowStorageCapacityThresholdPct,
      outdatedEntityDays: Number(newRules.outdatedEntityDays) || DEFAULT_WATER_ALERT_RULES.outdatedEntityDays
    };
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignorar si localStorage está restringido
    }
    return merged;
  }

  /**
   * Evalúa los datos reales de la plataforma, sincroniza las alertas detectadas en IndexedDB
   * sin duplicar alertas activas ni recrear alertas ya atendidas (a menos que haya nuevos datos posteriores),
   * y devuelve la lista filtrada.
   */
  static async evaluateAndGetAlerts(filters = {}) {
    const [
      waterSources,
      waterMeasurements,
      rainfallRecords,
      pluviometers,
      existingAlerts
    ] = await Promise.all([
      waterSourceRepository.getAll(),
      waterMeasurementRepository.getAll(),
      rainfallRepository.getAll(),
      pluviometerRepository.getAll(),
      waterAlertRepository.getAll()
    ]);

    const rules = this.getRulesConfig();
    const candidates = evaluateWaterAlerts({
      waterSources,
      waterMeasurements,
      rainfallRecords,
      pluviometers,
      customRules: rules
    });

    const existingByRuleCode = new Map();
    existingAlerts.forEach(alert => {
      if (alert.ruleCode) {
        // Conservar la más reciente por ruleCode
        const prev = existingByRuleCode.get(alert.ruleCode);
        if (!prev || new Date(alert.generatedAt) > new Date(prev.generatedAt)) {
          existingByRuleCode.set(alert.ruleCode, alert);
        }
      }
    });

    for (const candidate of candidates) {
      const existing = existingByRuleCode.get(candidate.ruleCode);
      if (!existing) {
        const model = new WaterAlert(candidate);
        model.validate();
        const saved = await waterAlertRepository.create(model.toJSON());
        existingByRuleCode.set(candidate.ruleCode, saved);
      } else if (existing.status === 'activa' && existing.description !== candidate.description) {
        // Actualizar descripción con el último valor medido
        const updated = await waterAlertRepository.update(existing.id, {
          description: candidate.description,
          ruleDescription: candidate.ruleDescription,
          priority: candidate.priority
        });
        existingByRuleCode.set(candidate.ruleCode, updated);
      }
    }

    let allAlerts = await waterAlertRepository.getAll();

    if (filters.status && filters.status !== 'all') {
      allAlerts = allAlerts.filter(a => a.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      allAlerts = allAlerts.filter(a => a.priority === filters.priority);
    }
    if (filters.type && filters.type !== 'all') {
      allAlerts = allAlerts.filter(a => a.type === filters.type);
    }

    // Ordenar: activas primero, luego por prioridad (critica -> alta -> media -> baja) y fecha
    const priorityWeight = { critica: 4, alta: 3, media: 2, baja: 1 };
    return allAlerts.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'activa' ? -1 : 1;
      const pwDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (pwDiff !== 0) return pwDiff;
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    });
  }

  /**
   * Marca una alerta como atendida y registra su fecha de resolución
   */
  static async markAsResolved(alertId, resolutionNotes = '') {
    const existing = await waterAlertRepository.getById(alertId);
    if (!existing) return null;
    return await waterAlertRepository.update(alertId, {
      status: 'atendida',
      resolvedAt: nowIso(),
      resolutionNotes: (resolutionNotes || 'Atendida en revisión territorial').trim()
    });
  }

  /**
   * Reabre una alerta previamente atendida
   */
  static async reopenAlert(alertId) {
    const existing = await waterAlertRepository.getById(alertId);
    if (!existing) return null;
    return await waterAlertRepository.update(alertId, {
      status: 'activa',
      resolvedAt: null
    });
  }
}

