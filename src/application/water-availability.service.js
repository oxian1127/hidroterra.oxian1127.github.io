/**
 * Servicio de Aplicación: Monitoreo de Disponibilidad Hídrica (WaterAvailabilityService)
 * Gestiona las mediciones periódicas de fuentes hídricas, su clasificación por tipo de infraestructura,
 * el análisis de tendencias y la ficha técnica ampliada de disponibilidad.
 */

import { WaterMeasurement } from '../domain/models/WaterMeasurement.js';
import { WATER_SOURCE_TYPES } from '../domain/models/WaterSource.js';
import {
  computeMeasurementMetrics,
  classifyWaterAvailability,
  calculateSourceAvailabilityTrend,
  getInfrastructureConfig
} from '../domain/rules/water-availability.rules.js';
import { waterMeasurementRepository } from '../infrastructure/database/repositories/water-measurement.repository.js';
import { waterSourceRepository } from '../infrastructure/database/repositories/water-source.repository.js';
import { siteRepository } from '../infrastructure/database/repositories/site.repository.js';
import { observationRepository } from '../infrastructure/database/repositories/observation.repository.js';
import { combineDateTimeToIso, formatDate, formatDateTime } from '../core/date-utils.js';
import { ValidationError } from '../core/errors.js';

export class WaterAvailabilityService {
  /**
   * Obtiene todas las mediciones hídricas aplicando filtros opcionales
   */
  static async getAllMeasurements(filters = {}) {
    const [measurements, sources, sites] = await Promise.all([
      waterMeasurementRepository.getAll(),
      waterSourceRepository.getAll(),
      siteRepository.getAll()
    ]);

    const sourceMap = new Map(sources.map(s => [s.id, s]));
    const siteMap = new Map(sites.map(st => [st.id, st]));

    let enriched = measurements.map(m => {
      const source = sourceMap.get(m.sourceId) || null;
      const site = source && source.siteId ? siteMap.get(source.siteId) : null;
      return {
        ...m,
        sourceName: source ? source.name : (m.sourceCode || 'Fuente no encontrada'),
        sourceCode: m.sourceCode || (source ? source.code : '—'),
        sourceType: m.sourceType || (source ? source.type : 'otra'),
        sourceTypeLabel: WATER_SOURCE_TYPES[m.sourceType || (source ? source.type : 'otra')] || 'Otra fuente',
        siteId: source ? source.siteId : null,
        siteName: site ? site.name : 'Sin comunidad asignada',
        municipality: site ? site.municipality : '—'
      };
    });

    if (filters.sourceId && filters.sourceId !== 'all') {
      enriched = enriched.filter(m => m.sourceId === filters.sourceId);
    }

    if (filters.siteId && filters.siteId !== 'all') {
      enriched = enriched.filter(m => m.siteId === filters.siteId);
    }

    if (filters.municipality && filters.municipality !== 'all') {
      enriched = enriched.filter(m => m.municipality === filters.municipality);
    }

    if (filters.status && filters.status !== 'all') {
      enriched = enriched.filter(m => m.status === filters.status);
    }

    if (filters.startDate) {
      enriched = enriched.filter(m => m.measuredAt && m.measuredAt.slice(0, 10) >= filters.startDate);
    }

    if (filters.endDate) {
      enriched = enriched.filter(m => m.measuredAt && m.measuredAt.slice(0, 10) <= filters.endDate);
    }

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      enriched = enriched.filter(m =>
        (m.sourceName && m.sourceName.toLowerCase().includes(q)) ||
        (m.sourceCode && m.sourceCode.toLowerCase().includes(q)) ||
        (m.responsible && m.responsible.toLowerCase().includes(q)) ||
        (m.notes && m.notes.toLowerCase().includes(q))
      );
    }

    return enriched.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
  }

  static async getById(id) {
    return await waterMeasurementRepository.getById(id);
  }

  /**
   * Registra una nueva medición de disponibilidad hídrica vinculada a una fuente existente
   */
  static async create(data) {
    const source = await waterSourceRepository.getById(data.sourceId);
    if (!source) {
      throw new ValidationError('La fuente hídrica seleccionada no existe en el inventario.');
    }

    const measuredAt = data.measuredAt || combineDateTimeToIso(data.measuredDate, data.measuredTime || '08:00');
    const totalDepthMeters = data.totalDepthMeters !== undefined && data.totalDepthMeters !== '' && data.totalDepthMeters !== null
      ? Number(data.totalDepthMeters)
      : (source.referenceDepthMeters ?? null);
    const knownCapacityLiters = data.knownCapacityLiters !== undefined && data.knownCapacityLiters !== '' && data.knownCapacityLiters !== null
      ? Number(data.knownCapacityLiters)
      : (source.knownCapacityLiters ?? null);

    // Calcular métricas derivadas (diferenciando valores observados vs estimados)
    const computed = computeMeasurementMetrics({
      waterLevel: data.waterLevel,
      unit: data.unit || 'm',
      totalDepthMeters,
      knownCapacityLiters,
      observedVolumeLiters: data.observedVolumeLiters,
      estimatedVolumeLiters: data.estimatedVolumeLiters
    });

    const finalCapacityPct = data.availableCapacityPct !== undefined && data.availableCapacityPct !== '' && data.availableCapacityPct !== null
      ? Number(data.availableCapacityPct)
      : computed.availableCapacityPct;

    // Clasificar estado de disponibilidad según criterios del tipo de fuente
    const classification = classifyWaterAvailability({
      sourceType: source.type,
      waterLevel: data.waterLevel,
      unit: data.unit || 'm',
      totalDepthMeters,
      availableCapacityPct: finalCapacityPct,
      knownCapacityLiters,
      observedVolumeLiters: computed.observedVolumeLiters,
      estimatedVolumeLiters: computed.estimatedVolumeLiters
    });

    const resolvedStatus = data.status && data.status !== 'auto' ? data.status : classification.status;

    const model = new WaterMeasurement({
      ...data,
      sourceId: source.id,
      sourceCode: source.code,
      sourceType: source.type,
      measuredAt,
      totalDepthMeters,
      knownCapacityLiters,
      observedVolumeLiters: computed.observedVolumeLiters,
      estimatedVolumeLiters: computed.estimatedVolumeLiters,
      availableCapacityPct: finalCapacityPct,
      isEstimatedCalculation: computed.isEstimatedCalculation || data.measurementMethod === 'estimacion_tecnica',
      status: resolvedStatus,
      latitude: data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : source.latitude,
      longitude: data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : source.longitude
    });

    model.validate();

    // Si la fuente no tenía capacidad conocida o profundidad de referencia y se proporcionó en la medición, actualizar la ficha de la fuente
    const sourceUpdates = {};
    if (knownCapacityLiters !== null && source.knownCapacityLiters === null) {
      sourceUpdates.knownCapacityLiters = knownCapacityLiters;
    }
    if (totalDepthMeters !== null && source.referenceDepthMeters === null) {
      sourceUpdates.referenceDepthMeters = totalDepthMeters;
    }
    if (Object.keys(sourceUpdates).length > 0) {
      await waterSourceRepository.update(source.id, sourceUpdates);
    }

    return await waterMeasurementRepository.create(model.toJSON());
  }

  /**
   * Actualiza una medición existente recalificando sus métricas
   */
  static async update(id, data) {
    const current = await waterMeasurementRepository.getById(id);
    if (!current) {
      throw new ValidationError('Medición hídrica no encontrada.');
    }

    const sourceId = data.sourceId || current.sourceId;
    const source = await waterSourceRepository.getById(sourceId);
    if (!source) {
      throw new ValidationError('La fuente hídrica asociada no existe.');
    }

    const merged = { ...current, ...data, id };
    const measuredAt = data.measuredAt || (data.measuredDate ? combineDateTimeToIso(data.measuredDate, data.measuredTime || current.measuredTime || '08:00') : current.measuredAt);

    const totalDepthMeters = merged.totalDepthMeters !== undefined && merged.totalDepthMeters !== '' && merged.totalDepthMeters !== null
      ? Number(merged.totalDepthMeters)
      : (source.referenceDepthMeters ?? null);
    const knownCapacityLiters = merged.knownCapacityLiters !== undefined && merged.knownCapacityLiters !== '' && merged.knownCapacityLiters !== null
      ? Number(merged.knownCapacityLiters)
      : (source.knownCapacityLiters ?? null);

    const computed = computeMeasurementMetrics({
      waterLevel: merged.waterLevel,
      unit: merged.unit || 'm',
      totalDepthMeters,
      knownCapacityLiters,
      observedVolumeLiters: merged.observedVolumeLiters,
      estimatedVolumeLiters: merged.estimatedVolumeLiters
    });

    const finalCapacityPct = data.availableCapacityPct !== undefined && data.availableCapacityPct !== '' && data.availableCapacityPct !== null
      ? Number(data.availableCapacityPct)
      : computed.availableCapacityPct;

    const classification = classifyWaterAvailability({
      sourceType: source.type,
      waterLevel: merged.waterLevel,
      unit: merged.unit || 'm',
      totalDepthMeters,
      availableCapacityPct: finalCapacityPct,
      knownCapacityLiters,
      observedVolumeLiters: computed.observedVolumeLiters,
      estimatedVolumeLiters: computed.estimatedVolumeLiters
    });

    const resolvedStatus = data.status && data.status !== 'auto' ? data.status : classification.status;

    const model = new WaterMeasurement({
      ...merged,
      sourceId: source.id,
      sourceCode: source.code,
      sourceType: source.type,
      measuredAt,
      totalDepthMeters,
      knownCapacityLiters,
      observedVolumeLiters: computed.observedVolumeLiters,
      estimatedVolumeLiters: computed.estimatedVolumeLiters,
      availableCapacityPct: finalCapacityPct,
      isEstimatedCalculation: computed.isEstimatedCalculation || merged.measurementMethod === 'estimacion_tecnica',
      status: resolvedStatus
    });

    model.validate();
    return await waterMeasurementRepository.update(id, model.toJSON());
  }

  static async delete(id) {
    return await waterMeasurementRepository.delete(id);
  }

  /**
   * Construye el resumen de estado de disponibilidad por fuente hídrica (para panel, mapas y reportes)
   */
  static async getSourcesAvailabilityOverview(filters = {}) {
    const [sources, measurements, sites] = await Promise.all([
      waterSourceRepository.getAll(),
      waterMeasurementRepository.getAll(),
      siteRepository.getAll()
    ]);

    const siteMap = new Map(sites.map(st => [st.id, st]));
    const measBySource = new Map();
    measurements.forEach(m => {
      if (!measBySource.has(m.sourceId)) {
        measBySource.set(m.sourceId, []);
      }
      measBySource.get(m.sourceId).push(m);
    });

    let overview = sources.map(source => {
      const site = source.siteId ? siteMap.get(source.siteId) : null;
      const sourceMeasurements = (measBySource.get(source.id) || []).sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      );
      let latest = sourceMeasurements[0] || null;
      if (latest) {
        const computedLatest = computeMeasurementMetrics({
          waterLevel: latest.waterLevel,
          unit: latest.unit || 'm',
          totalDepthMeters: latest.totalDepthMeters ?? source.referenceDepthMeters,
          knownCapacityLiters: latest.knownCapacityLiters ?? source.knownCapacityLiters,
          observedVolumeLiters: latest.observedVolumeLiters,
          estimatedVolumeLiters: latest.estimatedVolumeLiters
        });
        latest = {
          ...latest,
          observedVolumeLiters: computedLatest.observedVolumeLiters,
          estimatedVolumeLiters: computedLatest.estimatedVolumeLiters,
          availableCapacityPct: latest.availableCapacityPct ?? computedLatest.availableCapacityPct
        };
      }
      const trendInfo = calculateSourceAvailabilityTrend(sourceMeasurements);
      const infraConfig = getInfrastructureConfig(source.type);

      // Si hay medición, usar su clasificación; si no hay mediciones, indicar explícitamente 'sin_informacion'
      let availabilityStatus = 'sin_informacion';
      let availabilityReason = 'Sin mediciones hidrométricas registradas para determinar el estado de disponibilidad.';

      if (latest) {
        availabilityStatus = latest.status || 'sin_informacion';
        const classRes = classifyWaterAvailability({
          sourceType: source.type,
          waterLevel: latest.waterLevel,
          unit: latest.unit,
          totalDepthMeters: latest.totalDepthMeters ?? source.referenceDepthMeters,
          availableCapacityPct: latest.availableCapacityPct,
          knownCapacityLiters: latest.knownCapacityLiters ?? source.knownCapacityLiters,
          observedVolumeLiters: latest.observedVolumeLiters,
          estimatedVolumeLiters: latest.estimatedVolumeLiters
        });
        availabilityReason = classRes.reason;
      }

      const effectiveVolumeLiters = latest
        ? (latest.observedVolumeLiters ?? latest.estimatedVolumeLiters ?? null)
        : null;
      const isVolumeEstimated = latest
        ? (latest.observedVolumeLiters == null && latest.estimatedVolumeLiters != null)
        : false;

      return {
        ...source,
        typeLabel: WATER_SOURCE_TYPES[source.type] || source.type,
        siteName: site ? site.name : 'Sin comunidad asignada',
        municipality: site ? site.municipality : '—',
        measurementsCount: sourceMeasurements.length,
        latestMeasurement: latest,
        lastMeasuredAt: latest ? latest.measuredAt : null,
        availabilityStatus,
        availabilityReason,
        effectiveVolumeLiters,
        isVolumeEstimated,
        availableCapacityPct: latest ? latest.availableCapacityPct : null,
        trend: trendInfo.trend,
        trendLabel: trendInfo.trendLabel,
        variationPct: trendInfo.variationPct,
        technicalCriteria: infraConfig.technicalCriteria
      };
    });

    if (filters.onlyActive) {
      overview = overview.filter(s => s.active !== false);
    }
    if (filters.siteId && filters.siteId !== 'all') {
      overview = overview.filter(s => s.siteId === filters.siteId);
    }
    if (filters.municipality && filters.municipality !== 'all') {
      overview = overview.filter(s => s.municipality === filters.municipality);
    }
    if (filters.type && filters.type !== 'all') {
      overview = overview.filter(s => s.type === filters.type);
    }
    if (filters.availabilityStatus && filters.availabilityStatus !== 'all') {
      overview = overview.filter(s => s.availabilityStatus === filters.availabilityStatus);
    }

    return overview.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 4.5 Ficha técnica ampliada de disponibilidad para una fuente específica
   */
  static async getSourceTechnicalSheet(sourceId) {
    const source = await waterSourceRepository.getById(sourceId);
    if (!source) return null;

    const [site, measurements, allObservations] = await Promise.all([
      source.siteId ? siteRepository.getById(source.siteId) : Promise.resolve(null),
      waterMeasurementRepository.getBySourceId(sourceId),
      observationRepository.getAll()
    ]);

    const relatedObservations = allObservations
      .filter(o => o.relatedEntityType === 'water_source' && o.relatedEntityId === sourceId)
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

    let latest = measurements[0] || null;
    if (latest) {
      const computedLatest = computeMeasurementMetrics({
        waterLevel: latest.waterLevel,
        unit: latest.unit || 'm',
        totalDepthMeters: latest.totalDepthMeters ?? source.referenceDepthMeters,
        knownCapacityLiters: latest.knownCapacityLiters ?? source.knownCapacityLiters,
        observedVolumeLiters: latest.observedVolumeLiters,
        estimatedVolumeLiters: latest.estimatedVolumeLiters
      });
      latest = {
        ...latest,
        observedVolumeLiters: computedLatest.observedVolumeLiters,
        estimatedVolumeLiters: computedLatest.estimatedVolumeLiters,
        availableCapacityPct: latest.availableCapacityPct ?? computedLatest.availableCapacityPct
      };
    }
    const trendInfo = calculateSourceAvailabilityTrend(measurements);
    const infraConfig = getInfrastructureConfig(source.type);

    let classification = {
      status: 'sin_informacion',
      reason: 'Sin mediciones registradas para esta fuente. Registre una medición para determinar el estado.'
    };

    if (latest) {
      classification = classifyWaterAvailability({
        sourceType: source.type,
        waterLevel: latest.waterLevel,
        unit: latest.unit,
        totalDepthMeters: latest.totalDepthMeters ?? source.referenceDepthMeters,
        availableCapacityPct: latest.availableCapacityPct,
        knownCapacityLiters: latest.knownCapacityLiters ?? source.knownCapacityLiters,
        observedVolumeLiters: latest.observedVolumeLiters,
        estimatedVolumeLiters: latest.estimatedVolumeLiters
      });
      if (latest.status && latest.status !== 'sin_informacion') {
        classification.status = latest.status;
      }
    }

    // Construir serie cronológica ascendente para gráfica de evolución
    const chronological = [...measurements].reverse();
    const chartData = {
      labels: chronological.map(m => formatDate(m.measuredAt)),
      waterLevels: chronological.map(m => m.waterLevel),
      capacityPcts: chronological.map(m => m.availableCapacityPct),
      unit: latest ? latest.unit : 'm'
    };

    // Recopilar fotografías de la fuente y de sus mediciones
    const photos = [];
    if (source.photoDataUrl) {
      photos.push({
        url: source.photoDataUrl,
        caption: `Fotografía general — ${source.name}`,
        date: formatDateTime(source.updatedAt || source.createdAt)
      });
    }
    measurements.forEach(m => {
      if (m.photoDataUrl) {
        photos.push({
          url: m.photoDataUrl,
          caption: `Medición ${m.waterLevel} ${m.unit} (${m.responsible || 'Campo'})`,
          date: formatDateTime(m.measuredAt)
        });
      }
    });

    return {
      source,
      typeLabel: WATER_SOURCE_TYPES[source.type] || source.type,
      site,
      infraConfig,
      latestMeasurement: latest,
      measurements,
      classification,
      trendInfo,
      relatedObservations,
      photos,
      chartData
    };
  }
}

