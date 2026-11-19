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
import { modal } from '../components/modal.js';

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

  /**
   * Divide un texto en líneas de máximo maxLen caracteres respetando palabras completas
   * para evitar que las celdas de las tablas corten palabras a la mitad.
   */
  _splitWordsIntoLines(rawText, maxLen = 22) {
    const text = String(rawText || '').trim();
    if (!text) return [];
    if (text.length <= maxLen) return [text];

    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxLen) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  _formatCellText(rawText, maxLen = 22, isBold = false) {
    const lines = this._splitWordsIntoLines(rawText, maxLen);
    if (lines.length === 0) return '—';
    const content = lines
      .map(line => `<span style="display: block; white-space: nowrap;">${escapeHtml(line)}</span>`)
      .join('');
    return isBold ? `<strong style="display: block; line-height: 1.35;">${content}</strong>` : `<div style="line-height: 1.35;">${content}</div>`;
  }

  _formatSiteAndMunicipality(siteName, municipality, maxLen = 22) {
    const siteLines = this._splitWordsIntoLines(siteName || 'Sin asignar', maxLen);
    const munText = String(municipality || '').trim();
    return `
      <div style="line-height: 1.35;">
        <strong style="display: block;">
          ${siteLines.map(l => `<span style="display: block; white-space: nowrap;">${escapeHtml(l)}</span>`).join('')}
        </strong>
        ${munText ? `<span class="text-muted" style="display: block; font-size: 0.76rem; white-space: nowrap;">${escapeHtml(munText)}</span>` : ''}
      </div>
    `;
  }

  _hasActiveFiltersForCurrentReport() {
    const f = this.currentFilters;
    if (this.activeReportType === 'water_availability_status') {
      return f.municipality !== 'all' || f.siteId !== 'all' || f.availabilityStatus !== 'all';
    }
    if (this.activeReportType === 'water_measurements_history') {
      return f.waterSourceId !== 'all' || f.municipality !== 'all' || f.siteId !== 'all' || Boolean(f.startDate) || Boolean(f.endDate);
    }
    if (this.activeReportType === 'territorial_water_balance') {
      return f.municipality !== 'all' || f.siteId !== 'all' || Boolean(f.startDate) || Boolean(f.endDate);
    }
    if (this.activeReportType === 'rainfall_history') {
      return Boolean(f.pluviometerId) || f.municipality !== 'all' || f.siteId !== 'all' || Boolean(f.startDate) || Boolean(f.endDate);
    }
    if (this.activeReportType === 'accumulated') {
      return f.accumulatedMode !== 'monthly' || Boolean(f.startDate) || Boolean(f.endDate);
    }
    if (this.activeReportType === 'comparison') {
      return Boolean(f.startDate) || Boolean(f.endDate);
    }
    if (this.activeReportType === 'sources_inventory') {
      return f.municipality !== 'all' || f.siteId !== 'all';
    }
    if (this.activeReportType === 'observations') {
      return f.siteId !== 'all';
    }
    return false;
  }

  _getFilterSummaryBadgesHtml() {
    const f = this.currentFilters;
    const pills = [];

    const getSiteLabel = (id) => {
      if (!id || id === 'all') return 'Todas las comunidades';
      const s = this.sites.find(item => item.id === id);
      return s ? `${s.name} (${s.municipality})` : id;
    };

    const getSourceLabel = (id) => {
      if (!id || id === 'all') return 'Todas las fuentes';
      const s = this.sources.find(item => item.id === id);
      return s ? `${s.code} — ${s.name}` : id;
    };

    const getPluvLabel = (id) => {
      if (!id) return 'Todos los pluviómetros';
      const p = this.pluviometers.find(item => item.id === id);
      return p ? `${p.code} — ${p.name}` : id;
    };

    const availMap = {
      all: 'Cualquier disponibilidad',
      alta: 'Disponibilidad Alta',
      moderada: 'Disponibilidad Moderada',
      baja: 'Disponibilidad Baja',
      critica: 'Disponibilidad Crítica'
    };

    if (this.activeReportType === 'water_availability_status') {
      pills.push(`Municipio: <strong>${escapeHtml(f.municipality === 'all' ? 'Todos' : f.municipality)}</strong>`);
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
      pills.push(`Estado: <strong>${escapeHtml(availMap[f.availabilityStatus] || 'Todos')}</strong>`);
    } else if (this.activeReportType === 'water_measurements_history') {
      pills.push(`Fuente: <strong>${escapeHtml(getSourceLabel(f.waterSourceId))}</strong>`);
      pills.push(`Municipio: <strong>${escapeHtml(f.municipality === 'all' ? 'Todos' : f.municipality)}</strong>`);
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
      if (f.startDate || f.endDate) {
        pills.push(`Periodo: <strong>${escapeHtml(f.startDate || '...')} a ${escapeHtml(f.endDate || '...')}</strong>`);
      }
    } else if (this.activeReportType === 'territorial_water_balance') {
      pills.push(`Municipio: <strong>${escapeHtml(f.municipality === 'all' ? 'Todos' : f.municipality)}</strong>`);
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
      if (f.startDate || f.endDate) {
        pills.push(`Periodo lluvias: <strong>${escapeHtml(f.startDate || '...')} a ${escapeHtml(f.endDate || '...')}</strong>`);
      }
    } else if (this.activeReportType === 'rainfall_history') {
      pills.push(`Pluviómetro: <strong>${escapeHtml(getPluvLabel(f.pluviometerId))}</strong>`);
      pills.push(`Municipio: <strong>${escapeHtml(f.municipality === 'all' ? 'Todos' : f.municipality)}</strong>`);
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
      if (f.startDate || f.endDate) {
        pills.push(`Periodo: <strong>${escapeHtml(f.startDate || '...')} a ${escapeHtml(f.endDate || '...')}</strong>`);
      }
    } else if (this.activeReportType === 'accumulated') {
      pills.push(`Modo: <strong>${f.accumulatedMode === 'monthly' ? 'Resumen Mensual' : 'Desglose Diario'}</strong>`);
      if (f.startDate || f.endDate) {
        pills.push(`Periodo: <strong>${escapeHtml(f.startDate || '...')} a ${escapeHtml(f.endDate || '...')}</strong>`);
      }
    } else if (this.activeReportType === 'comparison') {
      if (f.startDate || f.endDate) {
        pills.push(`Periodo comparado: <strong>${escapeHtml(f.startDate || '...')} a ${escapeHtml(f.endDate || '...')}</strong>`);
      } else {
        pills.push('Periodo: <strong>Todo el historial registrado</strong>');
      }
    } else if (this.activeReportType === 'sources_inventory') {
      pills.push(`Municipio: <strong>${escapeHtml(f.municipality === 'all' ? 'Todos' : f.municipality)}</strong>`);
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
    } else if (this.activeReportType === 'observations') {
      pills.push(`Comunidad: <strong>${escapeHtml(getSiteLabel(f.siteId))}</strong>`);
    } else {
      return '<span class="text-muted" style="font-size: var(--font-size-xs);">Inventario completo de toda la base territorial registrada (no requiere filtros adicionales).</span>';
    }

    return pills
      .map(p => `<span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: var(--color-neutral-100); border: 1px solid var(--color-neutral-200); font-size: var(--font-size-xs); color: var(--color-neutral-700);">${p}</span>`)
      .join('');
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
      <div class="view-header mb-4" style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-3);">
        <div>
          <h2>Reportes, Disponibilidad e Indicadores Territoriales</h2>
          <p class="text-muted" style="margin-bottom: 0;">Generación de informes tabulares de disponibilidad hídrica, mediciones, lluvias y balances por comunidad o municipio.</p>
        </div>
        <div class="d-flex gap-2" style="flex-wrap: wrap;">
          <button class="btn btn-outline" id="btn-export-report-csv">
            <span>Descargar CSV</span>
          </button>
          <button class="btn btn-outline" id="btn-export-report-json">
            <span>Descargar JSON</span>
          </button>
          <button class="btn btn-primary" id="btn-print-report">
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      <!-- Selector de Tipo de Reporte y Acceso al Modal de Filtros -->
      <div class="card mb-4" data-no-truncate="true">
        <div class="card-body" style="padding: var(--spacing-4); display: flex; flex-direction: column; gap: var(--spacing-3);">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="report-type-select"><strong>Seleccione el Tipo de Reporte:</strong></label>
            <select class="form-control" id="report-type-select" data-no-truncate="true" style="white-space: normal; height: auto;">
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

          <!-- Barra organizada de Resumen de Filtros y Botón para abrir el Modal de Filtrado -->
          <div id="dynamic-report-filters" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: var(--spacing-3); border-top: 1px solid var(--color-neutral-200);">
            <!-- Se inyecta dinámicamente el resumen de filtros activos y el botón del modal -->
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

    const hasFilterOptions = this.activeReportType !== 'pluviometers_inventory';
    const hasActive = this._hasActiveFiltersForCurrentReport();

    filtersBox.innerHTML = `
      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; flex: 1; min-width: 220px;">
        <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-neutral-700);">Filtros aplicados:</span>
        ${this._getFilterSummaryBadgesHtml()}
      </div>
      ${hasFilterOptions ? `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${hasActive ? `
            <button type="button" class="btn btn-outline btn-sm" id="btn-reset-report-filters">
              <span>Limpiar Filtros</span>
            </button>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm" id="btn-open-report-filters-modal">
            <span>Opciones de Filtrado</span>
          </button>
        </div>
      ` : ''}
    `;

    filtersBox.querySelector('#btn-open-report-filters-modal')?.addEventListener('click', () => {
      this._openFiltersModal(container);
    });

    filtersBox.querySelector('#btn-reset-report-filters')?.addEventListener('click', () => {
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
      this._setupFilters(container);
      this.generateReport();
    });
  }

  _openFiltersModal(container) {
    const munOptions = `
      <option value="all">Todos los municipios</option>
      ${this.municipalities.map(m => `<option value="${escapeHtml(m)}" ${this.currentFilters.municipality === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
    `;

    const siteOptions = `
      <option value="all">Todas las comunidades</option>
      ${this.sites.map(s => `<option value="${s.id}" ${this.currentFilters.siteId === s.id ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.municipality)})</option>`).join('')}
    `;

    let fieldsHtml = '';

    if (this.activeReportType === 'water_availability_status') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-mun">Municipio</label>
          <select class="form-control" id="rep-filter-mun" data-no-truncate="true">${munOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
          <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rep-filter-avail">Estado de Disponibilidad Hídrica</label>
          <select class="form-control" id="rep-filter-avail" data-no-truncate="true">
            <option value="all" ${this.currentFilters.availabilityStatus === 'all' ? 'selected' : ''}>Cualquier disponibilidad</option>
            <option value="alta" ${this.currentFilters.availabilityStatus === 'alta' ? 'selected' : ''}>Disponibilidad Alta</option>
            <option value="moderada" ${this.currentFilters.availabilityStatus === 'moderada' ? 'selected' : ''}>Disponibilidad Moderada</option>
            <option value="baja" ${this.currentFilters.availabilityStatus === 'baja' ? 'selected' : ''}>Disponibilidad Baja</option>
            <option value="critica" ${this.currentFilters.availabilityStatus === 'critica' ? 'selected' : ''}>Disponibilidad Crítica</option>
          </select>
        </div>
      `;
    } else if (this.activeReportType === 'water_measurements_history') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-source">Fuente Hídrica</label>
          <select class="form-control" id="rep-filter-source" data-no-truncate="true">
            <option value="all">Todas las fuentes hídricas</option>
            ${this.sources.map(s => `<option value="${s.id}" ${this.currentFilters.waterSourceId === s.id ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-mun">Municipio</label>
            <select class="form-control" id="rep-filter-mun" data-no-truncate="true">${munOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
            <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-start">Fecha inicial (Desde)</label>
            <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-end">Fecha final (Hasta)</label>
            <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" />
          </div>
        </div>
      `;
    } else if (this.activeReportType === 'territorial_water_balance') {
      fieldsHtml = `
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-mun">Municipio</label>
            <select class="form-control" id="rep-filter-mun" data-no-truncate="true">${munOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
            <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-start">Lluvias desde</label>
            <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-end">Lluvias hasta</label>
            <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" />
          </div>
        </div>
      `;
    } else if (this.activeReportType === 'rainfall_history') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-pluv">Pluviómetro</label>
          <select class="form-control" id="rep-filter-pluv" data-no-truncate="true">
            <option value="">Todos los pluviómetros</option>
            ${this.pluviometers.map(p => `
              <option value="${p.id}" ${this.currentFilters.pluviometerId === p.id ? 'selected' : ''}>${escapeHtml(p.code)} — ${escapeHtml(p.name)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-mun">Municipio</label>
            <select class="form-control" id="rep-filter-mun" data-no-truncate="true">${munOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
            <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-start">Fecha inicial (Desde)</label>
            <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-end">Fecha final (Hasta)</label>
            <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" />
          </div>
        </div>
      `;
    } else if (this.activeReportType === 'accumulated') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-acc-mode">Agrupación del Acumulado</label>
          <select class="form-control" id="rep-filter-acc-mode" data-no-truncate="true">
            <option value="monthly" ${this.currentFilters.accumulatedMode === 'monthly' ? 'selected' : ''}>Resumen Mensual</option>
            <option value="daily" ${this.currentFilters.accumulatedMode === 'daily' ? 'selected' : ''}>Desglose Diario</option>
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-start">Fecha inicial (Desde)</label>
            <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-end">Fecha final (Hasta)</label>
            <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" />
          </div>
        </div>
      `;
    } else if (this.activeReportType === 'comparison') {
      fieldsHtml = `
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="rep-filter-start">Fecha inicial (Desde)</label>
            <input type="date" class="form-control" id="rep-filter-start" value="${this.currentFilters.startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rep-filter-end">Fecha final (Hasta)</label>
            <input type="date" class="form-control" id="rep-filter-end" value="${this.currentFilters.endDate}" />
          </div>
        </div>
      `;
    } else if (this.activeReportType === 'sources_inventory') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-mun">Municipio</label>
          <select class="form-control" id="rep-filter-mun" data-no-truncate="true">${munOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
          <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
        </div>
      `;
    } else if (this.activeReportType === 'observations') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label" for="rep-filter-site">Comunidad o Sitio</label>
          <select class="form-control" id="rep-filter-site" data-no-truncate="true">${siteOptions}</select>
        </div>
      `;
    }

    modal.open({
      title: 'Opciones de Filtrado del Reporte',
      size: 'md',
      contentHtml: `
        <div data-no-truncate="true">
          <p class="text-muted" style="font-size: var(--font-size-xs); margin-bottom: var(--spacing-3);">
            Configure los criterios de filtrado para actualizar la tabla y las exportaciones del reporte seleccionado.
          </p>
          ${fieldsHtml}
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline" id="btn-modal-clear-rep-filters"><span>Restablecer</span></button>
        <button type="button" class="btn btn-outline" data-modal-close><span>Cancelar</span></button>
        <button type="button" class="btn btn-primary" id="btn-modal-apply-rep-filters"><span>Aplicar Filtros</span></button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-modal-clear-rep-filters')?.addEventListener('click', () => {
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
          modal.close();
          this._setupFilters(container);
          this.generateReport();
        });

        dialog.querySelector('#btn-modal-apply-rep-filters')?.addEventListener('click', () => {
          const pluvSelect = dialog.querySelector('#rep-filter-pluv');
          const sourceSelect = dialog.querySelector('#rep-filter-source');
          const munSelect = dialog.querySelector('#rep-filter-mun');
          const siteSelect = dialog.querySelector('#rep-filter-site');
          const availSelect = dialog.querySelector('#rep-filter-avail');
          const startInput = dialog.querySelector('#rep-filter-start');
          const endInput = dialog.querySelector('#rep-filter-end');
          const accSelect = dialog.querySelector('#rep-filter-acc-mode');

          if (pluvSelect) this.currentFilters.pluviometerId = pluvSelect.value;
          if (sourceSelect) this.currentFilters.waterSourceId = sourceSelect.value;
          if (munSelect) this.currentFilters.municipality = munSelect.value;
          if (siteSelect) this.currentFilters.siteId = siteSelect.value;
          if (availSelect) this.currentFilters.availabilityStatus = availSelect.value;
          if (startInput) this.currentFilters.startDate = startInput.value;
          if (endInput) this.currentFilters.endDate = endInput.value;
          if (accSelect) this.currentFilters.accumulatedMode = accSelect.value;

          modal.close();
          this._setupFilters(container);
          this.generateReport();
        });
      }
    });
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
                  <td style="white-space: nowrap; word-break: keep-all;"><strong>${escapeHtml(i.code)}</strong></td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(i.name, 22, true)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(i.typeLabel, 20)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatSiteAndMunicipality(i.siteName, i.municipality, 20)}</td>
                  <td style="white-space: nowrap;">${renderStatusBadge(i.availabilityStatus, i.availabilityLabel)}</td>
                  <td style="white-space: nowrap;">
                    ${i.latestMeasurement
                      ? `<strong>${i.latestMeasurement.waterLevel} ${escapeHtml(i.latestMeasurement.unit)}</strong><br><small class="text-muted">${formatDate(i.latestMeasurement.measuredDate)}</small>`
                      : '<span class="text-muted">Sin mediciones</span>'}
                  </td>
                  <td style="white-space: nowrap;">
                    ${i.estimatedVolumeLiters != null && Number.isFinite(Number(i.estimatedVolumeLiters)) ? `<strong>${Number(i.estimatedVolumeLiters).toLocaleString('es-CO')} L</strong>` : '—'}
                    ${i.knownCapacityLiters ? `<br><small class="text-muted">de ${Number(i.knownCapacityLiters).toLocaleString('es-CO')} L (${i.percentageAvailable ?? '—'}%)</small>` : ''}
                  </td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(i.trendLabel || '—', 20)}</td>
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
                  <td style="white-space: nowrap;">
                    <span style="display: block; font-weight: 600;">${escapeHtml(r.measuredDate)}</span>
                    ${r.measuredTime ? `<small class="text-muted">${escapeHtml(r.measuredTime)}</small>` : ''}
                  </td>
                  <td style="white-space: nowrap; word-break: keep-all;">
                    <strong style="display: block;">${escapeHtml(r.sourceCode)}</strong>
                    <span class="text-muted" style="font-size: 0.78rem;">${this._formatCellText(r.sourceName, 22)}</span>
                  </td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatSiteAndMunicipality(r.siteName, r.municipality, 20)}</td>
                  <td style="white-space: nowrap;"><strong>${r.waterLevel} ${escapeHtml(r.unit)}</strong></td>
                  <td style="white-space: nowrap;">${r.estimatedVolumeLiters != null && Number.isFinite(Number(r.estimatedVolumeLiters)) ? `${Number(r.estimatedVolumeLiters).toLocaleString('es-CO')} L` : '—'}</td>
                  <td style="white-space: nowrap;">${r.percentageAvailable != null ? `${r.percentageAvailable}%` : '—'}</td>
                  <td style="white-space: nowrap;">${renderStatusBadge(r.availabilityStatus, r.availabilityLabel)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;"><small>${this._formatCellText(r.methodLabel, 20)}</small></td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(r.responsible || '—', 20)}</td>
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
              <span class="badge bg-light text-dark border p-2" style="white-space: normal; text-align: left;">
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
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(c.siteName, 22, true)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(c.municipality, 20)}</td>
                  <td style="white-space: nowrap;">${c.sourcesCount}</td>
                  <td style="white-space: nowrap;">${c.criticalOrLowCount > 0 ? `<span class="text-danger fw-bold">${c.criticalOrLowCount}</span>` : '0'}</td>
                  <td style="white-space: nowrap;">${c.parcelsCount}</td>
                  <td style="white-space: nowrap;"><strong>${c.rainTotalMm} mm</strong></td>
                  <td style="white-space: nowrap;">${c.registeredCapacityLiters > 0 ? `${c.registeredCapacityLiters.toLocaleString('es-CO')} L` : '—'}</td>
                  <td style="white-space: nowrap;"><strong>${c.estimatedAvailableLiters > 0 ? `${c.estimatedAvailableLiters.toLocaleString('es-CO')} L` : '—'}</strong></td>
                  <td style="white-space: nowrap;">${c.fillPct !== null ? `<strong>${c.fillPct}%</strong>` : '—'}</td>
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
                    <td style="white-space: nowrap;">${formatDateTime(r.measuredAt)}</td>
                    <td style="white-space: nowrap;"><strong>${r.precipitationMm} mm</strong></td>
                    <td style="white-space: nowrap; word-break: keep-all;">
                      ${p ? `<strong style="display: block;">${escapeHtml(p.code)}</strong><span class="text-muted" style="font-size: 0.78rem;">${this._formatCellText(p.name, 22)}</span>` : escapeHtml(r.pluviometerId)}
                    </td>
                    <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(r.measurementType, 20)}</td>
                    <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(r.responsible || '—', 20)}</td>
                    <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(r.notes || '—', 26)}</td>
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
                    <td style="white-space: nowrap;"><strong>${isMonthly ? getMonthName(k) : k}</strong></td>
                    <td style="white-space: nowrap;"><strong>${item.totalMm} mm</strong></td>
                    <td style="white-space: nowrap;">${item.count}</td>
                    ${isMonthly ? `<td style="white-space: nowrap;">${item.daysWithRainCount} de ${item.totalDaysMeasured} días medidos</td>` : ''}
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
                  <td style="white-space: nowrap;"><strong>${escapeHtml(c.code)}</strong></td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(c.name, 24, true)}</td>
                  <td style="white-space: nowrap;"><strong>${c.totalMm} mm</strong></td>
                  <td style="white-space: nowrap;">${c.recordCount}</td>
                  <td style="white-space: nowrap;">${c.maxReading} mm</td>
                  <td style="white-space: nowrap;">${c.lastReadingDate ? formatDateTime(c.lastReadingDate) : '<span class="text-muted">Sin datos</span>'}</td>
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
                  <td style="white-space: nowrap;"><strong>${escapeHtml(p.code)}</strong></td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(p.name, 22, true)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(p.equipmentType, 20)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(p.siteName, 22)}</td>
                  <td style="white-space: nowrap;">${p.coordsFormatted}</td>
                  <td style="white-space: nowrap;">${p.altitudeMeters !== null ? p.altitudeMeters + ' msnm' : '—'}</td>
                  <td style="white-space: nowrap;">${escapeHtml(p.status)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(p.responsible || '—', 20)}</td>
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
                  <td style="white-space: nowrap;"><strong>${escapeHtml(s.code)}</strong></td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(s.name, 22, true)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(s.type, 20)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatSiteAndMunicipality(s.siteName, s.municipality, 20)}</td>
                  <td style="white-space: nowrap;">${s.coordsFormatted}</td>
                  <td style="white-space: nowrap;">${s.knownCapacityLiters ? `${Number(s.knownCapacityLiters).toLocaleString('es-CO')} L` : '—'}</td>
                  <td style="white-space: nowrap;">${renderStatusBadge(s.status)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(s.mainUse, 20)}</td>
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
                  <td style="white-space: nowrap;">${o.dateFormatted}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(o.category, 20)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(o.linkedName, 22, true)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(o.description, 26)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(o.observedStatus || '—', 20)}</td>
                  <td style="white-space: nowrap; word-break: keep-all;">${this._formatCellText(o.responsible || '—', 20)}</td>
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
