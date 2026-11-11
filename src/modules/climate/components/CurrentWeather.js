/**
 * Componente: Panel Meteorológico Principal y Ficha de Integración Territorial (Secciones 4.1 y 5)
 */

import { escapeHtml } from '../../../core/validators.js';
import { formatDateTime } from '../../../core/date-utils.js';
import { formatCoordinates } from '../../../domain/rules/coordinates.rules.js';
import { renderStatusBadge } from '../../../ui/components/status-badge.js';
import { WATER_SOURCE_TYPES, WATER_SOURCE_USES } from '../../../domain/models/WaterSource.js';
import { PLUVIOMETER_TYPES } from '../../../domain/models/Pluviometer.js';
import {
  getWeatherCondition,
  formatTemp,
  formatMm,
  formatPercent,
  formatWindSpeed,
  formatWindDirection,
  formatPressure
} from '../utils/weatherFormatters.js';

/**
 * Renderiza el indicador de procedencia y estado de conexión de la consulta meteorológica
 */
export function renderWeatherConnectionBadge(status) {
  if (status === 'live') {
    return `
      <span class="badge badge-success" title="Datos recién consultados desde el servicio Open-Meteo">
        <span class="status-dot online"></span> Actualizado desde la API (Open-Meteo)
      </span>
    `;
  }
  if (status === 'cache') {
    return `
      <span class="badge badge-info" title="Datos recuperados de la caché local del dispositivo dentro de la ventana de vigencia">
        <span class="status-dot online"></span> Recuperado de caché local (Vigente)
      </span>
    `;
  }
  if (status === 'offline_cache') {
    return `
      <span class="badge badge-warning" title="Sin conexión con la API. Mostrando la última consulta guardada en IndexedDB">
        <span class="status-dot offline"></span> Recuperado de caché local (Sin conexión)
      </span>
    `;
  }
  return `
    <span class="badge badge-danger">
      Datos meteorológicos no disponibles
    </span>
  `;
}

/**
 * Renderiza el Panel Meteorológico Principal (Sección 4.1)
 */
export function renderCurrentWeatherPanel(weatherRecord, status, errorMsg = null) {
  if (!weatherRecord || !weatherRecord.current) {
    return `
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <h3 class="card-title">Panel Meteorológico Principal</h3>
            <p class="card-subtitle">Estado del tiempo en la ubicación seleccionada</p>
          </div>
          ${renderWeatherConnectionBadge('unavailable')}
        </div>
        <div class="card-body">
          <div class="empty-state" style="margin: 0;">
            <h4 class="empty-state-title">Información meteorológica no disponible</h4>
            <p class="empty-state-text">
              ${escapeHtml(errorMsg || 'No fue posible obtener datos de la API Open-Meteo ni existen consultas previas guardadas en la caché local para estas coordenadas.')}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  const { location, current, fetchedAt, metadata } = weatherRecord;
  const condition = getWeatherCondition(current.weatherCode, current.isDay);

  return `
    <div class="card mb-4 climate-hero-card">
      <div class="card-header">
        <div>
          <div class="d-flex align-center gap-2" style="flex-wrap: wrap; margin-bottom: 4px;">
            <span class="badge badge-info">
              ${escapeHtml(getEntityTypeLabel(location.entityType))}
            </span>
            ${location.municipality ? `<span class="badge badge-neutral">${escapeHtml(location.municipality)}</span>` : ''}
            ${metadata?.elevation !== null && metadata?.elevation !== undefined ? `<span class="badge badge-neutral">${Math.round(metadata.elevation)} msnm</span>` : ''}
          </div>
          <h3 class="card-title" style="font-size: var(--font-size-lg);">
            ${escapeHtml(location.name)}
          </h3>
          <p class="card-subtitle">
            Coordenadas: <strong>${formatCoordinates(location.latitude, location.longitude)}</strong>
            &nbsp;|&nbsp; Última actualización: <strong>${formatDateTime(fetchedAt)}</strong>
          </p>
        </div>

        <div class="d-flex flex-column align-end gap-2">
          ${renderWeatherConnectionBadge(status)}
          <small class="text-muted" style="font-size: 0.7rem;">Fuente: Open-Meteo (${escapeHtml(metadata?.timezone || 'America/Bogota')})</small>
        </div>
      </div>

      ${errorMsg ? `
        <div class="climate-inline-notice">
          <i class="fa-solid fa-circle-info"></i>
          <span>${escapeHtml(errorMsg)}</span>
        </div>
      ` : ''}

      <div class="card-body">
        <div class="climate-current-grid">
          <!-- Bloque Principal: Icono Meteorológico y Temperatura -->
          <div class="climate-main-temp-box">
            <div class="climate-condition-icon" style="color: ${condition.color};">
              <i class="fa-solid ${condition.icon}"></i>
            </div>
            <div>
              <div class="climate-temp-value">${formatTemp(current.temperatureC)}</div>
              <div class="climate-condition-label">${escapeHtml(condition.label)}</div>
              <div class="climate-apparent-temp">
                Sensación térmica: <strong>${formatTemp(current.apparentTemperatureC)}</strong>
              </div>
            </div>
          </div>

          <!-- Grilla de Variables Meteorológicas Actuales -->
          <div class="climate-variables-subgrid">
            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-blue-600);"><i class="fa-solid fa-droplet"></i></span>
              <div>
                <span class="climate-stat-label">Humedad Relativa</span>
                <strong class="climate-stat-val">${formatPercent(current.humidityPct)}</strong>
              </div>
            </div>

            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-blue-700);"><i class="fa-solid fa-cloud-rain"></i></span>
              <div>
                <span class="climate-stat-label">Precipitación Actual</span>
                <strong class="climate-stat-val">${formatMm(current.precipitationMm)}</strong>
              </div>
            </div>

            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-info);"><i class="fa-solid fa-umbrella"></i></span>
              <div>
                <span class="climate-stat-label">Probabilidad de Lluvia</span>
                <strong class="climate-stat-val">${formatPercent(current.precipitationProbabilityPct)}</strong>
              </div>
            </div>

            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-green-600);"><i class="fa-solid fa-wind"></i></span>
              <div>
                <span class="climate-stat-label">Velocidad del Viento</span>
                <strong class="climate-stat-val">${formatWindSpeed(current.windSpeedKmh)}</strong>
              </div>
            </div>

            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-earth-600);"><i class="fa-regular fa-compass"></i></span>
              <div>
                <span class="climate-stat-label">Dirección del Viento</span>
                <strong class="climate-stat-val">${formatWindDirection(current.windDirectionDeg)}</strong>
              </div>
            </div>

            <div class="climate-stat-item">
              <span class="climate-stat-icon" style="color: var(--color-neutral-500);"><i class="fa-solid fa-cloud"></i></span>
              <div>
                <span class="climate-stat-label">Nubosidad / Presión</span>
                <strong class="climate-stat-val">${formatPercent(current.cloudCoverPct)} / ${formatPressure(current.surfacePressureHpa)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza el Panel de Integración con la Entidad Seleccionada de HIDROTERRA (Sección 5):
 * - Pluviómetro registrado
 * - Fuente hídrica registrada
 * - Comunidad o Parcela productiva
 */
export function renderEntityIntegrationCard({
  selectedEntity,
  siteName,
  precipComparison,
  indicators,
  latestSourceMeasurement = null,
  relatedCrops = []
}) {
  if (!selectedEntity || !selectedEntity.entityType || selectedEntity.entityType === 'coordinates' || selectedEntity.entityType === 'reference') {
    return '';
  }

  const { entityType, rawEntity } = selectedEntity;
  if (!rawEntity) return '';

  // 5.1 Integración con Pluviómetros
  if (entityType === 'pluviometer') {
    const lastRec = precipComparison?.lastObservedRecord;
    return `
      <div class="card mb-4" style="border-left: 4px solid var(--color-green-700);">
        <div class="card-header">
          <div>
            <span class="badge badge-success mb-1"><i class="fa-solid fa-cloud-showers-heavy"></i> Integración con Pluviómetro Registrado</span>
            <h3 class="card-title">${escapeHtml(rawEntity.code)} — ${escapeHtml(rawEntity.name)}</h3>
            <p class="card-subtitle">Datos instrumentales locales combinados con el pronóstico meteorológico en sus coordenadas</p>
          </div>
          ${renderStatusBadge(rawEntity.status)}
        </div>
        <div class="card-body">
          <div class="form-grid-2">
            <div style="font-size: var(--font-size-sm); line-height: 1.65;">
              <p><strong>Identificación del equipo:</strong> <code>${escapeHtml(rawEntity.code)}</code> (${escapeHtml(PLUVIOMETER_TYPES[rawEntity.equipmentType] || rawEntity.equipmentType)})</p>
              <p><strong>Ubicación / Comunidad:</strong> ${escapeHtml(siteName || 'Sin comunidad asignada')}</p>
              <p><strong>Coordenadas:</strong> ${formatCoordinates(rawEntity.latitude, rawEntity.longitude)}</p>
              <p><strong>Responsable de lectura:</strong> ${escapeHtml(rawEntity.responsible || '—')}</p>
            </div>

            <div class="coords-picker-box" style="margin-bottom: 0;">
              <h4 style="font-size: var(--font-size-sm); margin-bottom: 8px; color: var(--color-neutral-900);">
                <i class="fa-solid fa-scale-balanced" style="color: var(--color-blue-700);"></i> Comparación: Medición Real vs. Modelo Meteorológico
              </h4>
              <div style="font-size: var(--font-size-xs); display: flex; flex-direction: column; gap: 6px;">
                <div class="d-flex justify-between">
                  <span><strong>1. Última lluvia registrada (Pluviómetro):</strong></span>
                  <span class="badge badge-success">
                    ${lastRec ? `${lastRec.precipitationMm} mm (${formatDateTime(lastRec.measuredAt)})` : 'Sin lecturas registradas'}
                  </span>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>2. Acumulado observado últimos 7 días:</strong></span>
                  <strong>${precipComparison ? precipComparison.observedLast7dMm : 0} mm (${precipComparison ? precipComparison.totalObservedRecordsCount : 0} lecturas históricas)</strong>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>3. Precipitación estimada próximas 24h (Modelo):</strong></span>
                  <span class="badge badge-info">${indicators?.precipitation?.rainNext24hMm ?? 0} mm</span>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>4. Pronóstico acumulado próximos 7 días:</strong></span>
                  <span class="badge badge-neutral">${indicators?.precipitation?.rainNext7dMm ?? 0} mm</span>
                </div>
                ${precipComparison?.precipitationTrendLabel ? `
                  <div class="d-flex justify-between">
                    <span><strong>5. Tendencia y diferencia (Pronóstico 7d vs Observado 7d):</strong></span>
                    <strong>${precipComparison.diffObservedVsForecast7dMm >= 0 ? `+${precipComparison.diffObservedVsForecast7dMm}` : precipComparison.diffObservedVsForecast7dMm} mm (${escapeHtml(precipComparison.precipitationTrendLabel)})</strong>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 5.2 Integración con Fuentes Hídricas y Disponibilidad de Agua
  if (entityType === 'water_source') {
    return `
      <div class="card mb-4" style="border-left: 4px solid var(--color-blue-700);">
        <div class="card-header">
          <div>
            <span class="badge badge-info mb-1"><i class="fa-solid fa-faucet-drip"></i> Integración con Fuente Hídrica y Disponibilidad</span>
            <h3 class="card-title">${escapeHtml(rawEntity.code)} — ${escapeHtml(rawEntity.name)}</h3>
            <p class="card-subtitle">Monitoreo meteorológico sobre la microcuenca y relación con la disponibilidad medida en la fuente</p>
          </div>
          ${renderStatusBadge(latestSourceMeasurement ? latestSourceMeasurement.status : rawEntity.status)}
        </div>
        <div class="card-body">
          <div class="form-grid-2">
            <div style="font-size: var(--font-size-sm); line-height: 1.65;">
              <p><strong>Tipo de fuente:</strong> ${escapeHtml(WATER_SOURCE_TYPES[rawEntity.type] || rawEntity.type)}</p>
              <p><strong>Ubicación / Comunidad:</strong> ${escapeHtml(siteName || 'Sin comunidad asignada')}</p>
              <p><strong>Coordenadas:</strong> ${formatCoordinates(rawEntity.latitude, rawEntity.longitude)}</p>
              <p><strong>Uso principal registrado:</strong> ${escapeHtml(WATER_SOURCE_USES[rawEntity.mainUse] || rawEntity.mainUse)}</p>
              ${latestSourceMeasurement ? `
                <p><strong>Última medición de disponibilidad:</strong> <strong>${latestSourceMeasurement.waterLevel} ${escapeHtml(latestSourceMeasurement.unit)}</strong>
                ${latestSourceMeasurement.availableCapacityPct !== null ? `(${latestSourceMeasurement.availableCapacityPct}% de capacidad)` : ''} — ${formatDateTime(latestSourceMeasurement.measuredAt)}</p>
              ` : '<p class="text-muted"><strong>Disponibilidad medida:</strong> Sin mediciones periódicas aún.</p>'}
            </div>

            <div class="coords-picker-box" style="margin-bottom: 0;">
              <h4 style="font-size: var(--font-size-sm); margin-bottom: 8px; color: var(--color-neutral-900);">
                <i class="fa-solid fa-cloud-rain" style="color: var(--color-blue-700);"></i> Contexto de Recarga y Demanda Evaporativa
              </h4>
              <div style="font-size: var(--font-size-xs); display: flex; flex-direction: column; gap: 6px;">
                <div class="d-flex justify-between">
                  <span><strong>Lluvia observada en red local (últimos 7d):</strong></span>
                  <strong>${precipComparison ? precipComparison.observedLast7dMm : 0} mm</strong>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>Precipitación estimada 24h en la fuente:</strong></span>
                  <span class="badge badge-info">${indicators?.precipitation?.rainNext24hMm ?? 0} mm</span>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>Precipitación pronosticada 7 días:</strong></span>
                  <span class="badge badge-info">${indicators?.precipitation?.rainNext7dMm ?? 0} mm</span>
                </div>
                <div class="d-flex justify-between">
                  <span><strong>Evapotranspiración FAO ET₀ (7 días):</strong></span>
                  <span>${indicators?.evapotranspiration?.cumulativeEt07dMm ?? 0} mm (${indicators?.precipitation?.consecutiveDryDays ?? 0} días secos seguidos)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 5.3 Integración con Parcelas y Cultivos
  if (entityType === 'parcel' || entityType === 'site') {
    return `
      <div class="card mb-4" style="border-left: 4px solid var(--color-earth-600);">
        <div class="card-header">
          <div>
            <span class="badge badge-warning mb-1"><i class="fa-solid fa-seedling"></i> Integración Productiva y Territorial</span>
            <h3 class="card-title">${escapeHtml(selectedEntity.name)}</h3>
            <p class="card-subtitle">Condiciones agroclimáticas vinculadas a las parcelas y cultivos registrados</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid-2">
            <div style="font-size: var(--font-size-sm); line-height: 1.65;">
              <p><strong>Coordenadas:</strong> ${formatCoordinates(selectedEntity.latitude, selectedEntity.longitude)}</p>
              <p><strong>Cultivos asociados en la zona:</strong> ${relatedCrops.length > 0 ? relatedCrops.map(c => escapeHtml(c.name)).join(', ') : 'Sin cultivos registrados en este punto'}</p>
            </div>
            <div class="coords-picker-box" style="margin-bottom: 0; font-size: var(--font-size-xs);">
              <div><strong>Balance Atmosférico 7 días (Lluvia pron. – ET₀):</strong> <strong>${indicators?.evapotranspiration?.estimatedAtmosphericBalance7dMm ?? 0} mm</strong></div>
              <div><strong>Humedad superficial del suelo estimada (modelo):</strong> <strong>${indicators?.humidity?.estimatedSoilMoisturePct !== null ? `${indicators.humidity.estimatedSoilMoisturePct}%` : 'No disponible'}</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function getEntityTypeLabel(type) {
  switch (type) {
    case 'pluviometer': return 'Pluviómetro Registrado';
    case 'water_source': return 'Fuente Hídrica Registrada';
    case 'site': return 'Comunidad / Sitio Territorial';
    case 'parcel': return 'Parcela / Unidad Productiva';
    case 'map_click': return 'Punto Seleccionado en Mapa';
    case 'manual': return 'Coordenadas Manuales';
    default: return 'Ubicación de Referencia';
  }
}

