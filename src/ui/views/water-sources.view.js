/**
 * Vista: Fuentes de Agua (WaterSources View)
 */

import { WaterSourcesService } from '../../application/water-sources.service.js';
import { SitesService } from '../../application/sites.service.js';
import { WATER_SOURCE_TYPES, WATER_SOURCE_STATUSES, WATER_SOURCE_USES } from '../../domain/models/WaterSource.js';
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
import { formatDate, nowIso, todayDateInput } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';

export class WaterSourcesView {
  constructor(router) {
    this.router = router;
    this.dataTable = null;
    this.sites = [];
    this.currentFilters = {
      search: '',
      type: 'all',
      status: 'all',
      siteId: 'all'
    };
  }

  async render(container, params = {}) {
    this.sites = await SitesService.getAll();

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Inventario de Fuentes de Agua</h2>
          <p class="text-muted">Registro y estado observado de pozos, arroyos, ríos, manantiales y reservorios en Montes de María.</p>
        </div>
        <button class="btn btn-primary" id="btn-create-source">
          <span><i class="fa-solid fa-droplet"></i> Nueva Fuente de Agua</span>
        </button>
      </div>

      <!-- Barra de Filtros -->
      <div class="filter-bar">
        <input type="text" class="form-control filter-input-search" id="source-filter-search" 
               placeholder="Buscar por nombre, código o responsable..." value="${escapeHtml(this.currentFilters.search)}" />

        <select class="form-control filter-select" id="source-filter-type">
          <option value="all">Todos los tipos</option>
          ${Object.entries(WATER_SOURCE_TYPES).map(([k, v]) => `
            <option value="${k}" ${this.currentFilters.type === k ? 'selected' : ''}>${v}</option>
          `).join('')}
        </select>

        <select class="form-control filter-select" id="source-filter-status">
          <option value="all">Todos los estados</option>
          ${Object.entries(WATER_SOURCE_STATUSES).map(([k, v]) => `
            <option value="${k}" ${this.currentFilters.status === k ? 'selected' : ''}>${v}</option>
          `).join('')}
        </select>

        <select class="form-control filter-select" id="source-filter-site">
          <option value="all">Todas las comunidades</option>
          ${this.sites.map(s => `
            <option value="${s.id}" ${this.currentFilters.siteId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
          `).join('')}
        </select>

        <button class="btn btn-outline btn-sm" id="btn-clear-source-filters">Limpiar Filtros</button>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="sources-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);

    if (params.openModal) {
      this.openFormModal();
    }
  }

  async _loadData() {
    const list = await WaterSourcesService.getAll(this.currentFilters);
    const siteMap = new Map(this.sites.map(s => [s.id, s.name]));

    const enriched = list.map(item => ({
      ...item,
      siteName: siteMap.get(item.siteId) || 'Sin asignar',
      typeLabel: WATER_SOURCE_TYPES[item.type] || item.type,
      statusBadge: renderStatusBadge(item.status),
      coordsDisplay: formatCoordinates(item.latitude, item.longitude)
    }));

    this.dataTable.setItems(enriched);
    const container = document.getElementById('sources-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActionButtons(container));
      this._bindTableActionButtons(container);
    }
  }

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre de la Fuente' },
        { key: 'typeLabel', label: 'Tipo' },
        { key: 'siteName', label: 'Comunidad / Sitio' },
        { key: 'statusBadge', label: 'Estado', render: (item) => item.statusBadge },
        { key: 'coordsDisplay', label: 'Coordenadas' },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-view-source" data-id="${item.id}" title="Ver detalles"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn-outline btn-sm btn-edit-source" data-id="${item.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-toggle-source" data-id="${item.id}" title="${item.active !== false ? 'Desactivar fuente' : 'Activar fuente'}">
                ${item.active !== false ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>'}
              </button>
            </div>
          `
        }
      ],
      emptyTitle: 'No hay fuentes de agua registradas',
      emptyDescription: 'Utilice el botón «Nueva Fuente de Agua» para registrar fuentes hídricas en Montes de María.'
    });

    this._loadData();
  }

  _bindTableActionButtons(container) {
    container.querySelectorAll('.btn-view-source').forEach(btn => {
      btn.addEventListener('click', () => this.openDetailsModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-edit-source').forEach(btn => {
      btn.addEventListener('click', () => this.openFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-toggle-source').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const source = await WaterSourcesService.getById(id);
        if (source) {
          const nextState = source.active === false;
          await WaterSourcesService.toggleActive(id, nextState);
          notification.success('Estado actualizado', `La fuente "${source.name}" ha sido ${nextState ? 'activada' : 'desactivada'}.`);
          this._loadData();
        }
      });
    });
  }

  _bindEvents(container) {
    const createBtn = container.querySelector('#btn-create-source');
    const searchInput = container.querySelector('#source-filter-search');
    const typeSelect = container.querySelector('#source-filter-type');
    const statusSelect = container.querySelector('#source-filter-status');
    const siteSelect = container.querySelector('#source-filter-site');
    const clearBtn = container.querySelector('#btn-clear-source-filters');

    if (createBtn) createBtn.addEventListener('click', () => this.openFormModal());

    const applyFilters = () => {
      this.currentFilters.search = searchInput.value;
      this.currentFilters.type = typeSelect.value;
      this.currentFilters.status = statusSelect.value;
      this.currentFilters.siteId = siteSelect.value;
      this._loadData();
    };

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (typeSelect) typeSelect.addEventListener('change', applyFilters);
    if (statusSelect) statusSelect.addEventListener('change', applyFilters);
    if (siteSelect) siteSelect.addEventListener('change', applyFilters);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.currentFilters = { search: '', type: 'all', status: 'all', siteId: 'all' };
        searchInput.value = '';
        typeSelect.value = 'all';
        statusSelect.value = 'all';
        siteSelect.value = 'all';
        this._loadData();
      });
    }
  }

  async openFormModal(id = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await WaterSourcesService.getById(id) : null;

    const siteOptions = [
      { value: '', label: '— Seleccionar comunidad (opcional) —' },
      ...this.sites.map(s => ({ value: s.id, label: `${s.name} (${s.municipality})` }))
    ];

    const typeOptions = Object.entries(WATER_SOURCE_TYPES).map(([k, v]) => ({ value: k, label: v }));
    const statusOptions = Object.entries(WATER_SOURCE_STATUSES).map(([k, v]) => ({ value: k, label: v }));
    const useOptions = Object.entries(WATER_SOURCE_USES).map(([k, v]) => ({ value: k, label: v }));

    const contentHtml = `
      <form id="form-water-source">
        <div class="form-grid-2">
          ${renderTextField({
            id: 'ws-code',
            label: 'Código de Identificación',
            value: current ? current.code : '',
            placeholder: 'Ej: FNT-CARMEN-01',
            required: true,
            help: 'Identificador único y legible'
          })}

          ${renderTextField({
            id: 'ws-name',
            label: 'Nombre de la Fuente',
            value: current ? current.name : '',
            placeholder: 'Ej: Pozo Comunitario San Rafael',
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderSelectField({
            id: 'ws-type',
            label: 'Tipo de Fuente',
            value: current ? current.type : 'pozo',
            options: typeOptions,
            required: true
          })}

          ${renderSelectField({
            id: 'ws-site',
            label: 'Comunidad o Sitio Asociado',
            value: current ? (current.siteId || '') : '',
            options: siteOptions
          })}
        </div>

        <div class="form-grid-2">
          ${renderSelectField({
            id: 'ws-status',
            label: 'Estado Observado',
            value: current ? current.status : 'disponible',
            options: statusOptions,
            required: true
          })}

          ${renderSelectField({
            id: 'ws-use',
            label: 'Uso Principal del Agua',
            value: current ? current.mainUse : 'domestico',
            options: useOptions,
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'ws-obs-date',
            label: 'Fecha de la Observación',
            value: current ? current.observationDate.split('T')[0] : todayDateInput(),
            type: 'date',
            required: true
          })}

          ${renderTextField({
            id: 'ws-responsible',
            label: 'Responsable del Registro',
            value: current ? current.responsible : '',
            placeholder: 'Nombre o comité local'
          })}
        </div>

        <!-- Selector de Coordenadas GPS -->
        ${renderCoordinatesPicker({
          latId: 'ws-lat',
          lonId: 'ws-lon',
          latitude: current ? current.latitude : '',
          longitude: current ? current.longitude : ''
        })}

        ${renderTextareaField({
          id: 'ws-notes',
          label: 'Observaciones de Campo',
          value: current ? current.notes : '',
          placeholder: 'Detalles sobre acceso, infraestructura de bombeo, turbidez o estacionalidad...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Fuente de Agua' : 'Registrar Nueva Fuente de Agua',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Fuente' : 'Guardar Fuente'}</button>
      `,
      onMount: (dialog) => {
        bindCoordinatesPickerEvents(dialog, { latId: 'ws-lat', lonId: 'ws-lon' });

        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              code: dialog.querySelector('#ws-code').value,
              name: dialog.querySelector('#ws-name').value,
              type: dialog.querySelector('#ws-type').value,
              siteId: dialog.querySelector('#ws-site').value || null,
              status: dialog.querySelector('#ws-status').value,
              mainUse: dialog.querySelector('#ws-use').value,
              observationDate: dialog.querySelector('#ws-obs-date').value ? new Date(dialog.querySelector('#ws-obs-date').value).toISOString() : nowIso(),
              responsible: dialog.querySelector('#ws-responsible').value,
              latitude: dialog.querySelector('#ws-lat').value || null,
              longitude: dialog.querySelector('#ws-lon').value || null,
              notes: dialog.querySelector('#ws-notes').value
            };

            if (isEdit) {
              await WaterSourcesService.update(id, formData);
              notification.success('Fuente actualizada', 'Los datos se guardaron con éxito en la base de datos local.');
            } else {
              await WaterSourcesService.create(formData);
              notification.success('Fuente registrada', 'La nueva fuente de agua fue guardada exitosamente.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Fuente' : 'Guardar Fuente';
          }
        });
      }
    });
  }

  async openDetailsModal(id) {
    const source = await WaterSourcesService.getById(id);
    if (!source) return;

    const site = source.siteId ? await SitesService.getById(source.siteId) : null;

    modal.open({
      title: `Ficha: ${escapeHtml(source.name)} (${escapeHtml(source.code)})`,
      size: 'lg',
      contentHtml: `
        <div class="source-detail-sheet">
          <div class="form-grid-2 mb-4">
            <div>
              <p><strong>Código:</strong> ${escapeHtml(source.code)}</p>
              <p><strong>Nombre:</strong> ${escapeHtml(source.name)}</p>
              <p><strong>Tipo:</strong> ${escapeHtml(WATER_SOURCE_TYPES[source.type] || source.type)}</p>
              <p><strong>Comunidad:</strong> ${site ? escapeHtml(site.name) + ' (' + escapeHtml(site.municipality) + ')' : 'Sin comunidad vinculada'}</p>
            </div>
            <div>
              <p><strong>Estado Actual:</strong> ${renderStatusBadge(source.status)}</p>
              <p><strong>Uso Principal:</strong> ${escapeHtml(WATER_SOURCE_USES[source.mainUse] || source.mainUse)}</p>
              <p><strong>Fecha de Observación:</strong> ${formatDate(source.observationDate)}</p>
              <p><strong>Responsable:</strong> ${escapeHtml(source.responsible || '—')}</p>
            </div>
          </div>

          <div class="coords-picker-box mb-4">
            <strong>Georreferenciación:</strong>
            <p>${formatCoordinates(source.latitude, source.longitude)}</p>
          </div>

          <div>
            <strong>Observaciones de campo:</strong>
            <p style="background-color: var(--color-neutral-50); padding: var(--spacing-3); border-radius: var(--radius-md); margin-top: 4px;">
              ${escapeHtml(source.notes || 'No se registraron observaciones adicionales.')}
            </p>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-close">Cerrar</button>
        <button class="btn btn-primary" id="modal-btn-edit-from-view">Editar Ficha</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#modal-btn-close').addEventListener('click', () => modal.close());
        dialog.querySelector('#modal-btn-edit-from-view').addEventListener('click', () => {
          modal.close();
          this.openFormModal(id);
        });
      }
    });
  }
}
