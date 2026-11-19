/**
 * Vista: Pluviómetros (Pluviometers View)
 */

import { PluviometersService } from '../../application/pluviometers.service.js';
import { SitesService } from '../../application/sites.service.js';
import { PLUVIOMETER_TYPES, PLUVIOMETER_STATUSES } from '../../domain/models/Pluviometer.js';
import { DataTable } from '../components/data-table.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { renderStatusBadge } from '../components/status-badge.js';
import {
  renderTextField,
  renderSelectField,
  renderTextareaField,
  renderCoordinatesPicker,
  bindCoordinatesPickerEvents
} from '../components/form-field.js';
import { formatCoordinates } from '../../domain/rules/coordinates.rules.js';
import { formatDate, formatDateTime, todayDateInput } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';

export class PluviometersView {
  constructor(router) {
    this.router = router;
    this.dataTable = null;
    this.sites = [];
    this.currentFilters = {
      search: '',
      status: 'all',
      equipmentType: 'all',
      siteId: 'all'
    };
  }

  async render(container, params = {}) {
    this.sites = await SitesService.getAll();

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Red Territorial de Pluviómetros</h2>
          <p class="text-muted">Registro de equipos, fichas técnicas de instalación y coordenadas georreferenciadas en Montes de María.</p>
        </div>
        <button class="btn btn-primary" id="btn-create-pluv">
          <span>Añadir Pluviómetro</span>
        </button>
      </div>

      <!-- Barra de Filtros -->
      <div class="filter-bar">
        <div class="input-with-icon">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="form-control filter-input-search" id="pluv-filter-search" placeholder="Buscar por código, nombre o responsable..." value="${escapeHtml(this.currentFilters.search)}" />
        </div>

        <select class="form-control filter-select" id="pluv-filter-status">
          <option value="all">Todos los estados</option>
          ${Object.entries(PLUVIOMETER_STATUSES).map(([k, v]) => `
            <option value="${k}" ${this.currentFilters.status === k ? 'selected' : ''}>${v}</option>
          `).join('')}
        </select>

        <select class="form-control filter-select" id="pluv-filter-type">
          <option value="all">Todos los tipos de equipo</option>
          ${Object.entries(PLUVIOMETER_TYPES).map(([k, v]) => `
            <option value="${k}" ${this.currentFilters.equipmentType === k ? 'selected' : ''}>${v}</option>
          `).join('')}
        </select>

        <select class="form-control filter-select" id="pluv-filter-site">
          <option value="all">Todas las comunidades</option>
          ${this.sites.map(s => `
            <option value="${s.id}" ${this.currentFilters.siteId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
          `).join('')}
        </select>

        <button class="btn btn-outline btn-sm" id="btn-clear-pluv-filters">Limpiar Filtros</button>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="pluviometers-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);

    if (params.openModal) {
      this.openFormModal();
    } else if (params.openDetails && params.highlightId) {
      this.openDetailsModal(params.highlightId);
    }
  }

  async _loadData() {
    const list = await PluviometersService.getAll(this.currentFilters);
    const siteMap = new Map(this.sites.map(s => [s.id, s.name]));

    const enriched = list.map(item => ({
      ...item,
      siteName: siteMap.get(item.siteId) || 'Sin asignar',
      typeLabel: PLUVIOMETER_TYPES[item.equipmentType] || item.equipmentType,
      statusBadge: renderStatusBadge(item.status),
      coordsDisplay: formatCoordinates(item.latitude, item.longitude)
    }));

    this.dataTable.setItems(enriched);
    const container = document.getElementById('pluviometers-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActionButtons(container));
      this._bindTableActionButtons(container);
    }
  }

  _formatCodeMaxChars(rawCode, maxChars = 15) {
    const clean = String(rawCode || '').trim();
    if (!clean) return '—';
    const lines = [];
    for (let i = 0; i < clean.length; i += maxChars) {
      lines.push(escapeHtml(clean.slice(i, i + maxChars)));
    }
    return lines.join('<br/>');
  }

  _formatCellLines(rawText, maxLen = 24, isBold = false) {
    const text = String(rawText || '').trim();
    if (!text) return '—';

    if (text.length <= maxLen) {
      const span = `<span style="display: block; white-space: nowrap;">${escapeHtml(text)}</span>`;
      return isBold ? `<strong style="display: block; line-height: 1.35;">${span}</strong>` : `<div style="line-height: 1.35;">${span}</div>`;
    }

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

    const htmlLines = lines
      .map(line => `<span style="display: block; white-space: nowrap;">${escapeHtml(line)}</span>`)
      .join('');
    return isBold
      ? `<strong style="display: block; line-height: 1.35;">${htmlLines}</strong>`
      : `<div style="line-height: 1.35;">${htmlLines}</div>`;
  }

  _formatCoordsCell(coordsDisplay) {
    const text = String(coordsDisplay || '').trim();
    if (!text) return '—';
    const parts = text.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      return `
        <span data-allow-copy="true" class="allow-copy" style="display: inline-block; line-height: 1.35;" title="Coordenadas habilitadas para copia">
          <span style="display: block; white-space: nowrap;">${escapeHtml(parts[0])},</span>
          <span style="display: block; white-space: nowrap;">${escapeHtml(parts[1])}</span>
        </span>
      `;
    }
    return `<span data-allow-copy="true" class="allow-copy" style="display: inline-block; white-space: nowrap;" title="Coordenadas habilitadas para copia">${escapeHtml(text)}</span>`;
  }

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        {
          key: 'code',
          label: 'Código',
          render: (item) => `<code data-allow-copy="true" data-copy-value="${escapeHtml(item.code)}" class="allow-copy source-code-badge" title="Código habilitado para copia: ${escapeHtml(item.code)}">${this._formatCodeMaxChars(item.code, 15)}</code>`
        },
        {
          key: 'name',
          label: 'Nombre Identificador',
          render: (item) => this._formatCellLines(item.name, 24, true)
        },
        {
          key: 'typeLabel',
          label: 'Tipo de Equipo',
          render: (item) => this._formatCellLines(item.typeLabel, 22, false)
        },
        {
          key: 'siteName',
          label: 'Comunidad / Sitio',
          render: (item) => this._formatCellLines(item.siteName, 24, false)
        },
        {
          key: 'statusBadge',
          label: 'Estado',
          render: (item) => `<div style="white-space: nowrap;">${item.statusBadge}</div>`
        },
        {
          key: 'coordsDisplay',
          label: 'Coordenadas',
          render: (item) => this._formatCoordsCell(item.coordsDisplay)
        },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-view-pluv" data-id="${item.id}" title="Ver ficha y mediciones">Ficha</button>
              <button class="btn btn-blue btn-sm btn-add-rain-pluv" data-id="${item.id}" title="Registrar lluvia en este equipo">Lluvia</button>
              <button class="btn btn-outline btn-sm btn-climate-pluv" data-id="${item.id}" title="Consultar clima y pronóstico en este pluviómetro">Clima</button>
              <button class="btn btn-outline btn-sm btn-edit-pluv" data-id="${item.id}" title="Editar">Editar</button>
              <button class="btn btn-outline btn-sm btn-delete-pluv" data-id="${item.id}" title="Eliminar / Retirar">Eliminar</button>
            </div>
          `
        }
      ],
      emptyTitle: 'No hay pluviómetros registrados',
      emptyDescription: 'Agregue los pluviómetros comunitarios o manuales instalados en las veredas y predios.'
    });

    this._loadData();
  }

  _bindTableActionButtons(container) {
    container.querySelectorAll('.btn-view-pluv').forEach(btn => {
      btn.addEventListener('click', () => this.openDetailsModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-add-rain-pluv').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('rainfall', { openModal: true, pluviometerId: btn.dataset.id });
      });
    });

    container.querySelectorAll('.btn-climate-pluv').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('climate', { pluviometerId: btn.dataset.id });
      });
    });

    container.querySelectorAll('.btn-edit-pluv').forEach(btn => {
      btn.addEventListener('click', () => this.openFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-delete-pluv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const pluv = await PluviometersService.getById(id);
        if (!pluv) return;

        const confirmed = await modal.confirm({
          title: `Eliminar Pluviómetro: ${pluv.name}`,
          message: `¿Está seguro de eliminar el equipo "${pluv.code} - ${pluv.name}"? Si tiene mediciones de lluvia asociadas, la regla de integridad protegerá los registros recomendando marcarlo como "Retirado".`,
          confirmText: 'Intentar Eliminar',
          isDanger: true
        });

        if (confirmed) {
          try {
            await PluviometersService.delete(id);
            notification.success('Pluviómetro eliminado', 'El equipo fue eliminado del inventario.');
            this._loadData();
          } catch (err) {
            notification.error('Operación bloqueada por integridad', err.message);
          }
        }
      });
    });
  }

  _bindEvents(container) {
    const createBtn = container.querySelector('#btn-create-pluv');
    const searchInput = container.querySelector('#pluv-filter-search');
    const statusSelect = container.querySelector('#pluv-filter-status');
    const typeSelect = container.querySelector('#pluv-filter-type');
    const siteSelect = container.querySelector('#pluv-filter-site');
    const clearBtn = container.querySelector('#btn-clear-pluv-filters');

    if (createBtn) createBtn.addEventListener('click', () => this.openFormModal());

    const applyFilters = () => {
      this.currentFilters.search = searchInput.value;
      this.currentFilters.status = statusSelect.value;
      this.currentFilters.equipmentType = typeSelect.value;
      this.currentFilters.siteId = siteSelect.value;
      this._loadData();
    };

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusSelect) statusSelect.addEventListener('change', applyFilters);
    if (typeSelect) typeSelect.addEventListener('change', applyFilters);
    if (siteSelect) siteSelect.addEventListener('change', applyFilters);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.currentFilters = { search: '', status: 'all', equipmentType: 'all', siteId: 'all' };
        searchInput.value = '';
        statusSelect.value = 'all';
        typeSelect.value = 'all';
        siteSelect.value = 'all';
        this._loadData();
      });
    }
  }

  async openFormModal(id = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await PluviometersService.getById(id) : null;
    let assignedCode = isEdit && current && current.code ? current.code : '';

    const siteOptions = [
      { value: '', label: '— Seleccione una comunidad para generar el código —' },
      ...this.sites.map(s => ({ value: s.id, label: `${s.name} (${s.municipality})` }))
    ];

    const typeOptions = Object.entries(PLUVIOMETER_TYPES).map(([k, v]) => ({ value: k, label: v }));
    const statusOptions = Object.entries(PLUVIOMETER_STATUSES).map(([k, v]) => ({ value: k, label: v }));

    const contentHtml = `
      <form id="form-pluviometer">
        <div class="form-grid-2">
          ${renderSelectField({
            id: 'pluv-site',
            label: 'Comunidad o Sitio Asociado',
            value: current ? (current.siteId || '') : '',
            options: siteOptions,
            required: true,
            help: 'Seleccione la comunidad para asignar el código del equipo'
          })}

          ${renderTextField({
            id: 'pluv-code',
            label: 'Código del Pluviómetro (Automático)',
            value: assignedCode,
            placeholder: 'Seleccione primero la comunidad (Ej: PLUV-CARM-01)',
            required: true,
            readonly: true,
            disabled: true,
            help: 'Generado automáticamente según la comunidad (no editable)'
          })}
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'pluv-name',
            label: 'Nombre Identificador',
            value: current ? current.name : '',
            placeholder: 'Ej: Pluviómetro Finca La Esperanza',
            required: true
          })}

          ${renderSelectField({
            id: 'pluv-type',
            label: 'Tipo de Equipo',
            value: current ? current.equipmentType : 'manual',
            options: typeOptions,
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderSelectField({
            id: 'pluv-status',
            label: 'Estado Operativo',
            value: current ? current.status : 'activo',
            options: statusOptions,
            required: true
          })}

          ${renderTextField({
            id: 'pluv-install-date',
            label: 'Fecha de Instalación',
            value: current && current.installDate ? current.installDate : todayDateInput(),
            type: 'date'
          })}
        </div>

        ${renderTextField({
          id: 'pluv-responsible',
          label: 'Responsable de la Lectura',
          value: current ? current.responsible : '',
          placeholder: 'Nombre del monitor comunitario o propietario del predio'
        })}

        <!-- Selector de Coordenadas con Geolocation API + Manual -->
        ${renderCoordinatesPicker({
          latId: 'pluv-lat',
          lonId: 'pluv-lon',
          altId: 'pluv-alt',
          latitude: current ? current.latitude : '',
          longitude: current ? current.longitude : '',
          altitude: current ? current.altitudeMeters : ''
        })}

        ${renderTextareaField({
          id: 'pluv-notes',
          label: 'Observaciones de Instalación',
          value: current ? current.notes : '',
          placeholder: 'Ubicación libre de obstáculos, altura sobre el suelo, tipo de soporte...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Pluviómetro' : 'Registrar Nuevo Pluviómetro',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Equipo' : 'Guardar Pluviómetro'}</button>
      `,
      onMount: (dialog) => {
        bindCoordinatesPickerEvents(dialog, { latId: 'pluv-lat', lonId: 'pluv-lon', altId: 'pluv-alt' });

        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');
        const siteSelectEl = dialog.querySelector('#pluv-site');
        const codeInputEl = dialog.querySelector('#pluv-code');

        // Al seleccionar o cambiar la comunidad, generar automáticamente el código único siguiendo el modelo PLUV-CARM-01
        if (siteSelectEl && codeInputEl && !isEdit) {
          siteSelectEl.addEventListener('change', async () => {
            const selectedSiteId = siteSelectEl.value;
            if (!selectedSiteId) {
              assignedCode = '';
              codeInputEl.value = '';
              return;
            }
            const siteObj = this.sites.find(s => s.id === selectedSiteId) || selectedSiteId;
            assignedCode = await PluviometersService.generateUniqueCodeForSite(siteObj);
            codeInputEl.value = assignedCode;
          });
        }

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          const selectedSiteId = dialog.querySelector('#pluv-site')?.value || '';
          if (!selectedSiteId) {
            notification.warning('Comunidad obligatoria', 'Seleccione primero la comunidad o sitio asociado para generar automáticamente el código del pluviómetro.');
            siteSelectEl?.focus();
            return;
          }

          if (!assignedCode) {
            const siteObj = this.sites.find(s => s.id === selectedSiteId) || selectedSiteId;
            assignedCode = await PluviometersService.generateUniqueCodeForSite(siteObj);
            if (codeInputEl) codeInputEl.value = assignedCode;
          }

          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              code: assignedCode,
              name: dialog.querySelector('#pluv-name').value,
              equipmentType: dialog.querySelector('#pluv-type').value,
              siteId: selectedSiteId,
              status: dialog.querySelector('#pluv-status').value,
              installDate: dialog.querySelector('#pluv-install-date').value || null,
              responsible: dialog.querySelector('#pluv-responsible').value,
              latitude: dialog.querySelector('#pluv-lat').value || null,
              longitude: dialog.querySelector('#pluv-lon').value || null,
              altitudeMeters: dialog.querySelector('#pluv-alt').value || null,
              notes: dialog.querySelector('#pluv-notes').value
            };

            if (isEdit) {
              await PluviometersService.update(id, formData);
              notification.success('Pluviómetro actualizado', 'Ficha modificada con éxito.');
            } else {
              await PluviometersService.create(formData);
              notification.success('Pluviómetro registrado', 'Nuevo pluviómetro añadido a la red.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Equipo' : 'Guardar Pluviómetro';
          }
        });
      }
    });
  }

  async openDetailsModal(id) {
    const pluv = await PluviometersService.getById(id);
    if (!pluv) return;

    const [site, measurements] = await Promise.all([
      pluv.siteId ? SitesService.getById(pluv.siteId) : null,
      PluviometersService.getMeasurements(id)
    ]);

    const totalMm = measurements.reduce((acc, m) => acc + (Number(m.precipitationMm) || 0), 0);
    const coordsText = formatCoordinates(pluv.latitude, pluv.longitude);
    const hasValidCoords = pluv.latitude !== null && pluv.latitude !== undefined && pluv.latitude !== '' &&
      pluv.longitude !== null && pluv.longitude !== undefined && pluv.longitude !== '';

    const copyIconSvg = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;

    const checkIconSvg = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-green-700, #15803d)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    modal.open({
      title: `Ficha Técnica: ${escapeHtml(pluv.name)} (${escapeHtml(pluv.code)})`,
      size: 'lg',
      contentHtml: `
        <div class="pluv-detail-sheet">
          <div class="form-grid-2 mb-4">
            <div>
              <p><strong>Código:</strong> ${escapeHtml(pluv.code)}</p>
              <p><strong>Identificador:</strong> ${escapeHtml(pluv.name)}</p>
              <p><strong>Tipo:</strong> ${escapeHtml(PLUVIOMETER_TYPES[pluv.equipmentType] || pluv.equipmentType)}</p>
              <p><strong>Comunidad:</strong> ${site ? escapeHtml(site.name) + ' (' + escapeHtml(site.municipality) + ')' : 'Sin comunidad vinculada'}</p>
            </div>
            <div>
              <p><strong>Estado:</strong> ${renderStatusBadge(pluv.status)}</p>
              <p><strong>Fecha Instalación:</strong> ${formatDate(pluv.installDate)}</p>
              <p><strong>Responsable:</strong> ${escapeHtml(pluv.responsible || '—')}</p>
              <p><strong>Altitud:</strong> ${pluv.altitudeMeters !== null ? pluv.altitudeMeters + ' msnm' : 'No registrada'}</p>
            </div>
          </div>

          <div class="coords-picker-box mb-4">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
              <strong>Georreferenciación (Coordenadas):</strong>
              ${hasValidCoords ? `
                <button type="button" class="btn btn-outline btn-sm" id="btn-locate-pluv-map" title="Ver ubicación exacta del pluviómetro en el mapa territorial">
                  <span>Ubicar en el Mapa</span>
                </button>
              ` : ''}
            </div>
            <div style="position: relative; background-color: var(--color-white); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); padding: 10px 44px 10px 12px;">
              <p id="pluv-detail-coords-text" data-allow-copy="true" class="allow-copy" style="margin: 0; font-family: var(--font-family-mono, monospace); font-size: var(--font-size-sm); font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(coordsText)}</p>
              ${hasValidCoords ? `
                <button type="button" id="btn-copy-pluv-coords"
                  title="Copiar coordenadas al portapapeles"
                  aria-label="Copiar coordenadas"
                  style="position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); border: 1px solid var(--color-neutral-200); background-color: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease;">
                  ${copyIconSvg}
                </button>
              ` : ''}
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <div>
                <h4 style="margin: 0;">Historial de Mediciones (${measurements.length} lecturas)</h4>
                <small class="text-muted">Total acumulado registrado: ${Math.round(totalMm * 10) / 10} mm</small>
              </div>
              <button class="btn btn-blue btn-sm" id="btn-modal-add-rain">Nueva Medición</button>
            </div>
            <div class="card-body" style="padding: 0; max-height: 220px; overflow-y: auto;">
              ${measurements.length > 0 ? `
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Precipitación</th>
                      <th>Tipo</th>
                      <th>Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${measurements.slice(0, 15).map(m => `
                      <tr>
                        <td>${formatDateTime(m.measuredAt)}</td>
                        <td><strong>${m.precipitationMm} mm</strong></td>
                        <td><span class="badge badge-info">${escapeHtml(m.measurementType)}</span></td>
                        <td>${escapeHtml(m.responsible || '—')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="padding: var(--spacing-4); text-align: center;" class="text-muted">
                  No hay lecturas registradas para este equipo.
                </div>
              `}
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-close">Cerrar</button>
        <button class="btn btn-primary" id="modal-btn-edit-pluv">Editar Ficha</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#modal-btn-close').addEventListener('click', () => modal.close());
        dialog.querySelector('#modal-btn-edit-pluv').addEventListener('click', () => {
          modal.close();
          this.openFormModal(id);
        });
        const addRainBtn = dialog.querySelector('#btn-modal-add-rain');
        if (addRainBtn) {
          addRainBtn.addEventListener('click', () => {
            modal.close();
            this.router.navigate('rainfall', { openModal: true, pluviometerId: id });
          });
        }

        const copyCoordsBtn = dialog.querySelector('#btn-copy-pluv-coords');
        if (copyCoordsBtn) {
          copyCoordsBtn.addEventListener('click', async () => {
            try {
              if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(coordsText);
              } else {
                const tempTa = document.createElement('textarea');
                tempTa.value = coordsText;
                tempTa.style.position = 'fixed';
                tempTa.style.opacity = '0';
                document.body.appendChild(tempTa);
                tempTa.select();
                document.execCommand('copy');
                document.body.removeChild(tempTa);
              }
              copyCoordsBtn.innerHTML = checkIconSvg;
              notification.success('Coordenadas copiadas', `Se copió "${coordsText}" al portapapeles.`);
              setTimeout(() => {
                if (copyCoordsBtn.isConnected) {
                  copyCoordsBtn.innerHTML = copyIconSvg;
                }
              }, 1600);
            } catch {
              notification.error('Error al copiar', 'No se pudo copiar automáticamente las coordenadas.');
            }
          });
        }

        const locateMapBtn = dialog.querySelector('#btn-locate-pluv-map');
        if (locateMapBtn) {
          locateMapBtn.addEventListener('click', () => {
            modal.close();
            this.router.navigate('map', {
              focusType: 'pluviometer',
              focusId: pluv.id,
              lat: pluv.latitude,
              lon: pluv.longitude,
              zoom: 16
            });
          });
        }
      }
    });
  }
}
