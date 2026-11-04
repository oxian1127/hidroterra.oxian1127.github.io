/**
 * Vista: Módulo de Reportes Territoriales y Exportación (Reports View)
 */

import { ReportsService } from '../../application/reports.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { WaterSourcesService } from '../../application/water-sources.service.js';
import { SitesService } from '../../application/sites.service.js';
import { JsonExportService } from '../../infrastructure/files/json-export.js';
import { renderStatusBadge } from '../components/status-badge.js';
import { formatDate, formatDateTime, getMonthName } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { notification } from '../components/notification.js';

export class ReportsView {
  constructor(router) {
    this.router = router;
    this.activeReportType = 'water_availability_status';
    this.pluviometers = [];
    this.sources = [];
    this.sites = [];
    this.municipalities = [];
    this.currentFilters = {
      pluviometerId: '',
      waterSourceId: 'all',
      siteId: 'all',
      municipality: 'all',
      availabilityStatus: 'all',
      startDate: '',
      endDate: '',
      accumulatedMode: 'monthly'
    };
    this.lastReportResult = null;
  }

  async render(container) {
    const [pluvs, sources, sites] = await Promise.all([
      PluviometersService.getAll(),
      WaterSourcesService.getAll(),
      SitesService.getAll()
    ]);

    this.pluviometers = pluvs;
    this.sources = sources;
    this.sites = sites;
    this.municipalities = [...new Set(sites.map(s => s.municipality).filter(Boolean))].sort();

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Reportes, Disponibilidad e Indicadores Territoriales</h2>
          <p class="text-muted">Generación de informes tabulares de disponibilidad hídrica, mediciones, lluvias y balances por comunidad o municipio.</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline" id="btn-export-report-csv">
            <span><i class="fa-solid fa-file-csv"></i> Descargar CSV</span>
          </button>
          <button class="btn btn-outline" id="btn-export-report-json">
            <span><i class="fa-solid fa-file-code"></i> Descargar JSON</span>
          </button>
          <button class="btn btn-primary" id="btn-print-report">
            <span><i class="fa-solid fa-print"></i> Imprimir Reporte</span>
          </button>
        </div>
      </div>

      <!-- Selector de Tipo de Reporte -->
      <div class="card mb-4">
        <div class="card-body" style="padding: var(--spacing-4);">
          <div class="form-grid-2">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="report-type-select"><strong>Seleccione el Tipo de Reporte:</strong></label>
              <select class="form-control" id="report-type-select">
                <optgroup label="Disponibilidad y Gestión Hídrica">
                  <option value="water_availability_status" ${this.activeReportType === 'water_availability_status' ? 'selected' : ''}>1. Estado de disponibilidad y capacidad de fuentes hídricas</option>
                  <option value="water_measurements_history" ${this.activeReportType === 'water_measurements_history' ? 'selected' : ''}>2. Historial de mediciones de nivel y volumen hídrico</option>
                  <option value="territorial_water_balance" ${this.activeReportType === 'territorial_water_balance' ? 'selected' : ''}>3. Balance hídrico simplificado e indicadores por comunidad y municipio</option>
                </optgroup>
                <optgroup label="Precipitaciones y Pluviómetros">
                  <option value="rainfall_history" ${this.activeReportType === 'rainfall_history' ? 'selected' : ''}>4. Historial de lluvias por pluviómetro</option>
                  <option value="accumulated" ${this.activeReportType === 'accumulated' ? 'selected' : ''}>5. Precipitación acumulada (Día, Mes o Periodo)</option>
                  <option value="comparison" ${this.activeReportType === 'comparison' ? 'selected' : ''}>6. Comparación entre pluviómetros de la red</option>
                </optgroup>
                <optgroup label="Inventarios y Observaciones de Campo">
                  <option value="sources_inventory" ${this.activeReportType === 'sources_inventory' ? 'selected' : ''}>7. Inventario general de fuentes e infraestructura hídrica</option>
                  <option value="pluviometers_inventory" ${this.activeReportType === 'pluviometers_inventory' ? 'selected' : ''}>8. Inventario de pluviómetros y coordenadas</option>
                  <option value="observations" ${this.activeReportType === 'observations' ? 'selected' : ''}>9. Observaciones de campo por comunidad</option>
                </optgroup>
              </select>
            </div>

            <!-- Filtros Dinámicos según el Reporte -->
            <div id="dynamic-report-filters" class="d-flex align-center gap-2" style="flex-wrap: wrap;">
              <!-- Los filtros contextuales se inyectan aquí -->
            </div>
          </div>
        </div>
      </div>

      <!-- Encabezado exclusivo de impresión -->
      <div class="print-header-notice">
        <h1>HIDROTERRA — Plataforma de Monitoreo Hídrico Rural y Gestión Territorial</h1>
        <p>Montes de María, Colombia | Reporte emitido el: ${formatDateTime(new Date().toISOString())}</p>
        <h2 id="print-report-title">Reporte Territorial</h2>
      </div>

      <!-- Contenedor del Reporte Generado -->
      <div class="card">
        <div class="card-body" id="report-output-container" style="padding: 0;">
          <div style="padding: var(--spacing-6); text-align: center;" class="text-muted">
            Cargando informe...
          </div>
        </div>
      </div>
    `;

    this._setupFilters(container);
    this._bindEvents(container);
    await this.generateReport();
  }

  _setupFilters(container) {
    const filtersBox = container.querySelector('#dynamic-report-filters');
    if (!filtersBox) return;

    const munOptions = `
      <option value="all">Todos los municipios</option>
      ${this.municipalities.map(m => `<option value="${escapeHtml(m)}" ${this.currentFilters.municipality === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
    `;

    const siteOptions = `
      <option value="all">Todas las comunidades</option>
      ${this.sites.map(s => `<option value="${s.id}" ${this.currentFilters.siteId === s.id ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.municipality)})</option>`).join('')}
    `;

    if (this.activeReportType === 'water_availability_status') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-mun" style="min-width: 150px;">${munOptions}</select>
        <select class="form-control" id="rep-filter-site" style="min-width: 170px;">${siteOptions}</select>
        <select class="form-control" id="rep-filter-avail" style="min-width: 150px;">
          <option value="all" ${this.currentFilters.availabilityStatus === 'all' ? 'selected' : ''}>Cualquier disponibilidad</option>
          <option value="alta" ${this.currentFilters.availabilityStatus === 'alta' ? 'selected' : ''}>Disponibilidad Alta</option>
          <option value="moderada" ${this.currentFilters.availabilityStatus === 'moderada' ? 'selected' : ''}>Disponibilidad Moderada</option>
          <option value="baja" ${this.currentFilters.availabilityStatus === 'baja' ? 'selected' : ''}>Disponibilidad Baja</option>
          <option value="critica" ${this.currentFilters.availabilityStatus === 'critica' ? 'selected' : ''}>Disponibilidad Crítica</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'water_measurements_history') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-source" style="min-width: 170px;">
          <option value="all">Todas las fuentes</option>
          ${this.sources.map(s => `<option value="${s.id}" ${this.currentFilters.waterSourceId === s.id ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <select class="form-control" id="rep-filter-mun" style="min-width: 145px;">${munOptions}</select>
        <select class="form-control" id="rep-filter-site" style="min-width: 155px;">${siteOptions}</select>
        <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" title="Desde" />
        <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" title="Hasta" />
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'territorial_water_balance') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-mun" style="min-width: 150px;">${munOptions}</select>
        <select class="form-control" id="rep-filter-site" style="min-width: 170px;">${siteOptions}</select>
        <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" title="Lluvias desde" />
        <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" title="Lluvias hasta" />
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'rainfall_history') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-pluv" style="flex: 1; min-width: 165px;">
          <option value="">Todos los pluviómetros</option>
          ${this.pluviometers.map(p => `
            <option value="${p.id}" ${this.currentFilters.pluviometerId === p.id ? 'selected' : ''}>${escapeHtml(p.code)} — ${escapeHtml(p.name)}</option>
          `).join('')}
        </select>
        <select class="form-control" id="rep-filter-mun" style="min-width: 145px;">${munOptions}</select>
        <select class="form-control" id="rep-filter-site" style="min-width: 155px;">${siteOptions}</select>
        <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" title="Desde" />
        <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" title="Hasta" />
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'accumulated') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-acc-mode" style="width: auto;">
          <option value="monthly" ${this.currentFilters.accumulatedMode === 'monthly' ? 'selected' : ''}>Resumen Mensual</option>
          <option value="daily" ${this.currentFilters.accumulatedMode === 'daily' ? 'selected' : ''}>Desglose Diario</option>
        </select>
        <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" title="Desde" />
        <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" title="Hasta" />
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'comparison') {
      filtersBox.innerHTML = `
        <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" placeholder="Desde" />
        <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" placeholder="Hasta" />
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Comparar</button>
      `;
    } else if (this.activeReportType === 'sources_inventory') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-mun" style="min-width: 150px;">${munOptions}</select>
        <select class="form-control" id="rep-filter-site" style="min-width: 170px;">${siteOptions}</select>
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else if (this.activeReportType === 'observations') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-site" style="flex: 1; min-width: 200px;">${siteOptions}</select>
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else {
      filtersBox.innerHTML = '<span class="text-muted" style="font-size: var(--font-size-xs);">Inventario completo de toda la base territorial registrada.</span>';
    }

    const applyBtn = filtersBox.querySelector('#btn-apply-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const pluvSelect = filtersBox.querySelector('#rep-filter-pluv');
        const sourceSelect = filtersBox.querySelector('#rep-filter-source');
        const munSelect = filtersBox.querySelector('#rep-filter-mun');
        const siteSelect = filtersBox.querySelector('#rep-filter-site');
        const availSelect = filtersBox.querySelector('#rep-filter-avail');
        const startInput = filtersBox.querySelector('#rep-filter-start');
        const endInput = filtersBox.querySelector('#rep-filter-end');
        const accSelect = filtersBox.querySelector('#rep-filter-acc-mode');

        if (pluvSelect) this.currentFilters.pluviometerId = pluvSelect.value;
        if (sourceSelect) this.currentFilters.waterSourceId = sourceSelect.value;
        if (munSelect) this.currentFilters.municipality = munSelect.value;
        if (siteSelect) this.currentFilters.siteId = siteSelect.value;
        if (availSelect) this.currentFilters.availabilityStatus = availSelect.value;
        if (startInput) this.currentFilters.startDate = startInput.value;
        if (endInput) this.currentFilters.endDate = endInput.value;
        if (accSelect) this.currentFilters.accumulatedMode = accSelect.value;

        this.generateReport();
      });
    }
  }

  async generateReport() {
    const container = document.getElementById('report-output-container');
    const printTitle = document.getElementById('print-report-title');
    if (!container) return;

    const pluvMap = new Map(this.pluviometers.map(p => [p.id, p]));

    if (this.activeReportType === 'water_availability_status') {
      if (printTitle) printTitle.textContent = 'Reporte: Estado de Disponibilidad y Capacidad de Fuentes Hídricas';
      const data = await ReportsService.getWaterAvailabilityStatusReport({
        municipality: this.currentFilters.municipality,
        siteId: this.currentFilters.siteId,
        availabilityStatus: this.currentFilters.availabilityStatus
      });
      this.lastReportResult = data;

      container.innerHTML = `
        <div style="padding: var(--spacing-4) var(--spacing-6); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
          <strong>Fuentes Evaluadas:</strong> ${data.summary.totalSources} &nbsp;|&nbsp;
          <strong>Alta/Moderada:</strong> ${data.summary.alta + data.summary.moderada} &nbsp;|&nbsp;
          <strong>Baja/Crítica:</strong> <span class="text-danger fw-bold">${data.summary.baja + data.summary.critica}</span> &nbsp;|&nbsp;
          <strong>Volumen Estimado:</strong> ${data.summary.totalAvailableVolumeLiters.toLocaleString('es-CO')} L de ${data.summary.totalRegisteredCapacityLiters.toLocaleString('es-CO')} L registrados
          ${data.summary.overallPercentageAvailable !== null ? `(${data.summary.overallPercentageAvailable}%)` : ''}
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fuente Hídrica</th>
                <th>Tipo</th>
                <th>Comunidad / Municipio</th>
                <th>Disponibilidad</th>
                <th>Última Medición</th>
                <th>Volumen Estimado / Capacidad</th>
                <th>Tendencia</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.length > 0 ? data.items.map(i => `
                <tr>
                  <td><strong>${escapeHtml(i.code)}</strong></td>
                  <td>${escapeHtml(i.name)}</td>
                  <td>${escapeHtml(i.typeLabel)}</td>
                  <td>${escapeHtml(i.siteName)} <span class="text-muted">(${escapeHtml(i.municipality)})</span></td>
                  <td>${renderStatusBadge(i.availabilityStatus, i.availabilityLabel)}</td>
                  <td>
                    ${i.latestMeasurement
                      ? `<strong>${i.latestMeasurement.waterLevel} ${escapeHtml(i.latestMeasurement.unit)}</strong><br><small class="text-muted">${formatDate(i.latestMeasurement.measuredDate)}</small>`
                      : '<span class="text-muted">Sin mediciones</span>'}
                  </td>
                  <td>
                    ${i.estimatedVolumeLiters != null && Number.isFinite(Number(i.estimatedVolumeLiters)) ? `<strong>${Number(i.estimatedVolumeLiters).toLocaleString('es-CO')} L</strong>` : '—'}
                    ${i.knownCapacityLiters ? `<br><small class="text-muted">de ${Number(i.knownCapacityLiters).toLocaleString('es-CO')} L (${i.percentageAvailable ?? '—'}%)</small>` : ''}
                  </td>
                  <td>${escapeHtml(i.trendLabel || '—')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" style="text-align: center; padding: 24px;">No hay fuentes hídricas que coincidan con los filtros seleccionados.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'water_measurements_history') {
      if (printTitle) printTitle.textContent = 'Reporte: Historial Cronológico de Mediciones Hídricas';
      const data = await ReportsService.getWaterMeasurementsHistoryReport({
        waterSourceId: this.currentFilters.waterSourceId,
        municipality: this.currentFilters.municipality,
        siteId: this.currentFilters.siteId,
        startDate: this.currentFilters.startDate,
        endDate: this.currentFilters.endDate
      });
      this.lastReportResult = data;

      container.innerHTML = `
        <div style="padding: var(--spacing-4) var(--spacing-6); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
          <strong>Total Mediciones Listadas:</strong> ${data.totalCount}
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Fuente Hídrica</th>
                <th>Comunidad / Municipio</th>
                <th>Nivel / Caudal</th>
                <th>Volumen Estimado</th>
                <th>% Capacidad</th>
                <th>Disponibilidad</th>
                <th>Método</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${data.records.length > 0 ? data.records.map(r => `
                <tr>
                  <td>${escapeHtml(r.measuredDate)} ${escapeHtml(r.measuredTime || '')}</td>
                  <td><strong>${escapeHtml(r.sourceCode)}</strong> — ${escapeHtml(r.sourceName)}</td>
                  <td>${escapeHtml(r.siteName)} <span class="text-muted">(${escapeHtml(r.municipality)})</span></td>
                  <td><strong>${r.waterLevel} ${escapeHtml(r.unit)}</strong></td>
                  <td>${r.estimatedVolumeLiters != null && Number.isFinite(Number(r.estimatedVolumeLiters)) ? `${Number(r.estimatedVolumeLiters).toLocaleString('es-CO')} L` : '—'}</td>
                  <td>${r.percentageAvailable != null ? `${r.percentageAvailable}%` : '—'}</td>
                  <td>${renderStatusBadge(r.availabilityStatus, r.availabilityLabel)}</td>
                  <td><small>${escapeHtml(r.methodLabel)}</small></td>
                  <td>${escapeHtml(r.responsible || '—')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="9" style="text-align: center; padding: 24px;">No se encontraron mediciones hídricas en el periodo o filtros seleccionados.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'territorial_water_balance') {
      if (printTitle) printTitle.textContent = 'Reporte: Balance Hídrico Simplificado e Indicadores por Comunidad y Municipio';
      const data = await ReportsService.getTerritorialSummaryReport({
        municipality: this.currentFilters.municipality,
        siteId: this.currentFilters.siteId,
        startDate: this.currentFilters.startDate,
        endDate: this.currentFilters.endDate
      });
      this.lastReportResult = data;

      container.innerHTML = `
        <div style="padding: var(--spacing-4) var(--spacing-6); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
          <strong>Consolidado por Municipio (${data.municipalities.length}):</strong>
          <div class="d-flex gap-3 mt-2" style="flex-wrap: wrap;">
            ${data.municipalities.map(m => `
              <span class="badge bg-light text-dark border p-2">
                <strong>${escapeHtml(m.municipality)}:</strong> ${m.communitiesCount} com. | ${m.sourcesCount} fuentes (${m.criticalOrLowCount} críticas/bajas) | Lluvia: ${m.rainTotalMm} mm | Vol. Disp: ${m.estimatedAvailableLiters.toLocaleString('es-CO')} L
              </span>
            `).join('')}
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Comunidad / Sitio</th>
                <th>Municipio</th>
                <th>Fuentes Hídricas</th>
                <th>Fuentes en Alerta (Baja/Crítica)</th>
                <th>Parcelas</th>
                <th>Lluvia Acumulada</th>
                <th>Capacidad Registrada</th>
                <th>Volumen Estimado Disponible</th>
                <th>% Ocupación</th>
              </tr>
            </thead>
            <tbody>
              ${data.communities.length > 0 ? data.communities.map(c => `
                <tr>
                  <td><strong>${escapeHtml(c.siteName)}</strong></td>
                  <td>${escapeHtml(c.municipality)}</td>
                  <td>${c.sourcesCount}</td>
                  <td>${c.criticalOrLowCount > 0 ? `<span class="text-danger fw-bold">${c.criticalOrLowCount}</span>` : '0'}</td>
                  <td>${c.parcelsCount}</td>
                  <td><strong>${c.rainTotalMm} mm</strong></td>
                  <td>${c.registeredCapacityLiters > 0 ? `${c.registeredCapacityLiters.toLocaleString('es-CO')} L` : '—'}</td>
                  <td><strong>${c.estimatedAvailableLiters > 0 ? `${c.estimatedAvailableLiters.toLocaleString('es-CO')} L` : '—'}</strong></td>
                  <td>${c.fillPct !== null ? `<strong>${c.fillPct}%</strong>` : '—'}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="9" style="text-align: center; padding: 24px;">No hay comunidades registradas para los filtros seleccionados.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'rainfall_history') {
      if (printTitle) printTitle.textContent = 'Reporte: Historial Cronológico de Lluvias por Pluviómetro';
      const data = await ReportsService.getRainfallHistory(
        this.currentFilters.pluviometerId,
        this.currentFilters.startDate,
        this.currentFilters.endDate,
        this.currentFilters.municipality,
        this.currentFilters.siteId
      );
      this.lastReportResult = data;

      container.innerHTML = `
        <div style="padding: var(--spacing-4) var(--spacing-6); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
          <strong>Total Lluvia Acumulada:</strong> ${data.totals.totalMm} mm &nbsp;|&nbsp;
          <strong>Días con Registros:</strong> ${data.totals.measuredDaysCount} &nbsp;|&nbsp;
          <strong>Lectura Máxima:</strong> ${data.totals.maxDailyMm} mm &nbsp;|&nbsp;
          <strong>Registros:</strong> ${data.records.length}
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Precipitación</th>
                <th>Pluviómetro</th>
                <th>Tipo Medición</th>
                <th>Responsable</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${data.records.length > 0 ? data.records.map(r => {
                const p = pluvMap.get(r.pluviometerId);
                return `
                  <tr>
                    <td>${formatDateTime(r.measuredAt)}</td>
                    <td><strong>${r.precipitationMm} mm</strong></td>
                    <td>${escapeHtml(p ? `${p.code} — ${p.name}` : r.pluviometerId)}</td>
                    <td>${escapeHtml(r.measurementType)}</td>
                    <td>${escapeHtml(r.responsible || '—')}</td>
                    <td>${escapeHtml(r.notes || '—')}</td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="6" style="text-align: center; padding: 24px;">No se encontraron registros de lluvia en el periodo consultado.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'accumulated') {
      if (printTitle) printTitle.textContent = 'Reporte: Precipitación Acumulada Territorial';
      const data = await ReportsService.getAccumulatedReport(
        this.currentFilters.accumulatedMode,
        this.currentFilters.startDate,
        this.currentFilters.endDate
      );
      this.lastReportResult = data;

      const isMonthly = this.currentFilters.accumulatedMode === 'monthly';
      const keys = isMonthly ? Object.keys(data.monthly).sort() : Object.keys(data.daily).sort();

      container.innerHTML = `
        <div style="padding: var(--spacing-4) var(--spacing-6); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
          <strong>Total General Acumulado:</strong> ${data.totals.totalMm} mm &nbsp;|&nbsp;
          <strong>Total Registros Analizados:</strong> ${data.recordsCount}
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Periodo (${isMonthly ? 'Mes' : 'Día'})</th>
                <th>Precipitación Acumulada</th>
                <th>Registros</th>
                ${isMonthly ? '<th>Días con Lluvia</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${keys.length > 0 ? keys.map(k => {
                const item = isMonthly ? data.monthly[k] : data.daily[k];
                return `
                  <tr>
                    <td><strong>${isMonthly ? getMonthName(k) : k}</strong></td>
                    <td><strong>${item.totalMm} mm</strong></td>
                    <td>${item.count}</td>
                    ${isMonthly ? `<td>${item.daysWithRainCount} de ${item.totalDaysMeasured} días medidos</td>` : ''}
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="4" style="text-align: center; padding: 24px;">Sin mediciones para calcular acumulados.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'comparison') {
      if (printTitle) printTitle.textContent = 'Reporte: Comparativo de Lluvias entre Pluviómetros';
      const data = await ReportsService.getPluviometersComparison(
        this.currentFilters.startDate,
        this.currentFilters.endDate
      );
      this.lastReportResult = data;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Pluviómetro</th>
                <th>Total Acumulado</th>
                <th>Mediciones</th>
                <th>Lectura Máxima (24h)</th>
                <th>Última Medición</th>
              </tr>
            </thead>
            <tbody>
              ${data.comparison.length > 0 ? data.comparison.map(c => `
                <tr>
                  <td><strong>${escapeHtml(c.code)}</strong></td>
                  <td>${escapeHtml(c.name)}</td>
                  <td><strong>${c.totalMm} mm</strong></td>
                  <td>${c.recordCount}</td>
                  <td>${c.maxReading} mm</td>
                  <td>${c.lastReadingDate ? formatDateTime(c.lastReadingDate) : '<span class="text-muted">Sin datos</span>'}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="6" style="text-align: center; padding: 24px;">No hay pluviómetros registrados para comparar.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'pluviometers_inventory') {
      if (printTitle) printTitle.textContent = 'Reporte: Inventario de Pluviómetros y Coordenadas Georreferenciadas';
      const data = await ReportsService.getPluviometersInventory();
      this.lastReportResult = data;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Pluviómetro</th>
                <th>Tipo</th>
                <th>Comunidad / Sitio</th>
                <th>Coordenadas Geográficas</th>
                <th>Altitud</th>
                <th>Estado</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${data.length > 0 ? data.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.code)}</strong></td>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(p.equipmentType)}</td>
                  <td>${escapeHtml(p.siteName)}</td>
                  <td>${p.coordsFormatted}</td>
                  <td>${p.altitudeMeters !== null ? p.altitudeMeters + ' msnm' : '—'}</td>
                  <td>${escapeHtml(p.status)}</td>
                  <td>${escapeHtml(p.responsible || '—')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" style="text-align: center; padding: 24px;">No hay pluviómetros en el inventario.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'sources_inventory') {
      if (printTitle) printTitle.textContent = 'Reporte: Inventario de Fuentes e Infraestructura de Agua';
      const data = await ReportsService.getWaterSourcesInventory({
        municipality: this.currentFilters.municipality,
        siteId: this.currentFilters.siteId
      });
      this.lastReportResult = data;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre de la Fuente</th>
                <th>Tipo</th>
                <th>Comunidad / Municipio</th>
                <th>Coordenadas</th>
                <th>Capacidad Conocida</th>
                <th>Estado</th>
                <th>Uso Principal</th>
              </tr>
            </thead>
            <tbody>
              ${data.length > 0 ? data.map(s => `
                <tr>
                  <td><strong>${escapeHtml(s.code)}</strong></td>
                  <td>${escapeHtml(s.name)}</td>
                  <td>${escapeHtml(s.type)}</td>
                  <td>${escapeHtml(s.siteName)} <span class="text-muted">(${escapeHtml(s.municipality)})</span></td>
                  <td>${s.coordsFormatted}</td>
                  <td>${s.knownCapacityLiters ? `${Number(s.knownCapacityLiters).toLocaleString('es-CO')} L` : '—'}</td>
                  <td>${renderStatusBadge(s.status)}</td>
                  <td>${escapeHtml(s.mainUse)}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" style="text-align: center; padding: 24px;">No hay fuentes de agua en el inventario.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeReportType === 'observations') {
      if (printTitle) printTitle.textContent = 'Reporte: Observaciones de Campo Territoriales';
      const data = await ReportsService.getObservationsBySite(this.currentFilters.siteId);
      this.lastReportResult = data;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Categoría</th>
                <th>Elemento Vinculado</th>
                <th>Descripción</th>
                <th>Condición Observada</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${data.length > 0 ? data.map(o => `
                <tr>
                  <td>${o.dateFormatted}</td>
                  <td>${escapeHtml(o.category)}</td>
                  <td>${escapeHtml(o.linkedName)}</td>
                  <td>${escapeHtml(o.description)}</td>
                  <td>${escapeHtml(o.observedStatus || '—')}</td>
                  <td>${escapeHtml(o.responsible || '—')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="6" style="text-align: center; padding: 24px;">No hay notas u observaciones de campo registradas.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  _bindEvents(container) {
    const typeSelect = container.querySelector('#report-type-select');
    const csvBtn = container.querySelector('#btn-export-report-csv');
    const jsonBtn = container.querySelector('#btn-export-report-json');
    const printBtn = container.querySelector('#btn-print-report');

    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        this.activeReportType = typeSelect.value;
        this._setupFilters(container);
        this.generateReport();
      });
    }

    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        if (!this.lastReportResult) {
          notification.warning('Sin datos', 'Primero genere el reporte para exportarlo.');
          return;
        }
        const pluvMap = new Map(this.pluviometers.map(p => [p.id, p]));
        ReportsService.exportReportToCsv(this.activeReportType, this.lastReportResult, pluvMap);
        notification.success('CSV Exportado', 'El archivo tabular fue descargado en su dispositivo.');
      });
    }

    if (jsonBtn) {
      jsonBtn.addEventListener('click', () => {
        if (!this.lastReportResult) {
          notification.warning('Sin datos', 'Primero genere el reporte para exportarlo.');
          return;
        }
        JsonExportService.exportSingleEntity(`hidroterra-reporte-${this.activeReportType}`, this.lastReportResult);
        notification.success('JSON Exportado', 'Los datos estructurados fueron descargados.');
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
}
