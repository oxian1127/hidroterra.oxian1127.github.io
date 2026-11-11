/**
 * Vista: Sitios y Comunidades (Sites View)
 */

import { SitesService } from '../../application/sites.service.js';
import { DataTable } from '../components/data-table.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import {
  renderTextField,
  renderTextareaField,
  renderCoordinatesPicker,
  bindCoordinatesPickerEvents
} from '../components/form-field.js';
import { formatCoordinates } from '../../domain/rules/coordinates.rules.js';
import { escapeHtml } from '../../core/validators.js';

export class SitesView {
  constructor(router) {
    this.router = router;
    this.dataTable = null;
    this.currentFilters = { search: '', municipality: 'all' };
  }

  async render(container, params = {}) {
    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Sitios y Comunidades</h2>
          <p class="text-muted">Centros poblados, corregimientos, veredas y sectores territoriales de Montes de María.</p>
        </div>
        <button class="btn btn-primary" id="btn-create-site">
          <span>Nueva Comunidad / Sitio</span>
        </button>
      </div>

      <!-- Barra de Filtros -->
      <div class="filter-bar">
        <input type="text" class="form-control filter-input-search" id="site-filter-search" 
               placeholder="Buscar por nombre o municipio..." value="${escapeHtml(this.currentFilters.search)}" />

        <button class="btn btn-outline btn-sm" id="btn-clear-site-filters">Limpiar</button>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="sites-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);

    if (params.openModal) {
      this.openFormModal();
    }
  }

  async _loadData() {
    const list = await SitesService.getAll(this.currentFilters);
    const enriched = list.map(item => ({
      ...item,
      coordsDisplay: formatCoordinates(item.latitude, item.longitude)
    }));

    this.dataTable.setItems(enriched);
    const container = document.getElementById('sites-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActionButtons(container));
      this._bindTableActionButtons(container);
    }
  }

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        { key: 'name', label: 'Comunidad / Vereda' },
        { key: 'municipality', label: 'Municipio' },
        { key: 'department', label: 'Departamento' },
        { key: 'coordsDisplay', label: 'Coordenadas', render: (item) => `<span data-allow-copy="true" class="allow-copy" title="Coordenadas habilitadas para copia">${escapeHtml(item.coordsDisplay)}</span>` },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-edit-site" data-id="${item.id}" title="Editar">Editar</button>
              <button class="btn btn-outline btn-sm btn-delete-site" data-id="${item.id}" title="Eliminar">Eliminar</button>
            </div>
          `
        }
      ],
      emptyTitle: 'No hay comunidades registradas',
      emptyDescription: 'Cree las veredas o poblaciones para asociarlas con las fuentes de agua y pluviómetros.'
    });

    this._loadData();
  }

  _bindTableActionButtons(container) {
    container.querySelectorAll('.btn-edit-site').forEach(btn => {
      btn.addEventListener('click', () => this.openFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-delete-site').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const site = await SitesService.getById(id);
        if (!site) return;

        const confirmed = await modal.confirm({
          title: `Eliminar: ${site.name}`,
          message: `¿Está seguro de eliminar la comunidad "${site.name}"? Si existen fuentes de agua, pluviómetros o parcelas vinculadas, el sistema bloqueará la acción para preservar la integridad territorial.`,
          confirmText: 'Intentar Eliminar',
          isDanger: true
        });

        if (confirmed) {
          try {
            await SitesService.delete(id);
            notification.success('Comunidad eliminada', 'El sitio fue retirado exitosamente.');
            this._loadData();
          } catch (err) {
            notification.error('Operación bloqueada por integridad', err.message);
          }
        }
      });
    });
  }

  _bindEvents(container) {
    const createBtn = container.querySelector('#btn-create-site');
    const searchInput = container.querySelector('#site-filter-search');
    const clearBtn = container.querySelector('#btn-clear-site-filters');

    if (createBtn) createBtn.addEventListener('click', () => this.openFormModal());

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentFilters.search = searchInput.value;
        this._loadData();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.currentFilters = { search: '', municipality: 'all' };
        searchInput.value = '';
        this._loadData();
      });
    }
  }

  async openFormModal(id = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await SitesService.getById(id) : null;

    const contentHtml = `
      <form id="form-site">
        <div class="form-grid-2">
          ${renderTextField({
            id: 'site-name',
            label: 'Nombre de la Comunidad o Vereda',
            value: current ? current.name : '',
            placeholder: 'Ej: Vereda Caracolí',
            required: true
          })}

          ${renderTextField({
            id: 'site-municipality',
            label: 'Municipio',
            value: current ? current.municipality : 'El Carmen de Bolívar',
            placeholder: 'Ej: El Carmen de Bolívar, San Jacinto, Ovejas...',
            required: true
          })}
        </div>

        ${renderTextField({
          id: 'site-dept',
          label: 'Departamento',
          value: current ? current.department : 'Bolívar',
          required: true
        })}

        ${renderCoordinatesPicker({
          latId: 'site-lat',
          lonId: 'site-lon',
          latitude: current ? current.latitude : '',
          longitude: current ? current.longitude : ''
        })}

        ${renderTextareaField({
          id: 'site-desc',
          label: 'Descripción / Características Territoriales',
          value: current ? current.description : '',
          placeholder: 'Ubicación respecto al casco urbano, vías de acceso, condiciones fisiográficas...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Comunidad / Sitio' : 'Registrar Nueva Comunidad o Sitio',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Sitio' : 'Guardar Sitio'}</button>
      `,
      onMount: (dialog) => {
        bindCoordinatesPickerEvents(dialog, { latId: 'site-lat', lonId: 'site-lon' });

        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              name: dialog.querySelector('#site-name').value,
              municipality: dialog.querySelector('#site-municipality').value,
              department: dialog.querySelector('#site-dept').value,
              latitude: dialog.querySelector('#site-lat').value || null,
              longitude: dialog.querySelector('#site-lon').value || null,
              description: dialog.querySelector('#site-desc').value
            };

            if (isEdit) {
              await SitesService.update(id, formData);
              notification.success('Sitio actualizado', 'La información fue guardada exitosamente.');
            } else {
              await SitesService.create(formData);
              notification.success('Comunidad registrada', 'El nuevo sitio está disponible en el sistema.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Sitio' : 'Guardar Sitio';
          }
        });
      }
    });
  }
}
