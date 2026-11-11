/**
 * Vista: Tablero Principal (Dashboard View — Sección 8)
 */

import { DashboardService } from '../../application/dashboard.service.js';
import { MapService } from '../../infrastructure/geo/map.service.js';
import { WATER_ALERT_TYPES } from '../../domain/models/WaterAlert.js';
import { formatDateTime } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderStatusBadge } from '../components/status-badge.js';

export class DashboardView {
  constructor(router) {
    this.router = router;
    this.mapService = null;
    this.chartInstance = null;
    this.availChartInstance = null;
  }

  async render(container) {
    container.innerHTML = `
      <div class="dashboard-loading" style="padding: 40px; text-align: center;">
        <p>Cargando información territorial...</p>
      </div>
    `;

    const data = await DashboardService.getSummaryMetrics();
    const { counts, lastRecordDate, chartData, availabilityChartData, recentRain, recentWaterMeasurements, activeAlerts } = data;

    container.innerHTML = `
      <div class="dashboard-view">
        <!-- Acciones Rápidas y Accesos a Módulos -->
        <div class="quick-actions-bar">
          <span class="quick-actions-title">Acciones Rápidas:</span>
          <button class="btn btn-blue" id="qa-btn-add-rain">
            <span>Registrar Lluvia</span>
          </button>
          <button class="btn btn-primary" id="qa-btn-add-water-meas">
            <span>Medir Nivel de Fuente</span>
          </button>
          <button class="btn btn-outline" id="qa-btn-water-tools">
            <span>Calculadoras Hídricas</span>
          </button>
          <button class="btn btn-outline" id="qa-btn-add-source">
            <span>Registrar Fuente</span>
          </button>
          <button class="btn btn-outline" id="qa-btn-alerts">
            <span>Alertas (${counts.activeAlertsCount})</span>
          </button>
        </div>

        <!-- Grilla de Métricas Reales -->
        <div class="dashboard-metrics-grid">
          <div class="metric-card">
            <div class="metric-icon-box water"><i class="fa-solid fa-water"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.totalSources}</span>
              <span class="metric-label">Fuentes Hídricas</span>
              <span class="metric-sub">${counts.sourcesWithMeasurements} con mediciones de nivel</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box agro"><i class="fa-solid fa-gauge-high"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.highAvailabilitySources} <small style="font-size: 0.9rem; font-weight: 500;">alta</small> / ${counts.lowOrCriticalSources} <small style="font-size: 0.9rem; font-weight: 500;">baja-crít.</small></span>
              <span class="metric-label">Estado Disponibilidad</span>
              <span class="metric-sub">${counts.waterMeasurementsCount} mediciones hídricas realizadas</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box rain"><i class="fa-solid fa-database"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.totalEstimatedAvailableLiters > 0 ? `${(counts.totalEstimatedAvailableLiters / 1000).toFixed(1)} <small style="font-size: 0.95rem;">m³</small>` : '—'}</span>
              <span class="metric-label">Volumen Disponible Est.</span>
              <span class="metric-sub">${counts.totalRegisteredCapacityLiters > 0 ? `De ${(counts.totalRegisteredCapacityLiters / 1000).toFixed(1)} m³ registrados` : 'Sin capacidad nominal reg.'}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box pluv"><i class="fa-solid fa-cloud-rain"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.activePluviometers}</span>
              <span class="metric-label">Pluviómetros Activos</span>
              <span class="metric-sub">${counts.rainfallRecordsCount} lecturas (${counts.totalAccumulatedRainMm} mm total)</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box rain"><i class="fa-solid fa-umbrella"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.monthAccumulatedMm} <small style="font-size: 1rem; font-weight: 500;">mm</small></span>
              <span class="metric-label">Acumulado Mes Actual</span>
              <span class="metric-sub">${counts.monthMeasuredDays} días con registros este mes</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box site"><i class="fa-solid fa-house-user"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.sitesCount}</span>
              <span class="metric-label">Comunidades Monitoreadas</span>
              <span class="metric-sub">${counts.parcelsCount} parcelas | ${counts.observationsCount} observaciones</span>
            </div>
          </div>
        </div>

        <!-- Paneles Visuales: Gráfico de Precipitaciones y Mapa Territorial -->
        <div class="dashboard-visual-grid">
          <!-- Gráfico de Precipitaciones -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Precipitación Diaria Registrada</h3>
                <p class="card-subtitle">Milímetros (mm) por fecha en registros territoriales</p>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-dash-view-all-rain">Ver Historial</button>
            </div>
            <div class="card-body">
              ${chartData.labels.length > 0 ? `
                <div class="chart-wrapper">
                  <canvas id="dashboard-rainfall-chart"></canvas>
                </div>
              ` : `
                ${renderEmptyState({
                  icon: '<i class="fa-solid fa-cloud-rain"></i>',
                  title: 'Sin lecturas de lluvia registradas',
                  description: 'Comience a ingresar mediciones de sus pluviómetros para visualizar la curva de precipitación diaria.'
                })}
              `}
            </div>
          </div>

          <!-- Mapa Resumido de Elementos Georreferenciados -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Distribución Territorial</h3>
                <p class="card-subtitle">Fuentes, pluviómetros y sitios georreferenciados</p>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-dash-view-full-map">Abrir Mapa Completo</button>
            </div>
            <div class="card-body" style="padding: 0;">
              <div class="dashboard-map-container" id="dashboard-mini-map"></div>
            </div>
          </div>
        </div>

        <!-- Segunda Fila Visual: Evolución de Disponibilidad Hídrica y Resumen de Alertas -->
        <div class="dashboard-visual-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Evolución de Disponibilidad Hídrica</h3>
                <p class="card-subtitle">Niveles y porcentajes registrados en fuentes monitoreadas</p>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-dash-view-availability">Ir a Disponibilidad</button>
            </div>
            <div class="card-body">
              ${availabilityChartData.labels.length > 0 ? `
                <div class="chart-wrapper">
                  <canvas id="dashboard-availability-chart"></canvas>
                </div>
              ` : `
                ${renderEmptyState({
                  icon: '<i class="fa-solid fa-water"></i>',
                  title: 'Sin mediciones de disponibilidad registradas',
                  description: 'Registre mediciones periódicas de nivel o volumen en sus fuentes hídricas para visualizar su evolución.'
                })}
              `}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Resumen de Alertas Hídricas Activas (${counts.activeAlertsCount})</h3>
                <p class="card-subtitle">Alertas basadas en reglas sobre datos reales del territorio</p>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-dash-view-alerts">Gestionar Alertas</button>
            </div>
            <div class="card-body">
              ${activeAlerts.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${activeAlerts.map(a => `
                    <div style="border-left: 4px solid ${a.priority === 'critica' ? 'var(--color-danger)' : 'var(--color-warning)'}; background: var(--color-neutral-50); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
                      <div class="d-flex justify-between align-center mb-1">
                        <strong>${escapeHtml(WATER_ALERT_TYPES[a.type] || a.type)}</strong>
                        ${renderStatusBadge(a.priority)}
                      </div>
                      <div>${escapeHtml(a.description)}</div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                ${renderEmptyState({
                  icon: '<i class="fa-solid fa-shield-heart"></i>',
                  title: 'Sin alertas críticas pendientes',
                  description: 'No se detectan fuentes en estado crítico ni caídas bruscas de nivel en los registros actuales.'
                })}
              `}
            </div>
          </div>
        </div>

        <!-- Tablas de Actividad Reciente (Lluvias y Disponibilidad Hídrica) -->
        <div class="dashboard-visual-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Últimas Mediciones de Lluvia</h3>
                <p class="card-subtitle">
                  ${lastRecordDate ? `Última actividad local: ${formatDateTime(lastRecordDate)}` : 'Sin registros aún'}
                </p>
              </div>
            </div>
            <div class="card-body" style="padding: 0;">
              ${recentRain.length > 0 ? `
                <div class="table-responsive">
                  <table class="data-table data-table-cards">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Lluvia</th>
                        <th>Pluviómetro</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recentRain.map(r => {
                        const pluv = data.pluviometers.find(p => p.id === r.pluviometerId);
                        return `
                          <tr>
                            <td data-label="Fecha">${formatDateTime(r.measuredAt)}</td>
                            <td data-label="Lluvia"><strong>${r.precipitationMm} mm</strong></td>
                            <td data-label="Pluviómetro">${escapeHtml(pluv ? pluv.name : r.pluviometerId)}</td>
                            <td data-label="Responsable">${escapeHtml(r.responsible || '—')}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="padding: var(--spacing-4);">
                  ${renderEmptyState({
                    icon: '<i class="fa-solid fa-clipboard-list"></i>',
                    title: 'Sin lecturas de lluvia recientes',
                    description: 'Registre una lectura de pluviómetro para verla aquí.'
                  })}
                </div>
              `}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Últimas Mediciones de Disponibilidad Hídrica</h3>
                <p class="card-subtitle">Seguimiento reciente de niveles y capacidad en fuentes de agua</p>
              </div>
            </div>
            <div class="card-body" style="padding: 0;">
              ${recentWaterMeasurements.length > 0 ? `
                <div class="table-responsive">
                  <table class="data-table data-table-cards">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Fuente</th>
                        <th>Nivel / Valor</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recentWaterMeasurements.map(m => {
                        const src = data.sources.find(s => s.id === m.sourceId);
                        return `
                          <tr>
                            <td data-label="Fecha">${formatDateTime(m.measuredAt)}</td>
                            <td data-label="Fuente">${escapeHtml(src ? src.name : m.sourceCode)}</td>
                            <td data-label="Nivel / Valor"><strong>${m.waterLevel} ${escapeHtml(m.unit)}</strong></td>
                            <td data-label="Estado">${renderStatusBadge(m.status)}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="padding: var(--spacing-4);">
                  ${renderEmptyState({
                    icon: '<i class="fa-solid fa-water"></i>',
                    title: 'Sin mediciones hídricas recientes',
                    description: 'Registre mediciones de nivel o volumen en el módulo Disponibilidad Hídrica.'
                  })}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
    this._initChart(chartData);
    this._initAvailabilityChart(availabilityChartData);
    this._initMiniMap(data);
  }

  _bindEvents(container) {
    const qaRain = container.querySelector('#qa-btn-add-rain');
    const qaWaterMeas = container.querySelector('#qa-btn-add-water-meas');
    const qaWaterTools = container.querySelector('#qa-btn-water-tools');
    const qaSource = container.querySelector('#qa-btn-add-source');
    const qaAlerts = container.querySelector('#qa-btn-alerts');
    const viewAllRain = container.querySelector('#btn-dash-view-all-rain');
    const viewFullMap = container.querySelector('#btn-dash-view-full-map');
    const viewAvail = container.querySelector('#btn-dash-view-availability');
    const viewAlerts = container.querySelector('#btn-dash-view-alerts');

    if (qaRain) qaRain.addEventListener('click', () => this.router.navigate('rainfall', { openModal: true }));
    if (qaWaterMeas) qaWaterMeas.addEventListener('click', () => this.router.navigate('water-availability', { openModal: true }));
    if (qaWaterTools) qaWaterTools.addEventListener('click', () => this.router.navigate('water-tools'));
    if (qaSource) qaSource.addEventListener('click', () => this.router.navigate('water-sources', { openModal: true }));
    if (qaAlerts) qaAlerts.addEventListener('click', () => this.router.navigate('water-alerts'));
    if (viewAllRain) viewAllRain.addEventListener('click', () => this.router.navigate('rainfall'));
    if (viewFullMap) viewFullMap.addEventListener('click', () => this.router.navigate('map'));
    if (viewAvail) viewAvail.addEventListener('click', () => this.router.navigate('water-availability'));
    if (viewAlerts) viewAlerts.addEventListener('click', () => this.router.navigate('water-alerts'));
  }

  _initChart(chartData) {
    if (!chartData || chartData.labels.length === 0) return;
    const canvas = document.getElementById('dashboard-rainfall-chart');
    if (!canvas || typeof window === 'undefined' || !window.Chart) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    try {
      this.chartInstance = new window.Chart(canvas, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Precipitación: ${context.parsed.y} mm`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Milímetros (mm)' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error inicializando Chart.js en dashboard', e);
    }
  }

  _initAvailabilityChart(availabilityChartData) {
    if (!availabilityChartData || availabilityChartData.labels.length === 0) return;
    const canvas = document.getElementById('dashboard-availability-chart');
    if (!canvas || typeof window === 'undefined' || !window.Chart) return;

    if (this.availChartInstance) {
      this.availChartInstance.destroy();
    }

    try {
      this.availChartInstance = new window.Chart(canvas, {
        type: 'line',
        data: {
          labels: availabilityChartData.labels,
          datasets: [
            {
              label: 'Nivel / Valor Medido',
              data: availabilityChartData.levels,
              borderColor: '#0077b6',
              backgroundColor: 'rgba(0, 119, 182, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } catch (e) {
      console.warn('Error inicializando gráfica de disponibilidad en dashboard', e);
    }
  }

  _initMiniMap(data) {
    const mapContainer = document.getElementById('dashboard-mini-map');
    if (!mapContainer || typeof window === 'undefined' || !window.L) return;

    if (this.mapService) {
      this.mapService.destroy();
    }

    this.mapService = new MapService('dashboard-mini-map', {
      zoom: 9,
      fitBounds: true
    });

    this.mapService.init();
    this.mapService.updateElements({
      waterSources: data.sources,
      pluviometers: data.pluviometers,
      sites: data.sites,
      parcels: data.parcels,
      onMarkerClick: (module, id, extraParams = {}) => this.router.navigate(module, { highlightId: id, sourceId: id, ...extraParams })
    });
  }

  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    if (this.availChartInstance) {
      this.availChartInstance.destroy();
      this.availChartInstance = null;
    }
    if (this.mapService) {
      this.mapService.destroy();
      this.mapService = null;
    }
  }
}
