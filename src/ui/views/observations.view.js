/**
 * Vista: Observaciones Hídricas (Observations View)
 */

import { ObservationsService } from '../../application/observations.service.js';
import { SitesService } from '../../application/sites.service.js';
import { WaterSourcesService } from '../../application/water-sources.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { ParcelsService } from '../../application/parcels.service.js';
import { OBSERVATION_CATEGORIES, RELATED_ENTITY_TYPES } from '../../domain/models/WaterObservation.js';
import { DataTable } from '../components/data-table.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import {
  renderTextField,
  renderSelectField,
  renderTextareaField,
  renderCoordinatesPicker,
  bindCoordinatesPickerEvents
} from '../components/form-field.js';
import { formatDateTime, nowTimeInput, todayDateInput, combineDateTimeToIso } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';

export class ObservationsView {
  constructor(router) {
    this.router = router;
    this.dataTable = null;
    this.currentFilters = { category: 'all', search: '' };
    this.sites = [];
    this.sources = [];
    this.pluvs = [];
    this.parcels = [];
  }

  async render(container) {
    const [sites, sources, pluvs, parcels] = await Promise.all([
      SitesService.getAll(),
      WaterSourcesService.getAll(),
      PluviometersService.getAll(),
      ParcelsService.getAll()
    ]);

    this.sites = sites;
    this.sources = sources;
    this.pluvs = pluvs;
    this.parcels = parcels;

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Observaciones Hídricas y Notas de Campo</h2>
          <p class="text-muted">Registro cualitativo de disponibilidad de agua, sequía, estado de fuentes y suelos en Montes de María.</p>
        </div>
        <button class="btn btn-primary" id="btn-create-obs">
          <span><i class="fa-solid fa-plus"></i> Nueva Observación</span>
        </button>
      </div>

      <!-- Barra de Filtros -->
      <div class="filter-bar">
        <input type="text" class="form-control filter-input-search" id="obs-filter-search" 
               placeholder="Buscar en descripción o responsable..." value="${escapeHtml(this.currentFilters.search)}" />

        <select class="form-control filter-select" id="obs-filter-cat">
          <option value="all">Todas las categorías</option>
          ${Object.entries(OBSERVATION_CATEGORIES).map(([k, v]) => `
            <option value="${k}" ${this.currentFilters.category === k ? 'selected' : ''}>${v}</option>
          `).join('')}
        </select>

        <button class="btn btn-outline btn-sm" id="btn-clear-obs-filters">Limpiar</button>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="obs-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);
  }

  async _loadData() {
    const list = await ObservationsService.getAll(this.currentFilters);

    const siteMap = new Map(this.sites.map(s => [s.id, s.name]));
    const sourceMap = new Map(this.sources.map(s => [s.id, s.name]));
    const pluvMap = new Map(this.pluvs.map(p => [p.id, p.name]));
    const parcelMap = new Map(this.parcels.map(p => [p.id, p.name]));

    const enriched = list.map(item => {
      let linkedName = 'Sin vinculación';
      if (item.relatedEntityType === 'site') linkedName = `Comunidad: ${siteMap.get(item.relatedEntityId) || '—'}`;
      else if (item.relatedEntityType === 'water_source') linkedName = `Fuente: ${sourceMap.get(item.relatedEntityId) || '—'}`;
      else if (item.relatedEntityType === 'pluviometer') linkedName = `Pluviómetro: ${pluvMap.get(item.relatedEntityId) || '—'}`;
      else if (item.relatedEntityType === 'parcel') linkedName = `Parcela: ${parcelMap.get(item.relatedEntityId) || '—'}`;

      return {
        ...item,
        dateFormatted: formatDateTime(item.observedAt),
        categoryLabel: OBSERVATION_CATEGORIES[item.category] || item.category,
        linkedNameDisplay: linkedName
      };
    });

    this.dataTable.setItems(enriched);
    const container = document.getElementById('obs-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActions(container));
      this._bindTableActions(container);
    }
  }

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        { key: 'dateFormatted', label: 'Fecha y Hora' },
        { key: 'categoryLabel', label: 'Categoría' },
        { key: 'description', label: 'Descripción de Campo', render: (o) => `<strong>${escapeHtml(o.description)}</strong>` },
        { key: 'linkedNameDisplay', label: 'Elemento Vinculado' },
        { key: 'responsible', label: 'Responsable', render: (o) => escapeHtml(o.responsible || '—') },
        {
          key: 'actions',
          label: 'Acciones',
          render: (o) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-edit-obs" data-id="${o.id}" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn btn-outline btn-sm btn-delete-obs" data-id="${o.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          `
        }
      ],
      emptyTitle: 'No hay observaciones registradas',
      emptyDescription: 'Capture notas cualitativas de campo sobre sequía, estado de los arroyos y humedad del suelo.'
    });

    this._loadData();
  }

  _bindTableActions(container) {
    container.querySelectorAll('.btn-edit-obs').forEach(btn => {
      btn.addEventListener('click', () => this.openFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-delete-obs').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const confirmed = await modal.confirm({
          title: 'Eliminar Observación Hídrica',
          message: '¿Está seguro de eliminar esta nota de campo?',
          confirmText: 'Eliminar',
          isDanger: true
        });

        if (confirmed) {
          await ObservationsService.delete(id);
          notification.success('Observación eliminada', 'El registro fue retirado exitosamente.');
          this._loadData();
        }
      });
    });
  }

  _bindEvents(container) {
    const createBtn = container.querySelector('#btn-create-obs');
    const searchInput = container.querySelector('#obs-filter-search');
    const catSelect = container.querySelector('#obs-filter-cat');
    const clearBtn = container.querySelector('#btn-clear-obs-filters');

    if (createBtn) createBtn.addEventListener('click', () => this.openFormModal());

    const apply = () => {
      this.currentFilters.search = searchInput.value;
      this.currentFilters.category = catSelect.value;
      this._loadData();
    };

    if (searchInput) searchInput.addEventListener('input', apply);
    if (catSelect) catSelect.addEventListener('change', apply);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.currentFilters = { search: '', category: 'all' };
        searchInput.value = '';
        catSelect.value = 'all';
        this._loadData();
      });
    }
  }

  async openFormModal(id = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await ObservationsService.getById(id) : null;

    const catOptions = Object.entries(OBSERVATION_CATEGORIES).map(([k, v]) => ({ value: k, label: v }));
    const entityTypeOptions = Object.entries(RELATED_ENTITY_TYPES).map(([k, v]) => ({ value: k, label: v }));

    let defaultDate = todayDateInput();
    let defaultTime = nowTimeInput();

    if (current && current.observedAt) {
      const parts = current.observedAt.split('T');
      defaultDate = parts[0];
      if (parts[1]) defaultTime = parts[1].substring(0, 5);
    }

    const contentHtml = `
      <form id="form-observation">
        <div class="form-grid-2">
          ${renderSelectField({
            id: 'obs-category',
            label: 'Categoría de la Observación',
            value: current ? current.category : 'disponibilidad_agua',
            options: catOptions,
            required: true
          })}

          ${renderSelectField({
            id: 'obs-entity-type',
            label: 'Vincular con Elemento',
            value: current ? current.relatedEntityType : 'none',
            options: entityTypeOptions
          })}
        </div>

        <div class="form-group" id="group-related-picker" style="display: none;">
          <label class="form-label" for="obs-entity-id">Seleccionar Elemento Específico</label>
          <select class="form-control" id="obs-entity-id">
            <option value="">— Seleccionar —</option>
          </select>
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'obs-date',
            label: 'Fecha de Observación',
            value: defaultDate,
            type: 'date',
            required: true
          })}

          ${renderTextField({
            id: 'obs-time',
            label: 'Hora de Observación',
            value: defaultTime,
            type: 'time',
            required: true
          })}
        </div>

        ${renderTextareaField({
          id: 'obs-desc',
          label: 'Descripción de lo Observado',
          value: current ? current.description : '',
          placeholder: 'Describa con precisión la situación observada en el terreno...',
          required: true
        })}

        <div class="form-grid-2">
          ${renderTextField({
            id: 'obs-status-str',
            label: 'Estado o Condición Observada',
            value: current ? current.observedStatus : '',
            placeholder: 'Ej: Caudal muy bajo, Suelo cuarteado, Fuerte escorrentía...'
          })}

          ${renderTextField({
            id: 'obs-responsible',
            label: 'Responsable de la Observación',
            value: current ? current.responsible : '',
            placeholder: 'Nombre del observador comunitario'
          })}
        </div>

        ${renderCoordinatesPicker({
          latId: 'obs-lat',
          lonId: 'obs-lon',
          latitude: current ? current.latitude : '',
          longitude: current ? current.longitude : ''
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Observación Hídrica' : 'Registrar Nueva Observación',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar' : 'Guardar Observación'}</button>
      `,
      onMount: (dialog) => {
        bindCoordinatesPickerEvents(dialog, { latId: 'obs-lat', lonId: 'obs-lon' });

        const typeSelect = dialog.querySelector('#obs-entity-type');
        const pickerGroup = dialog.querySelector('#group-related-picker');
        const idSelect = dialog.querySelector('#obs-entity-id');

        const updatePickerOptions = () => {
          const type = typeSelect.value;
          idSelect.innerHTML = '<option value="">— Seleccionar —</option>';

          if (type === 'none') {
            pickerGroup.style.display = 'none';
            return;
          }

          pickerGroup.style.display = 'block';

          let items = [];
          if (type === 'site') items = this.sites.map(s => ({ id: s.id, name: `${s.name} (${s.municipality})` }));
          else if (type === 'water_source') items = this.sources.map(s => ({ id: s.id, name: `${s.code} — ${s.name}` }));
          else if (type === 'pluviometer') items = this.pluvs.map(p => ({ id: p.id, name: `${p.code} — ${p.name}` }));
          else if (type === 'parcel') items = this.parcels.map(p => ({ id: p.id, name: `${p.code} — ${p.name}` }));

          items.forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.id;
            opt.textContent = it.name;
            if (current && current.relatedEntityId === it.id) opt.selected = true;
            idSelect.appendChild(opt);
          });
        };

        typeSelect.addEventListener('change', updatePickerOptions);
        updatePickerOptions();

        dialog.querySelector('#modal-btn-cancel').addEventListener('click', () => modal.close());

        dialog.querySelector('#modal-btn-save').addEventListener('click', async () => {
          try {
            const dateVal = dialog.querySelector('#obs-date').value;
            const timeVal = dialog.querySelector('#obs-time').value || '07:00';
            const observedAt = combineDateTimeToIso(dateVal, timeVal);

            const formData = {
              category: dialog.querySelector('#obs-category').value,
              relatedEntityType: dialog.querySelector('#obs-entity-type').value,
              relatedEntityId: dialog.querySelector('#obs-entity-id').value || null,
              observedAt,
              description: dialog.querySelector('#obs-desc').value,
              observedStatus: dialog.querySelector('#obs-status-str').value,
              responsible: dialog.querySelector('#obs-responsible').value,
              latitude: dialog.querySelector('#obs-lat').value || null,
              longitude: dialog.querySelector('#obs-lon').value || null
            };

            if (isEdit) {
              await ObservationsService.update(id, formData);
              notification.success('Observación actualizada', 'Se guardaron los cambios.');
            } else {
              await ObservationsService.create(formData);
              notification.success('Observación registrada', 'Nota de campo guardada exitosamente.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
          }
        });
      }
    });
  }
}
