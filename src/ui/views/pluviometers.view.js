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
          <span><i class="fa-solid fa-cloud-rain"></i> Añadir Pluviómetro</span>
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

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre Identificador' },
        { key: 'typeLabel', label: 'Tipo de Equipo' },
        { key: 'siteName', label: 'Comunidad / Sitio' },
        { key: 'statusBadge', label: 'Estado', render: (item) => item.statusBadge },
        { key: 'coordsDisplay', label: 'Coordenadas' },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-view-pluv" data-id="${item.id}" title="Ver ficha y mediciones"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn-blue btn-sm btn-add-rain-pluv" data-id="${item.id}" title="Registrar lluvia en este equipo"><i class="fa-solid fa-cloud-rain"></i></button>
              <button class="btn btn-outline btn-sm btn-edit-pluv" data-id="${item.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-delete-pluv" data-id="${item.id}" title="Eliminar / Retirar"><i class="fa-solid fa-trash"></i></button>
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

    const siteOptions = [
      { value: '', label: '— Seleccionar comunidad (opcional) —' },
      ...this.sites.map(s => ({ value: s.id, label: `${s.name} (${s.municipality})` }))
    ];

    const typeOptions = Object.entries(PLUVIOMETER_TYPES).map(([k, v]) => ({ value: k, label: v }));
    const statusOptions = Object.entries(PLUVIOMETER_STATUSES).map(([k, v]) => ({ value: k, label: v }));

    const contentHtml = `
      <form id="form-pluviometer">
        <div class="form-grid-2">
          ${renderTextField({
            id: 'pluv-code',
            label: 'Código del Pluviómetro',
            value: current ? current.code : '',
            placeholder: 'Ej: PLUV-CARMEN-01',
            required: true,
            help: 'Identificador único rotulado en el equipo'
          })}

          ${renderTextField({
            id: 'pluv-name',
            label: 'Nombre Identificador',
            value: current ? current.name : '',
            placeholder: 'Ej: Pluviómetro Finca La Esperanza',
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderSelectField({
            id: 'pluv-type',
            label: 'Tipo de Equipo',
            value: current ? current.equipmentType : 'manual',
            options: typeOptions,
            required: true
          })}

          ${renderSelectField({
            id: 'pluv-site',
            label: 'Comunidad o Sitio Asociado',
            value: current ? (current.siteId || '') : '',
            options: siteOptions
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

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              code: dialog.querySelector('#pluv-code').value,
              name: dialog.querySelector('#pluv-name').value,
              equipmentType: dialog.querySelector('#pluv-type').value,
              siteId: dialog.querySelector('#pluv-site').value || null,
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
            <strong>Georreferenciación:</strong>
            <p>${formatCoordinates(pluv.latitude, pluv.longitude)}</p>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <div>
                <h4 style="margin: 0;">Historial de Mediciones (${measurements.length} lecturas)</h4>
                <small class="text-muted">Total acumulado registrado: ${Math.round(totalMm * 10) / 10} mm</small>
              </div>
              <button class="btn btn-blue btn-sm" id="btn-modal-add-rain">+ Nueva Medición</button>
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
      }
    });
  }
}
