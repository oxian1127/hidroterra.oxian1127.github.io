/**
 * Componente: Indicadores Agroclimáticos e Integración con Humedad del Suelo (Sección 5.3 y 6)
 */

import { escapeHtml } from '../../../core/validators.js';
import { formatDateTime } from '../../../core/date-utils.js';
import { formatSoilMoisture } from '../utils/weatherFormatters.js';

/**
 * Renderiza las 4 tarjetas del Motor de Análisis Agroclimático y la comparativa de humedad de suelo
 */
export function renderAgroclimaticIndicators(indicators, soilObservations = []) {
  if (!indicators) return '';

  const { precipitation, temperature, evapotranspiration, humidity } = indicators;

  return `
    <!-- Motor de Análisis Agroclimático: 4 Indicadores Principales -->
    <div class="dashboard-metrics-grid mb-4">
      <!-- 1. Indicador de Precipitación -->
      <div class="metric-card">
        <div class="metric-icon-box rain"><i class="fa-solid fa-cloud-showers-heavy"></i></div>
        <div class="metric-info">
          <span class="metric-value">${precipitation.rainNext24hMm} <small style="font-size: 0.9rem;">mm (24h)</small></span>
          <span class="metric-label">Indicador de Precipitación</span>
          <span class="metric-sub">
            Acum. 7d: <strong>${precipitation.rainNext7dMm} mm</strong> | Días seguidos sin lluvia: <strong>${precipitation.consecutiveDryDays}</strong>
          </span>
        </div>
      </div>

      <!-- 2. Indicador de Temperatura -->
      <div class="metric-card">
        <div class="metric-icon-box site"><i class="fa-solid fa-temperature-half"></i></div>
        <div class="metric-info">
          <span class="metric-value">
            ${temperature.todayTempMaxC !== null ? temperature.todayTempMaxC.toFixed(1) : '—'}° / ${temperature.todayTempMinC !== null ? temperature.todayTempMinC.toFixed(1) : '—'}°C
          </span>
          <span class="metric-label">Indicador de Temperatura (Máx / Mín)</span>
          <span class="metric-sub">
            Variación térmica diaria (ΔT): <strong>${temperature.todayThermalAmplitudeC !== null ? temperature.todayThermalAmplitudeC + ' °C' : '—'}</strong>
          </span>
        </div>
      </div>

      <!-- 3. Indicador de Evapotranspiración FAO ET0 -->
      <div class="metric-card">
        <div class="metric-icon-box agro"><i class="fa-solid fa-sun-plant-wilt"></i></div>
        <div class="metric-info">
          <span class="metric-value">${evapotranspiration.todayEt0Mm} <small style="font-size: 0.9rem;">mm/día</small></span>
          <span class="metric-label">Evapotranspiración FAO ET₀</span>
          <span class="metric-sub">
            ET₀ acumulada 7 días: <strong>${evapotranspiration.cumulativeEt07dMm} mm</strong>
          </span>
        </div>
      </div>

      <!-- 4. Indicador de Humedad (Aire y Suelo Estimado) -->
      <div class="metric-card">
        <div class="metric-icon-box water"><i class="fa-solid fa-water"></i></div>
        <div class="metric-info">
          <span class="metric-value">${humidity.currentAirHumidityPct !== null ? humidity.currentAirHumidityPct + '%' : '—'}</span>
          <span class="metric-label">Humedad Relativa del Aire</span>
          <span class="metric-sub">
            Suelo (est. modelo): <strong>${humidity.estimatedSoilMoisturePct !== null ? humidity.estimatedSoilMoisturePct + '% vol.' : 'N/D'}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- Sección 5.3: Integración con Monitoreo de Humedad del Suelo (Observación Instrumental/Campo vs Modelo) -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <h3 class="card-title"><i class="fa-solid fa-layer-group" style="color: var(--color-earth-700);"></i> Seguimiento de Humedad del Suelo: Campo vs. Estimación Meteorológica</h3>
          <p class="card-subtitle">Distinción estricta entre registros directos en terreno y estimaciones volumétricas del modelo numérico</p>
        </div>
        <span class="badge badge-neutral">Verificación Agroclimática</span>
      </div>
      <div class="card-body">
        <div class="form-grid-2">
          <!-- Columna 1: Estimación del Modelo Meteorológico -->
          <div class="coords-picker-box" style="margin-bottom: 0;">
            <div class="d-flex justify-between align-center mb-2">
              <strong style="font-size: var(--font-size-sm); color: var(--color-blue-800);">
                <i class="fa-solid fa-satellite"></i> Humedad Estimada por Modelo Meteorológico
              </strong>
              <span class="badge badge-info">Estimación de Modelo</span>
            </div>
            <p style="font-size: var(--font-size-sm); margin-bottom: 6px;">
              <strong>Valor superficial estimado (0–9 cm):</strong> ${escapeHtml(formatSoilMoisture(humidity.estimatedSoilMoistureM3))}
            </p>
            <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0;">
              <i class="fa-solid fa-circle-info"></i> <em>Nota técnica:</em> Este valor corresponde a una simulación numérica de cuadrícula satelital/atmosférica (Open-Meteo) y <strong>no sustituye una medición instrumental de sensor en finca</strong>.
            </p>
          </div>

          <!-- Columna 2: Registros de Humedad y Condición de Suelo en Campo (HIDROTERRA) -->
          <div class="coords-picker-box" style="margin-bottom: 0;">
            <div class="d-flex justify-between align-center mb-2">
              <strong style="font-size: var(--font-size-sm); color: var(--color-green-800);">
                <i class="fa-solid fa-seedling"></i> Registros de Suelo en Campo / Sensores (HIDROTERRA)
              </strong>
              <span class="badge badge-success">Observación Real en Campo</span>
            </div>
            ${soilObservations && soilObservations.length > 0 ? `
              <div style="font-size: var(--font-size-xs); display: flex; flex-direction: column; gap: 6px; max-height: 110px; overflow-y: auto;">
                ${soilObservations.slice(0, 3).map(obs => `
                  <div style="padding: 6px 8px; background: var(--color-white); border-radius: var(--radius-sm); border: 1px solid var(--color-neutral-200);">
                    <div><strong>${formatDateTime(obs.observedAt)}:</strong> ${escapeHtml(obs.description)}</div>
                    ${obs.observedStatus ? `<div class="text-muted">Condición reportada: <strong>${escapeHtml(obs.observedStatus)}</strong> | Resp.: ${escapeHtml(obs.responsible || '—')}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `
              <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0;">
                No hay observaciones de categoría «Humedad o erosión del suelo» registradas recientemente. Puede añadir lecturas de sensores o notas de humedad desde el módulo de <strong>Observaciones Hídricas</strong>.
              </p>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

