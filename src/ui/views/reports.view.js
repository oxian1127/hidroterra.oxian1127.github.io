/**
 * Vista: Módulo de Reportes Territoriales y Exportación (Reports View)
 */

import { ReportsService } from '../../application/reports.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { SitesService } from '../../application/sites.service.js';
import { JsonExportService } from '../../infrastructure/files/json-export.js';
import { formatDate, formatDateTime, getMonthName } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { notification } from '../components/notification.js';

export class ReportsView {
  constructor(router) {
    this.router = router;
    this.activeReportType = 'rainfall_history';
    this.pluviometers = [];
    this.sites = [];
    this.currentFilters = {
      pluviometerId: '',
      siteId: '',
      startDate: '',
      endDate: '',
      accumulatedMode: 'monthly'
    };
    this.lastReportResult = null;
  }

  async render(container) {
    const [pluvs, sites] = await Promise.all([
      PluviometersService.getAll(),
      SitesService.getAll()
    ]);

    this.pluviometers = pluvs;
    this.sites = sites;

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Reportes y Balances Hídricos Territoriales</h2>
          <p class="text-muted">Generación de informes tabulares, estadísticas acumuladas, exportación en CSV/JSON e impresión de fichas.</p>
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
                <option value="rainfall_history" ${this.activeReportType === 'rainfall_history' ? 'selected' : ''}>1. Historial de lluvias por pluviómetro</option>
                <option value="accumulated" ${this.activeReportType === 'accumulated' ? 'selected' : ''}>2. Precipitación acumulada (Día, Mes o Periodo)</option>
                <option value="comparison" ${this.activeReportType === 'comparison' ? 'selected' : ''}>3. Comparación entre pluviómetros de la red</option>
                <option value="pluviometers_inventory" ${this.activeReportType === 'pluviometers_inventory' ? 'selected' : ''}>4. Inventario de pluviómetros y coordenadas</option>
                <option value="sources_inventory" ${this.activeReportType === 'sources_inventory' ? 'selected' : ''}>5. Inventario de fuentes de agua territoriales</option>
                <option value="observations" ${this.activeReportType === 'observations' ? 'selected' : ''}>6. Observaciones de campo por comunidad</option>
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
        <h1>PAnA V2 AGUA — Plataforma de Monitoreo Hídrico Rural</h1>
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

    if (this.activeReportType === 'rainfall_history') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-pluv" style="flex: 1; min-width: 180px;">
          <option value="">Todos los pluviómetros</option>
          ${this.pluviometers.map(p => `
            <option value="${p.id}" ${this.currentFilters.pluviometerId === p.id ? 'selected' : ''}>${p.code} — ${p.name}</option>
          `).join('')}
        </select>
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
    } else if (this.activeReportType === 'observations') {
      filtersBox.innerHTML = `
        <select class="form-control" id="rep-filter-site" style="flex: 1; min-width: 200px;">
          <option value="all">Todas las comunidades</option>
          ${this.sites.map(s => `
            <option value="${s.id}" ${this.currentFilters.siteId === s.id ? 'selected' : ''}>${s.name} (${s.municipality})</option>
          `).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrar</button>
      `;
    } else {
      filtersBox.innerHTML = '<span class="text-muted" style="font-size: var(--font-size-xs);">Inventario completo de toda la base territorial registrada.</span>';
    }

    const applyBtn = filtersBox.querySelector('#btn-apply-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const pluvSelect = filtersBox.querySelector('#rep-filter-pluv');
        const startInput = filtersBox.querySelector('#rep-filter-start');
        const endInput = filtersBox.querySelector('#rep-filter-end');
        const siteSelect = filtersBox.querySelector('#rep-filter-site');
        const accSelect = filtersBox.querySelector('#rep-filter-acc-mode');

        if (pluvSelect) this.currentFilters.pluviometerId = pluvSelect.value;
        if (startInput) this.currentFilters.startDate = startInput.value;
        if (endInput) this.currentFilters.endDate = endInput.value;
        if (siteSelect) this.currentFilters.siteId = siteSelect.value;
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

    if (this.activeReportType === 'rainfall_history') {
      if (printTitle) printTitle.textContent = 'Reporte: Historial Cronológico de Lluvias por Pluviómetro';
      const data = await ReportsService.getRainfallHistory(
        this.currentFilters.pluviometerId,
        this.currentFilters.startDate,
        this.currentFilters.endDate
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
      if (printTitle) printTitle.textContent = 'Reporte: Inventario de Fuentes de Agua';
      const data = await ReportsService.getWaterSourcesInventory();
      this.lastReportResult = data;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre de la Fuente</th>
                <th>Tipo</th>
                <th>Comunidad / Sitio</th>
                <th>Coordenadas</th>
                <th>Estado Observado</th>
                <th>Uso Principal</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${data.length > 0 ? data.map(s => `
                <tr>
                  <td><strong>${escapeHtml(s.code)}</strong></td>
                  <td>${escapeHtml(s.name)}</td>
                  <td>${escapeHtml(s.type)}</td>
                  <td>${escapeHtml(s.siteName)}</td>
                  <td>${s.coordsFormatted}</td>
                  <td>${escapeHtml(s.status)}</td>
                  <td>${escapeHtml(s.mainUse)}</td>
                  <td>${escapeHtml(s.responsible || '—')}</td>
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
        JsonExportService.exportSingleEntity(`reporte-${this.activeReportType}`, this.lastReportResult);
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
