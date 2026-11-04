/**
 * Vista: Tablero Principal (Dashboard View)
 */

import { DashboardService } from '../../application/dashboard.service.js';
import { MapService } from '../../infrastructure/geo/map.service.js';
import { formatDateTime, formatDate } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { renderEmptyState } from '../components/empty-state.js';

export class DashboardView {
  constructor(router) {
    this.router = router;
    this.mapService = null;
    this.chartInstance = null;
  }

  async render(container) {
    container.innerHTML = `
      <div class="dashboard-loading" style="padding: 40px; text-align: center;">
        <p>Cargando información territorial...</p>
      </div>
    `;

    const data = await DashboardService.getSummaryMetrics();
    const { counts, lastRecordDate, backupStatus, chartData, recentRain } = data;

    container.innerHTML = `
      <div class="dashboard-view">
        <!-- Acciones Rápidas -->
        <div class="quick-actions-bar">
          <span class="quick-actions-title"><i class="fa-solid fa-bolt"></i> Acciones Rápidas:</span>
          <button class="btn btn-blue" id="qa-btn-add-rain">
            <span><i class="fa-solid fa-cloud-rain"></i> Registrar Lluvia</span>
          </button>
          <button class="btn btn-primary" id="qa-btn-add-pluv">
            <span><i class="fa-solid fa-location-dot"></i> Añadir Pluviómetro</span>
          </button>
          <button class="btn btn-outline" id="qa-btn-add-source">
            <span><i class="fa-solid fa-water"></i> Registrar Fuente de Agua</span>
          </button>
        </div>

        <!-- Grilla de Métricas Reales -->
        <div class="dashboard-metrics-grid">
          <div class="metric-card">
            <div class="metric-icon-box water"><i class="fa-solid fa-water"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.totalSources}</span>
              <span class="metric-label">Fuentes de Agua</span>
              <span class="metric-sub">${counts.activeSources} disponibles / verificadas</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box pluv"><i class="fa-solid fa-cloud-rain"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.activePluviometers}</span>
              <span class="metric-label">Pluviómetros Activos</span>
              <span class="metric-sub">${counts.totalPluviometers} equipos registrados</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box rain"><i class="fa-solid fa-chart-line"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.rainfallRecordsCount}</span>
              <span class="metric-label">Mediciones de Lluvia</span>
              <span class="metric-sub">Registradas en el sistema</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box rain"><i class="fa-solid fa-umbrella"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.monthAccumulatedMm} <small style="font-size: 1rem; font-weight: 500;">mm</small></span>
              <span class="metric-label">Acumulado Mes Actual</span>
              <span class="metric-sub">${counts.monthMeasuredDays} días con registros</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box site"><i class="fa-solid fa-house-user"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.sitesCount}</span>
              <span class="metric-label">Comunidades / Sitios</span>
              <span class="metric-sub">Montes de María</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box agro"><i class="fa-solid fa-seedling"></i></div>
            <div class="metric-info">
              <span class="metric-value">${counts.parcelsCount}</span>
              <span class="metric-label">Parcelas Productivas</span>
              <span class="metric-sub">${counts.observationsCount} observaciones hídricas</span>
            </div>
          </div>
        </div>

        <!-- Paneles Visuales: Gráfico y Mapa Resumido -->
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

        <!-- Tabla de Actividad Reciente -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Últimas Mediciones de Lluvia</h3>
              <p class="card-subtitle">
                ${lastRecordDate ? `Última sincronización local: ${formatDateTime(lastRecordDate)}` : 'Sin registros aún'}
              </p>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            ${recentRain.length > 0 ? `
              <div class="table-responsive">
                <table class="data-table data-table-cards">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Precipitación</th>
                      <th>Pluviómetro</th>
                      <th>Tipo</th>
                      <th>Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentRain.map(r => {
                      const pluv = data.pluviometers.find(p => p.id === r.pluviometerId);
                      return `
                        <tr>
                          <td data-label="Fecha y Hora">${formatDateTime(r.measuredAt)}</td>
                          <td data-label="Precipitación"><strong>${r.precipitationMm} mm</strong></td>
                          <td data-label="Pluviómetro">${escapeHtml(pluv ? pluv.name : r.pluviometerId)}</td>
                          <td data-label="Tipo"><span class="badge badge-info">${escapeHtml(r.measurementType)}</span></td>
                          <td data-label="Responsable">${escapeHtml(r.responsible || '—')}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="padding: var(--spacing-6);">
                ${renderEmptyState({
                  icon: '<i class="fa-solid fa-clipboard-list"></i>',
                  title: 'No hay actividad reciente',
                  description: 'Registre una medición de lluvia, fuente de agua o pluviómetro para ver la trazabilidad.'
                })}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
    this._initChart(chartData);
    this._initMiniMap(data);
  }

  _bindEvents(container) {
    const qaRain = container.querySelector('#qa-btn-add-rain');
    const qaPluv = container.querySelector('#qa-btn-add-pluv');
    const qaSource = container.querySelector('#qa-btn-add-source');
    const viewAllRain = container.querySelector('#btn-dash-view-all-rain');
    const viewFullMap = container.querySelector('#btn-dash-view-full-map');

    if (qaRain) qaRain.addEventListener('click', () => this.router.navigate('rainfall', { openModal: true }));
    if (qaPluv) qaPluv.addEventListener('click', () => this.router.navigate('pluviometers', { openModal: true }));
    if (qaSource) qaSource.addEventListener('click', () => this.router.navigate('water-sources', { openModal: true }));
    if (viewAllRain) viewAllRain.addEventListener('click', () => this.router.navigate('rainfall'));
    if (viewFullMap) viewFullMap.addEventListener('click', () => this.router.navigate('map'));
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
      onMarkerClick: (module, id) => this.router.navigate(module, { highlightId: id })
    });
  }

  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    if (this.mapService) {
      this.mapService.destroy();
      this.mapService = null;
    }
  }
}
