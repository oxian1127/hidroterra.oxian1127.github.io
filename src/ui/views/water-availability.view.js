/**
 * Vista: Monitoreo de Disponibilidad Hídrica (WaterAvailabilityView — Sección 4)
 * Registro periódico de niveles/volúmenes en fuentes de agua, clasificación técnica por infraestructura,
 * historial cronológico, gráficas de evolución, comparación entre fechas y Ficha Técnica de Disponibilidad.
 */

import { WaterAvailabilityService } from '../../application/water-availability.service.js';
import { WaterSourcesService } from '../../application/water-sources.service.js';
import { SitesService } from '../../application/sites.service.js';
import {
  WATER_MEASUREMENT_METHODS,
  WATER_MEASUREMENT_UNITS,
  WATER_AVAILABILITY_STATUSES
} from '../../domain/models/WaterMeasurement.js';
import { WATER_SOURCE_TYPES, WATER_SOURCE_USES } from '../../domain/models/WaterSource.js';
import { getInfrastructureConfig } from '../../domain/rules/water-availability.rules.js';
import { formatCoordinates } from '../../domain/rules/coordinates.rules.js';
import { formatDate, formatDateTime, todayDateInput, nowTimeInput } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { DataTable } from '../components/data-table.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { renderStatusBadge } from '../components/status-badge.js';
import { renderEmptyState } from '../components/empty-state.js';

export class WaterAvailabilityView {
  constructor(router) {
    this.router = router;
    this.sources = [];
    this.sites = [];
    this.overviewList = [];
    this.measurements = [];
    this.dataTable = null;
    this.evolutionChart = null;
    this.sheetChart = null;

    this.filters = {
      sourceId: 'all',
      siteId: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
      search: ''
    };
  }

  async render(container, params = {}) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;" class="text-muted">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
        <p>Cargando monitoreo de disponibilidad hídrica...</p>
      </div>
    `;

    const [sources, sites] = await Promise.all([
      WaterSourcesService.getAll(),
      SitesService.getAll()
    ]);
    this.sources = sources;
    this.sites = sites;

    if (params.sourceId) {
      this.filters.sourceId = params.sourceId;
    }

    container.innerHTML = `
      <div class="water-availability-view">
        <!-- Encabezado de la Vista -->
        <div class="view-header d-flex justify-between align-center mb-4">
          <div>
            <h2>Monitoreo de Disponibilidad Hídrica</h2>
            <p class="text-muted">Seguimiento periódico de niveles, volúmenes observados o estimados, tendencias y clasificación técnica por fuente hídrica.</p>
          </div>
          <div class="d-flex gap-2" style="flex-wrap: wrap;">
            <button class="btn btn-outline" id="btn-goto-water-tools">
              <span>Calculadoras Hídricas</span>
            </button>
            <button class="btn btn-primary" id="btn-new-water-measurement">
              <span>Registrar Medición Hídrica</span>
            </button>
          </div>
        </div>

        <!-- Tarjetas de Indicadores de Disponibilidad -->
        <div id="availability-summary-cards" class="mb-4"></div>

        <!-- Barra de Filtros -->
        <div class="filter-bar mb-4">
          <input type="text" class="form-control filter-input-search" id="avail-filter-search"
                 placeholder="Buscar por fuente, código o responsable..." value="${escapeHtml(this.filters.search)}" />

          <select class="form-control filter-select" id="avail-filter-source">
            <option value="all">Todas las fuentes hídricas</option>
            ${this.sources.map(s => `
              <option value="${escapeHtml(s.id)}" ${this.filters.sourceId === s.id ? 'selected' : ''}>
                ${escapeHtml(s.code)} — ${escapeHtml(s.name)}
              </option>
            `).join('')}
          </select>

          <select class="form-control filter-select" id="avail-filter-site">
            <option value="all">Todas las comunidades</option>
            ${this.sites.map(st => `
              <option value="${escapeHtml(st.id)}" ${this.filters.siteId === st.id ? 'selected' : ''}>
                ${escapeHtml(st.name)} (${escapeHtml(st.municipality)})
              </option>
            `).join('')}
          </select>

          <select class="form-control filter-select" id="avail-filter-status">
            <option value="all">Todos los estados de disponibilidad</option>
            ${Object.entries(WATER_AVAILABILITY_STATUSES).map(([k, v]) => `
              <option value="${k}" ${this.filters.status === k ? 'selected' : ''}>${v}</option>
            `).join('')}
          </select>

          <input type="date" class="form-control" id="avail-filter-start" value="${this.filters.startDate}" title="Fecha inicial" style="max-width: 155px;" />
          <input type="date" class="form-control" id="avail-filter-end" value="${this.filters.endDate}" title="Fecha final" style="max-width: 155px;" />

          <button class="btn btn-outline btn-sm" id="btn-avail-clear-filters">Limpiar</button>
        </div>

        <!-- Estado y Fichas Técnicas por Fuente Hídrica -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Estado Actual por Fuente e Infraestructura</h3>
              <p class="card-subtitle">Clasificación diferenciada según el tipo de fuente (pozo, jagüey, reservorio, tanque, manantial, arroyo)</p>
            </div>
          </div>
          <div class="card-body" id="availability-sources-grid"></div>
        </div>

        <!-- Panel Visual: Gráfica de Evolución y Comparador entre Fechas -->
        <div class="dashboard-visual-grid mb-4">
          <!-- Gráfica de evolución del nivel/disponibilidad -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Evolución del Nivel y Capacidad Disponible</h3>
                <p class="card-subtitle" id="avail-chart-subtitle">Curva histórica de mediciones registradas</p>
              </div>
            </div>
            <div class="card-body" id="avail-chart-box"></div>
          </div>

          <!-- Comparador de mediciones entre fechas -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Comparación entre Fechas y Variación Porcentual</h3>
                <p class="card-subtitle">Compare dos mediciones de una misma fuente para evaluar recuperación o descenso</p>
              </div>
            </div>
            <div class="card-body" id="avail-date-comparison-box"></div>
          </div>
        </div>

        <!-- Tabla de Historial Cronológico de Mediciones -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Historial Cronológico de Mediciones Hídricas</h3>
              <p class="card-subtitle">Diferenciación explícita entre valores medidos directamente en campo y valores estimados por cálculo</p>
            </div>
          </div>
          <div class="card-body" style="padding: 0;" id="avail-measurements-table-container"></div>
        </div>
      </div>
    `;

    this._setupTable();
    this._bindEvents(container);
    await this._loadData();

    if (params.openModal) {
      this.openMeasurementFormModal(null, params.sourceId || null);
    } else if (params.openSheet && params.sourceId) {
      this.openTechnicalSheetModal(params.sourceId);
    }
  }

  _setupTable() {
    this.dataTable = new DataTable({
      columns: [
        { key: 'measuredAtFormatted', label: 'Fecha y Hora' },
        {
          key: 'sourceDisplay',
          label: 'Fuente Hídrica',
          render: (item) => `
            <div>
              <strong>${escapeHtml(item.sourceCode)}</strong> — ${escapeHtml(item.sourceName)}
              <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(item.sourceTypeLabel)} | ${escapeHtml(item.siteName)}</div>
            </div>
          `
        },
        {
          key: 'levelDisplay',
          label: 'Nivel / Valor Medido',
          render: (item) => `
            <div>
              <strong>${item.waterLevel} ${escapeHtml(item.unit)}</strong>
              ${item.totalDepthMeters ? `<div class="text-muted" style="font-size: 0.75rem;">Prof. total: ${item.totalDepthMeters} m</div>` : ''}
            </div>
          `
        },
        {
          key: 'volumeDisplay',
          label: 'Volumen y Capacidad',
          render: (item) => {
            const parts = [];
            if (item.observedVolumeLiters !== null && item.observedVolumeLiters !== undefined) {
              parts.push(`<div><span class="badge badge-success" title="Medición volumétrica observada">Observado</span> <strong>${Number(item.observedVolumeLiters).toLocaleString('es-CO')} L</strong></div>`);
            } else if (item.estimatedVolumeLiters !== null && item.estimatedVolumeLiters !== undefined) {
              parts.push(`<div><span class="badge badge-info" title="Valor calculado mediante estimación técnica">Estimado</span> <strong>${Number(item.estimatedVolumeLiters).toLocaleString('es-CO')} L</strong></div>`);
            } else {
              parts.push('<span class="text-muted">—</span>');
            }
            if (item.availableCapacityPct !== null && item.availableCapacityPct !== undefined) {
              parts.push(`<div class="text-muted" style="font-size: 0.75rem;">Capacidad: <strong>${item.availableCapacityPct}%</strong></div>`);
            }
            return parts.join('');
          }
        },
        { key: 'methodLabel', label: 'Método' },
        { key: 'statusBadge', label: 'Estado Disponibilidad', render: (item) => item.statusBadge },
        { key: 'responsible', label: 'Responsable' },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-sheet-source" data-source-id="${item.sourceId}" title="Ver ficha técnica de la fuente">Ficha</button>
              <button class="btn btn-outline btn-sm btn-edit-measurement" data-id="${item.id}" title="Editar medición">Editar</button>
              <button class="btn btn-outline btn-sm btn-delete-measurement" data-id="${item.id}" title="Eliminar medición">Eliminar</button>
            </div>
          `
        }
      ],
      emptyTitle: 'No hay mediciones de disponibilidad hídrica registradas',
      emptyDescription: 'Utilice el botón «Registrar Medición Hídrica» para iniciar el seguimiento periódico de niveles y volúmenes en sus fuentes de agua.'
    });
  }

  async _loadData() {
    const [overviewList, measurements] = await Promise.all([
      WaterAvailabilityService.getSourcesAvailabilityOverview({
        siteId: this.filters.siteId,
        availabilityStatus: this.filters.status
      }),
      WaterAvailabilityService.getAllMeasurements(this.filters)
    ]);

    this.overviewList = this.filters.sourceId !== 'all'
      ? overviewList.filter(s => s.id === this.filters.sourceId)
      : overviewList;
    this.measurements = measurements;

    this._renderSummaryCards(overviewList, measurements);
    this._renderSourcesGrid(this.overviewList);
    this._renderEvolutionChart(measurements);
    this._renderDateComparisonPanel(measurements);

    const enrichedTableItems = measurements.map(m => ({
      ...m,
      measuredAtFormatted: formatDateTime(m.measuredAt),
      methodLabel: WATER_MEASUREMENT_METHODS[m.measurementMethod] || m.measurementMethod,
      statusBadge: renderStatusBadge(m.status)
    }));

    this.dataTable.setItems(enrichedTableItems);
    const tableContainer = document.getElementById('avail-measurements-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(tableContainer, () => this._bindTableButtons(tableContainer));
      this._bindTableButtons(tableContainer);
    }
  }

  _renderSummaryCards(allOverview, measurements) {
    const box = document.getElementById('availability-summary-cards');
    if (!box) return;

    const totalSources = allOverview.length;
    const monitoredSources = allOverview.filter(s => s.measurementsCount > 0).length;
    const highCount = allOverview.filter(s => s.availabilityStatus === 'alta').length;
    const modCount = allOverview.filter(s => s.availabilityStatus === 'moderada').length;
    const lowOrCritCount = allOverview.filter(s => s.availabilityStatus === 'baja' || s.availabilityStatus === 'critica').length;
    const noInfoCount = allOverview.filter(s => s.availabilityStatus === 'sin_informacion').length;

    const totalAvailableVolLiters = allOverview.reduce((acc, s) => acc + (Number(s.effectiveVolumeLiters) || 0), 0);
    const totalKnownCapLiters = allOverview.reduce((acc, s) => acc + (Number(s.knownCapacityLiters) || 0), 0);

    box.innerHTML = `
      <div class="dashboard-metrics-grid">
        <div class="metric-card">
          <div class="metric-icon-box water"><i class="fa-solid fa-water"></i></div>
          <div class="metric-info">
            <span class="metric-value">${monitoredSources} / ${totalSources}</span>
            <span class="metric-label">Fuentes Monitoreadas</span>
            <span class="metric-sub">${measurements.length} mediciones registradas</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box agro"><i class="fa-solid fa-circle-check"></i></div>
          <div class="metric-info">
            <span class="metric-value">${highCount}</span>
            <span class="metric-label">Disponibilidad Alta</span>
            <span class="metric-sub">${modCount} en disponibilidad moderada</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box site"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="metric-info">
            <span class="metric-value">${lowOrCritCount}</span>
            <span class="metric-label">Baja o Crítica</span>
            <span class="metric-sub">${noInfoCount} sin información suficiente</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box rain"><i class="fa-solid fa-database"></i></div>
          <div class="metric-info">
            <span class="metric-value">${totalAvailableVolLiters > 0 ? `${(totalAvailableVolLiters / 1000).toFixed(1)} m³` : '—'}</span>
            <span class="metric-label">Volumen Estimado Disponible</span>
            <span class="metric-sub">${totalKnownCapLiters > 0 ? `Capacidad reg.: ${(totalKnownCapLiters / 1000).toFixed(1)} m³` : 'Configure capacidad en fuentes'}</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderSourcesGrid(overviewList) {
    const gridBox = document.getElementById('availability-sources-grid');
    if (!gridBox) return;

    if (overviewList.length === 0) {
      gridBox.innerHTML = renderEmptyState({
        icon: '<i class="fa-solid fa-faucet-drip"></i>',
        title: 'No hay fuentes hídricas para mostrar con los filtros seleccionados',
        description: 'Registre fuentes hídricas en el inventario o ajuste los filtros de búsqueda.'
      });
      return;
    }

    gridBox.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: var(--spacing-4);">
        ${overviewList.map(s => {
          const latest = s.latestMeasurement;
          const trendBadgeClass = s.trend === 'recuperacion' ? 'badge-success' : s.trend === 'disminucion' ? 'badge-danger' : 'badge-neutral';
          return `
            <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); background: var(--color-surface); display: flex; flex-direction: column; justify-content: space-between; gap: var(--spacing-3); min-width: 0; max-width: 100%; overflow: hidden; overflow-wrap: break-word; word-break: break-word;">
              <div style="min-width: 0;">
                <div class="d-flex justify-between align-center mb-2" style="gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-blue-700); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">
                    ${escapeHtml(s.code)} • ${escapeHtml(s.typeLabel)}
                  </span>
                  ${renderStatusBadge(s.availabilityStatus)}
                </div>
                <h4 style="margin: 0 0 4px; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</h4>
                <p class="text-muted" style="font-size: 0.8rem; margin: 0 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(s.siteName)} (${escapeHtml(s.municipality)})">
                  ${escapeHtml(s.siteName)} (${escapeHtml(s.municipality)})
                </p>

                ${latest ? `
                  <div style="background: var(--color-neutral-50); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; line-height: 1.5;">
                    <div><strong>Última medición:</strong> ${ latest.waterLevel } ${ escapeHtml(latest.unit) } <span class="text-muted">(${ formatDate(latest.measuredAt) })</span></div>
                    ${s.availableCapacityPct != null && Number.isFinite(Number(s.availableCapacityPct)) ? `<div><strong>Capacidad disponible:</strong> ${s.availableCapacityPct}%</div>` : ''}
                    ${s.effectiveVolumeLiters != null && Number.isFinite(Number(s.effectiveVolumeLiters)) ? `
                      <div>
                        <strong>Volumen ${s.isVolumeEstimated ? '(Estimado por cálculo)' : '(Observado)'}:</strong>
                        ${Number(s.effectiveVolumeLiters).toLocaleString('es-CO')} L (${(Number(s.effectiveVolumeLiters) / 1000).toFixed(2)} m³)
                      </div>
                    ` : ''}
                    <div><strong>Tendencia:</strong> <span class="badge ${trendBadgeClass}">${escapeHtml(s.trendLabel)}</span></div>
                  </div>
                ` : `
                  <div style="background: var(--color-neutral-50); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; color: var(--color-neutral-600);">
                    <strong>Sin información suficiente:</strong> Esta fuente aún no registra mediciones periódicas de nivel o volumen.
                  </div>
                `}
              </div>

              <div class="d-flex justify-between align-center gap-2" style="padding-top: 8px; border-top: 1px solid var(--color-neutral-200);">
                <button class="btn btn-outline btn-sm btn-open-tech-sheet" data-source-id="${s.id}">
                  Ficha Técnica (${s.measurementsCount})
                </button>
                <button class="btn btn-primary btn-sm btn-add-source-measurement" data-source-id="${s.id}">
                  Medir Nivel
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    gridBox.querySelectorAll('.btn-open-tech-sheet').forEach(btn => {
      btn.addEventListener('click', () => this.openTechnicalSheetModal(btn.dataset.sourceId));
    });

    gridBox.querySelectorAll('.btn-add-source-measurement').forEach(btn => {
      btn.addEventListener('click', () => this.openMeasurementFormModal(null, btn.dataset.sourceId));
    });
  }

  _renderEvolutionChart(measurements) {
    const chartBox = document.getElementById('avail-chart-box');
    const subtitleEl = document.getElementById('avail-chart-subtitle');
    if (!chartBox) return;

    if (this.evolutionChart) {
      this.evolutionChart.destroy();
      this.evolutionChart = null;
    }

    if (!measurements || measurements.length === 0) {
      chartBox.innerHTML = renderEmptyState({
        icon: '<i class="fa-solid fa-chart-line"></i>',
        title: 'Sin datos para graficar evolución',
        description: 'Registre mediciones hídricas para visualizar la curva de evolución de niveles y porcentaje de capacidad.'
      });
      return;
    }

    // Si hay una fuente filtrada, graficar su serie; si no, graficar la fuente con más mediciones
    let targetSourceId = this.filters.sourceId !== 'all' ? this.filters.sourceId : null;
    if (!targetSourceId) {
      const countsBySource = {};
      measurements.forEach(m => {
        countsBySource[m.sourceId] = (countsBySource[m.sourceId] || 0) + 1;
      });
      targetSourceId = Object.keys(countsBySource).sort((a, b) => countsBySource[b] - countsBySource[a])[0];
    }

    const sourceSeries = measurements
      .filter(m => m.sourceId === targetSourceId)
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

    const sourceInfo = this.sources.find(s => s.id === targetSourceId);
    const unit = sourceSeries[0]?.unit || 'm';
    if (subtitleEl && sourceInfo) {
      subtitleEl.textContent = `Evolución histórica: ${sourceInfo.code} — ${sourceInfo.name} (${unit})`;
    }

    chartBox.innerHTML = `
      <div class="chart-wrapper" style="height: 260px;">
        <canvas id="avail-evolution-canvas"></canvas>
      </div>
    `;

    const canvas = document.getElementById('avail-evolution-canvas');
    if (!canvas || typeof window === 'undefined' || !window.Chart) return;

    const hasPct = sourceSeries.some(m => m.availableCapacityPct !== null && m.availableCapacityPct !== undefined);

    const datasets = [
      {
        label: `Nivel / Valor medido (${unit})`,
        data: sourceSeries.map(m => m.waterLevel),
        borderColor: '#0077b6',
        backgroundColor: 'rgba(0, 119, 182, 0.15)',
        borderWidth: 2.5,
        tension: 0.25,
        fill: true,
        yAxisID: 'y'
      }
    ];

    if (hasPct) {
      datasets.push({
        label: 'Capacidad disponible (%)',
        data: sourceSeries.map(m => m.availableCapacityPct),
        borderColor: '#2d6a4f',
        backgroundColor: 'rgba(45, 106, 79, 0.1)',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.25,
        fill: false,
        yAxisID: 'y1'
      });
    }

    try {
      this.evolutionChart = new window.Chart(canvas, {
        type: 'line',
        data: {
          labels: sourceSeries.map(m => formatDate(m.measuredAt)),
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              title: { display: true, text: `Nivel (${unit})` }
            },
            ...(hasPct ? {
              y1: {
                type: 'linear',
                position: 'right',
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Capacidad (%)' }
              }
            } : {})
          }
        }
      });
    } catch (err) {
      console.warn('Error al renderizar gráfica de disponibilidad:', err);
    }
  }

  _renderDateComparisonPanel(measurements) {
    const box = document.getElementById('avail-date-comparison-box');
    if (!box) return;

    // Agrupar fuentes con al menos 2 mediciones
    const bySource = {};
    measurements.forEach(m => {
      if (!bySource[m.sourceId]) bySource[m.sourceId] = [];
      bySource[m.sourceId].push(m);
    });

    const comparableSources = Object.keys(bySource).filter(id => bySource[id].length >= 2);
    if (comparableSources.length === 0) {
      box.innerHTML = renderEmptyState({
        icon: '<i class="fa-solid fa-scale-balanced"></i>',
        title: 'Se requieren al menos 2 mediciones en una misma fuente',
        description: 'Registre dos o más mediciones en fechas distintas para calcular variaciones porcentuales y tasas de recuperación o descenso.'
      });
      return;
    }

    const selectedSourceId = (this.filters.sourceId !== 'all' && bySource[this.filters.sourceId]?.length >= 2)
      ? this.filters.sourceId
      : comparableSources[0];

    const list = bySource[selectedSourceId].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );

    const mRecent = list[0];
    const mOlder = list[list.length - 1];

    const renderCompResult = (mA, mB) => {
      const valA = Number(mA.waterLevel) || 0; // Fecha inicial
      const valB = Number(mB.waterLevel) || 0; // Fecha final
      const diff = Number((valB - valA).toFixed(2));
      const pctChange = valA > 0 ? Number((((valB - valA) / valA) * 100).toFixed(1)) : 0;
      const isUp = diff > 0;
      const isDown = diff < 0;

      return `
        <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3); margin-top: var(--spacing-3);">
          <div class="form-grid-2 mb-2">
            <div>
              <small class="text-muted">Medición Base (${formatDate(mA.measuredAt)}):</small>
              <div style="font-size: 1.05rem; font-weight: 700;">${valA} ${escapeHtml(mA.unit)} ${mA.availableCapacityPct != null ? `(${mA.availableCapacityPct}%)` : ''}</div>
            </div>
            <div>
              <small class="text-muted">Medición Comparada (${formatDate(mB.measuredAt)}):</small>
              <div style="font-size: 1.05rem; font-weight: 700;">${valB} ${escapeHtml(mB.unit)} ${mB.availableCapacityPct != null ? `(${mB.availableCapacityPct}%)` : ''}</div>
            </div>
          </div>
          <div style="padding-top: 8px; border-top: 1px solid var(--color-neutral-200); font-size: 0.9rem;">
            <strong>Variación neta:</strong>
            <span class="badge ${isUp ? 'badge-success' : isDown ? 'badge-danger' : 'badge-neutral'}">
              ${diff > 0 ? `+${diff}` : diff} ${escapeHtml(mB.unit)} (${pctChange > 0 ? `+${pctChange}` : pctChange}%)
            </span>
            <span style="margin-left: 6px;" class="text-muted">
              ${isUp ? 'Recuperación de nivel' : isDown ? 'Disminución de nivel' : 'Sin variación'}
            </span>
          </div>
        </div>
      `;
    };

    box.innerHTML = `
      <div>
        <div class="form-group mb-2">
          <label class="form-label" style="font-size: 0.8rem;">Fuente a comparar:</label>
          <select class="form-control form-select" id="comp-source-select">
            ${comparableSources.map(sid => {
              const s = this.sources.find(x => x.id === sid);
              return `<option value="${sid}" ${sid === selectedSourceId ? 'selected' : ''}>${escapeHtml(s ? `${s.code} — ${s.name}` : sid)}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-group mb-2">
            <label class="form-label" style="font-size: 0.8rem;">Fecha inicial (Base):</label>
            <select class="form-control form-select" id="comp-meas-old">
              ${list.map((m, idx) => `
                <option value="${m.id}" ${idx === list.length - 1 ? 'selected' : ''}>
                  ${formatDate(m.measuredAt)} (${m.waterLevel} ${m.unit})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group mb-2">
            <label class="form-label" style="font-size: 0.8rem;">Fecha final (Reciente):</label>
            <select class="form-control form-select" id="comp-meas-new">
              ${list.map((m, idx) => `
                <option value="${m.id}" ${idx === 0 ? 'selected' : ''}>
                  ${formatDate(m.measuredAt)} (${m.waterLevel} ${m.unit})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        <div id="comp-result-outlet">
          ${renderCompResult(mOlder, mRecent)}
        </div>
      </div>
    `;

    const sourceSel = box.querySelector('#comp-source-select');
    const oldSel = box.querySelector('#comp-meas-old');
    const newSel = box.querySelector('#comp-meas-new');
    const resultOutlet = box.querySelector('#comp-result-outlet');

    const updateComp = () => {
      const curList = bySource[sourceSel.value] || [];
      const mA = curList.find(x => x.id === oldSel.value) || curList[curList.length - 1];
      const mB = curList.find(x => x.id === newSel.value) || curList[0];
      if (mA && mB && resultOutlet) {
        resultOutlet.innerHTML = renderCompResult(mA, mB);
      }
    };

    if (sourceSel) {
      sourceSel.addEventListener('change', () => {
        this.filters.sourceId = sourceSel.value;
        this._loadData();
      });
    }
    if (oldSel) oldSel.addEventListener('change', updateComp);
    if (newSel) newSel.addEventListener('change', updateComp);
  }

  _bindTableButtons(container) {
    container.querySelectorAll('.btn-sheet-source').forEach(btn => {
      btn.addEventListener('click', () => this.openTechnicalSheetModal(btn.dataset.sourceId));
    });

    container.querySelectorAll('.btn-edit-measurement').forEach(btn => {
      btn.addEventListener('click', () => this.openMeasurementFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-delete-measurement').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const confirmed = await modal.confirm({
          title: 'Eliminar Medición Hídrica',
          message: '¿Está seguro de que desea eliminar este registro de medición? Esta acción no se puede deshacer.',
          confirmText: 'Sí, Eliminar',
          isDanger: true
        });
        if (confirmed) {
          await WaterAvailabilityService.delete(id);
          notification.success('Medición eliminada', 'El registro fue eliminado de la base de datos local.');
          this._loadData();
        }
      });
    });
  }

  _bindEvents(container) {
    const newBtn = container.querySelector('#btn-new-water-measurement');
    const toolsBtn = container.querySelector('#btn-goto-water-tools');
    const searchInput = container.querySelector('#avail-filter-search');
    const sourceSelect = container.querySelector('#avail-filter-source');
    const siteSelect = container.querySelector('#avail-filter-site');
    const statusSelect = container.querySelector('#avail-filter-status');
    const startInput = container.querySelector('#avail-filter-start');
    const endInput = container.querySelector('#avail-filter-end');
    const clearBtn = container.querySelector('#btn-avail-clear-filters');

    if (newBtn) newBtn.addEventListener('click', () => this.openMeasurementFormModal(null, this.filters.sourceId !== 'all' ? this.filters.sourceId : null));
    if (toolsBtn) toolsBtn.addEventListener('click', () => this.router.navigate('water-tools'));

    const apply = () => {
      this.filters.search = searchInput ? searchInput.value : '';
      this.filters.sourceId = sourceSelect ? sourceSelect.value : 'all';
      this.filters.siteId = siteSelect ? siteSelect.value : 'all';
      this.filters.status = statusSelect ? statusSelect.value : 'all';
      this.filters.startDate = startInput ? startInput.value : '';
      this.filters.endDate = endInput ? endInput.value : '';
      this._loadData();
    };

    if (searchInput) searchInput.addEventListener('input', apply);
    if (sourceSelect) sourceSelect.addEventListener('change', apply);
    if (siteSelect) siteSelect.addEventListener('change', apply);
    if (statusSelect) statusSelect.addEventListener('change', apply);
    if (startInput) startInput.addEventListener('change', apply);
    if (endInput) endInput.addEventListener('change', apply);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.filters = { sourceId: 'all', siteId: 'all', status: 'all', startDate: '', endDate: '', search: '' };
        if (searchInput) searchInput.value = '';
        if (sourceSelect) sourceSelect.value = 'all';
        if (siteSelect) siteSelect.value = 'all';
        if (statusSelect) statusSelect.value = 'all';
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this._loadData();
      });
    }
  }

  /**
   * Abre el formulario modal para crear o editar una medición de disponibilidad hídrica (Secciones 4.1 y 4.2)
   */
  async openMeasurementFormModal(measurementId = null, preselectedSourceId = null) {
    if (this.sources.length === 0) {
      notification.warning('Sin fuentes hídricas', 'Primero debe registrar al menos una fuente de agua en el módulo «Fuentes de Agua».');
      return;
    }

    const isEdit = Boolean(measurementId);
    const current = isEdit ? await WaterAvailabilityService.getById(measurementId) : null;
    const initialSourceId = current ? current.sourceId : (preselectedSourceId || this.sources[0].id);
    const initialSource = this.sources.find(s => s.id === initialSourceId) || this.sources[0];

    let capturedPhotoDataUrl = current ? current.photoDataUrl : null;

    const contentHtml = `
      <form id="form-water-measurement">
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label required" for="wm-source">Fuente Hídrica</label>
            <select id="wm-source" class="form-control form-select" required>
              ${this.sources.map(s => `
                <option value="${escapeHtml(s.id)}" ${s.id === initialSource.id ? 'selected' : ''}>
                  ${escapeHtml(s.code)} — ${escapeHtml(s.name)} (${escapeHtml(WATER_SOURCE_TYPES[s.type] || s.type)})
                </option>
              `).join('')}
            </select>
            <div class="form-help" id="wm-source-criteria-help"></div>
          </div>

          <div class="form-group">
            <label class="form-label required" for="wm-method">Método de Medición</label>
            <select id="wm-method" class="form-control form-select" required>
              ${Object.entries(WATER_MEASUREMENT_METHODS).map(([k, v]) => `
                <option value="${k}" ${(current ? current.measurementMethod : 'manual_nivel') === k ? 'selected' : ''}>${v}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label required" for="wm-date">Fecha de Medición</label>
            <input type="date" id="wm-date" class="form-control"
                   value="${current ? current.measuredDate : todayDateInput()}" required />
          </div>
          <div class="form-group">
            <label class="form-label required" for="wm-time">Hora de Medición</label>
            <input type="time" id="wm-time" class="form-control"
                   value="${current ? current.measuredTime : nowTimeInput()}" required />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label required" for="wm-level">Nivel de Agua o Valor Medido</label>
            <input type="number" step="0.01" min="0" id="wm-level" class="form-control"
                   placeholder="Ej: 2.40" value="${current && current.waterLevel != null ? current.waterLevel : ''}" required />
            <div class="form-help">Valor real observado en regla, sonda o aforo</div>
          </div>

          <div class="form-group">
            <label class="form-label required" for="wm-unit">Unidad de Medición</label>
            <select id="wm-unit" class="form-control form-select" required>
              ${Object.entries(WATER_MEASUREMENT_UNITS).map(([k, v]) => `
                <option value="${k}" ${(current ? current.unit : 'm') === k ? 'selected' : ''}>${v}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="wm-total-depth">Profundidad Total de Referencia (m, opcional)</label>
            <input type="number" step="0.01" min="0.1" id="wm-total-depth" class="form-control"
                   placeholder="Ej: 4.50"
                   value="${current && current.totalDepthMeters != null ? current.totalDepthMeters : (initialSource.referenceDepthMeters ?? '')}" />
            <div class="form-help">Permite calcular la relación porcentual de columna de agua</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="wm-known-cap">Capacidad Total Conocida (Litros, opcional)</label>
            <input type="number" step="1" min="0" id="wm-known-cap" class="form-control"
                   placeholder="Ej: 10000"
                   value="${current && current.knownCapacityLiters != null ? current.knownCapacityLiters : (initialSource.knownCapacityLiters ?? '')}" />
            <div class="form-help">Capacidad nominal del tanque, jagüey o reservorio</div>
          </div>
        </div>

        <!-- Diferenciación clara: Volumen Observado vs Volumen Estimado -->
        <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: var(--spacing-3); border-radius: var(--radius-md); margin-bottom: var(--spacing-3);">
          <strong style="font-size: 0.85rem; display: block; margin-bottom: 8px;">
            Diferenciación de Volumen (Observado vs Estimado por Cálculo)
          </strong>
          <div class="form-grid-2">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="wm-obs-vol">Volumen Observado Directo (Litros, opcional)</label>
              <input type="number" step="0.1" min="0" id="wm-obs-vol" class="form-control"
                     placeholder="Solo si se midió volumétricamente"
                     value="${current && current.observedVolumeLiters != null ? current.observedVolumeLiters : ''}" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="wm-est-vol">Volumen Estimado Disponible (Litros, opcional)</label>
              <input type="number" step="0.1" min="0" id="wm-est-vol" class="form-control"
                     placeholder="Calculado a partir de capacidad/nivel o manual"
                     value="${current && current.estimatedVolumeLiters != null ? current.estimatedVolumeLiters : ''}" />
            </div>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="wm-cap-pct">Porcentaje de Capacidad Disponible (%, opcional)</label>
            <input type="number" step="0.1" min="0" max="100" id="wm-cap-pct" class="form-control"
                   placeholder="Se calcula automáticamente si hay capacidad/profundidad"
                   value="${current && current.availableCapacityPct != null ? current.availableCapacityPct : ''}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="wm-status">Clasificación del Estado Hídrico</label>
            <select id="wm-status" class="form-control form-select">
              <option value="auto">Automática según criterios técnicos del tipo de fuente (Recomendado)</option>
              ${Object.entries(WATER_AVAILABILITY_STATUSES).map(([k, v]) => `
                <option value="${k}" ${isEdit && current && current.status === k ? 'selected' : ''}>${v}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="wm-responsible">Nombre del Responsable del Registro</label>
            <input type="text" id="wm-responsible" class="form-control"
                   placeholder="Ej: Comité de Agua / Monitor local"
                   value="${escapeHtml(current ? current.responsible : (initialSource.responsible || ''))}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="wm-photo">Fotografía de Evidencia en Campo (opcional)</label>
            <input type="file" id="wm-photo" class="form-control" accept="image/*" />
            <div id="wm-photo-preview" style="margin-top: 6px;">
              ${capturedPhotoDataUrl ? `<img src="${capturedPhotoDataUrl}" alt="Evidencia" style="max-height: 70px; border-radius: 6px; border: 1px solid var(--color-neutral-300);" />` : ''}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="wm-notes">Observaciones de Campo</label>
          <textarea id="wm-notes" class="form-control" rows="2"
                    placeholder="Condición física, turbidez, bombeo, lluvias recientes o detalles del aforo...">${escapeHtml(current ? current.notes : '')}</textarea>
        </div>
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Medición de Disponibilidad Hídrica' : 'Registrar Medición de Disponibilidad Hídrica',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="btn-wm-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-wm-save">${isEdit ? 'Actualizar Medición' : 'Guardar Medición'}</button>
      `,
      onMount: (dialog) => {
        const sourceSelect = dialog.querySelector('#wm-source');
        const depthInput = dialog.querySelector('#wm-total-depth');
        const capInput = dialog.querySelector('#wm-known-cap');
        const respInput = dialog.querySelector('#wm-responsible');
        const criteriaHelp = dialog.querySelector('#wm-source-criteria-help');
        const photoInput = dialog.querySelector('#wm-photo');
        const photoPreview = dialog.querySelector('#wm-photo-preview');

        const updateSourceDefaults = (syncFields = false) => {
          const src = this.sources.find(s => s.id === sourceSelect.value);
          if (!src) return;
          const cfg = getInfrastructureConfig(src.type);
          if (criteriaHelp) {
            criteriaHelp.textContent = cfg.technicalCriteria;
          }
          if (syncFields && !isEdit) {
            if (depthInput) depthInput.value = src.referenceDepthMeters ?? '';
            if (capInput) capInput.value = src.knownCapacityLiters ?? '';
            if (respInput && !respInput.value) respInput.value = src.responsible || '';
          }
        };

        updateSourceDefaults(false);
        if (sourceSelect) {
          sourceSelect.addEventListener('change', () => updateSourceDefaults(true));
        }

        if (photoInput) {
          photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              capturedPhotoDataUrl = ev.target.result;
              if (photoPreview) {
                photoPreview.innerHTML = `<img src="${capturedPhotoDataUrl}" alt="Vista previa" style="max-height: 75px; border-radius: 6px; border: 1px solid var(--color-neutral-300);" />`;
              }
            };
            reader.readAsDataURL(file);
          });
        }

        dialog.querySelector('#btn-wm-cancel').addEventListener('click', () => modal.close());

        const saveBtn = dialog.querySelector('#btn-wm-save');
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const payload = {
              sourceId: sourceSelect.value,
              measurementMethod: dialog.querySelector('#wm-method').value,
              measuredDate: dialog.querySelector('#wm-date').value,
              measuredTime: dialog.querySelector('#wm-time').value,
              waterLevel: dialog.querySelector('#wm-level').value,
              unit: dialog.querySelector('#wm-unit').value,
              totalDepthMeters: depthInput.value || null,
              knownCapacityLiters: capInput.value || null,
              observedVolumeLiters: dialog.querySelector('#wm-obs-vol').value || null,
              estimatedVolumeLiters: dialog.querySelector('#wm-est-vol').value || null,
              availableCapacityPct: dialog.querySelector('#wm-cap-pct').value || null,
              status: dialog.querySelector('#wm-status').value,
              responsible: respInput.value,
              photoDataUrl: capturedPhotoDataUrl,
              notes: dialog.querySelector('#wm-notes').value
            };

            if (isEdit) {
              await WaterAvailabilityService.update(measurementId, payload);
              notification.success('Medición actualizada', 'Los datos de disponibilidad hídrica fueron actualizados.');
            } else {
              await WaterAvailabilityService.create(payload);
              notification.success('Medición registrada', 'La medición periódica se guardó correctamente.');
            }

            modal.close();
            this.sources = await WaterSourcesService.getAll();
            await this._loadData();
          } catch (err) {
            notification.error('Error de validación', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Medición' : 'Guardar Medición';
          }
        });
      }
    });
  }

  /**
   * 4.5 Ficha Técnica Ampliada de Disponibilidad por Fuente Hídrica
   */
  async openTechnicalSheetModal(sourceId) {
    const sheet = await WaterAvailabilityService.getSourceTechnicalSheet(sourceId);
    if (!sheet) {
      notification.warning('Fuente no encontrada', 'No se pudo cargar la ficha técnica de la fuente solicitada.');
      return;
    }

    const { source, typeLabel, site, infraConfig, latestMeasurement, measurements, classification, trendInfo, relatedObservations, photos, chartData } = sheet;

    const contentHtml = `
      <div class="water-technical-sheet">
        <!-- Cabecera de Estado y Criterio Técnico -->
        <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); margin-bottom: var(--spacing-4);">
          <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
            <div>
              <span class="badge badge-info">${escapeHtml(typeLabel)}</span>
              <strong style="margin-left: 8px; font-size: 1.05rem;">${escapeHtml(source.code)} — ${escapeHtml(source.name)}</strong>
            </div>
            <div>
              ${renderStatusBadge(classification.status)}
            </div>
          </div>
          <p style="font-size: 0.85rem; margin: 0 0 4px;"><strong>Diagnóstico técnico:</strong> ${escapeHtml(classification.reason)}</p>
          <p class="text-muted" style="font-size: 0.78rem; margin: 0;">${escapeHtml(infraConfig.technicalCriteria)}</p>
        </div>

        <!-- Información General y Capacidad -->
        <div class="form-grid-2 mb-4">
          <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
            <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--color-green-700);">Información General y Ubicación</h4>
            <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Comunidad / Sitio:</strong> ${site ? `${escapeHtml(site.name)} (${escapeHtml(site.municipality)})` : 'Sin comunidad asignada'}</p>
            <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Coordenadas (copia habilitada):</strong> <span data-allow-copy="true" class="allow-copy">${formatCoordinates(source.latitude, source.longitude)}</span></p>
            <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Uso Principal:</strong> ${escapeHtml(WATER_SOURCE_USES[source.mainUse] || source.mainUse)}</p>
            <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Capacidad Conocida:</strong> ${source.knownCapacityLiters != null && Number.isFinite(Number(source.knownCapacityLiters)) ? `${Number(source.knownCapacityLiters).toLocaleString('es-CO')} L (${(Number(source.knownCapacityLiters) / 1000).toFixed(2)} m³)` : 'No registrada'}</p>
            <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Profundidad de Referencia:</strong> ${source.referenceDepthMeters != null && Number.isFinite(Number(source.referenceDepthMeters)) ? `${source.referenceDepthMeters} m` : 'No registrada'}</p>
          </div>

          <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
            <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--color-blue-700);">Última Medición y Tendencia</h4>
            ${latestMeasurement ? `
              <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Fecha:</strong> ${formatDateTime(latestMeasurement.measuredAt)}</p>
              <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Nivel / Valor:</strong> <strong>${latestMeasurement.waterLevel} ${escapeHtml(latestMeasurement.unit)}</strong> (${escapeHtml(WATER_MEASUREMENT_METHODS[latestMeasurement.measurementMethod] || latestMeasurement.measurementMethod)})</p>
              <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Porcentaje Disponible:</strong> ${latestMeasurement.availableCapacityPct != null && Number.isFinite(Number(latestMeasurement.availableCapacityPct)) ? `<strong>${latestMeasurement.availableCapacityPct}%</strong>` : '—'}</p>
              <p style="font-size: 0.85rem; margin: 4px 0;">
                <strong>Volumen:</strong>
                ${latestMeasurement.observedVolumeLiters != null && Number.isFinite(Number(latestMeasurement.observedVolumeLiters))
                  ? `<strong>${Number(latestMeasurement.observedVolumeLiters).toLocaleString('es-CO')} L (${(Number(latestMeasurement.observedVolumeLiters) / 1000).toFixed(2)} m³)</strong> <span class="badge badge-success">Observado</span>`
                  : latestMeasurement.estimatedVolumeLiters != null && Number.isFinite(Number(latestMeasurement.estimatedVolumeLiters))
                    ? `<strong>${Number(latestMeasurement.estimatedVolumeLiters).toLocaleString('es-CO')} L (${(Number(latestMeasurement.estimatedVolumeLiters) / 1000).toFixed(2)} m³)</strong> <span class="badge badge-info">Estimado por cálculo</span>`
                    : '—'}
              </p>
              <p style="font-size: 0.85rem; margin: 4px 0;"><strong>Tendencia histórica:</strong> ${escapeHtml(trendInfo.trendLabel)}</p>
            ` : `
              <p class="text-muted" style="font-size: 0.85rem;">No se han registrado mediciones hidrométricas para esta fuente.</p>
            `}
          </div>
        </div>

        <!-- Evolución Histórica (Gráfica en Ficha) -->
        <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3); margin-bottom: var(--spacing-4);">
          <h4 style="font-size: 0.9rem; margin-bottom: 8px;">Evolución Histórica (${measurements.length} mediciones)</h4>
          ${measurements.length > 0 ? `
            <div style="height: 200px;">
              <canvas id="sheet-history-chart"></canvas>
            </div>
          ` : '<p class="text-muted" style="font-size: 0.85rem; margin: 0;">Sin serie histórica para graficar.</p>'}
        </div>

        <!-- Fotografías y Observaciones Relacionadas -->
        <div class="form-grid-2">
          <div>
            <h4 style="font-size: 0.9rem; margin-bottom: 8px;">Registro Fotográfico (${photos.length})</h4>
            ${photos.length > 0 ? `
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${photos.map(ph => `
                  <div style="border: 1px solid var(--color-neutral-200); border-radius: 6px; padding: 6px; max-width: 145px; font-size: 0.75rem;">
                    <img src="${ph.url}" alt="${escapeHtml(ph.caption)}" style="width: 100%; height: 85px; object-fit: cover; border-radius: 4px; margin-bottom: 4px;" />
                    <div style="font-weight: 600;">${escapeHtml(ph.caption)}</div>
                    <div class="text-muted">${ph.date}</div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-muted" style="font-size: 0.82rem;">No hay fotografías asociadas a esta fuente.</p>'}
          </div>

          <div>
            <h4 style="font-size: 0.9rem; margin-bottom: 8px;">Observaciones Relacionadas (${relatedObservations.length})</h4>
            ${relatedObservations.length > 0 ? `
              <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${relatedObservations.map(obs => `
                  <div style="background: var(--color-neutral-50); padding: 8px; border-radius: 6px; font-size: 0.8rem;">
                    <div><strong>${formatDate(obs.observedAt)}:</strong> ${escapeHtml(obs.description)}</div>
                    ${obs.observedStatus ? `<div class="text-muted">Condición: ${escapeHtml(obs.observedStatus)}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `<p class="text-muted" style="font-size: 0.82rem;">${escapeHtml(source.notes || 'Sin observaciones adicionales registradas.')}</p>`}
          </div>
        </div>
      </div>
    `;

    modal.open({
      title: `Ficha Técnica de Disponibilidad: ${escapeHtml(source.name)}`,
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="btn-sheet-close">Cerrar</button>
        <button class="btn btn-outline" id="btn-sheet-climate">Ver Clima en Punto</button>
        <button class="btn btn-primary" id="btn-sheet-new-meas">Registrar Medición</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-sheet-close').addEventListener('click', () => modal.close());
        dialog.querySelector('#btn-sheet-climate').addEventListener('click', () => {
          modal.close();
          this.router.navigate('climate', { waterSourceId: source.id });
        });
        dialog.querySelector('#btn-sheet-new-meas').addEventListener('click', () => {
          modal.close();
          this.openMeasurementFormModal(null, source.id);
        });

        const canvas = dialog.querySelector('#sheet-history-chart');
        if (canvas && typeof window !== 'undefined' && window.Chart && chartData.labels.length > 0) {
          if (this.sheetChart) this.sheetChart.destroy();
          this.sheetChart = new window.Chart(canvas, {
            type: 'line',
            data: {
              labels: chartData.labels,
              datasets: [
                {
                  label: `Nivel (${chartData.unit})`,
                  data: chartData.waterLevels,
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
        }
      }
    });
  }

  destroy() {
    if (this.evolutionChart) {
      this.evolutionChart.destroy();
      this.evolutionChart = null;
    }
    if (this.sheetChart) {
      this.sheetChart.destroy();
      this.sheetChart = null;
    }
  }
}

