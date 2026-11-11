/**
 * Vista: Parcelas y Cultivos (Parcels & Crops View)
 */

import { ParcelsService } from '../../application/parcels.service.js';
import { SitesService } from '../../application/sites.service.js';
import { PARCEL_STATUSES, AREA_UNITS } from '../../domain/models/Parcel.js';
import { CROP_STATUSES } from '../../domain/models/Crop.js';
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
import { formatDate, todayDateInput } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';

export class ParcelsView {
  constructor(router) {
    this.router = router;
    this.activeTab = 'parcels'; // 'parcels' | 'crops'
    this.dataTable = null;
    this.sites = [];
    this.parcels = [];
  }

  async render(container) {
    this.sites = await SitesService.getAll();
    this.parcels = await ParcelsService.getAll();

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Condiciones Productivas: Parcelas y Cultivos</h2>
          <p class="text-muted">Registro de predios y cultivos territoriales para relacionar la demanda productiva con las lluvias.</p>
        </div>
        <button class="btn btn-primary" id="btn-create-parcel-crop">
          <span id="btn-create-label">Nueva Parcela</span>
        </button>
      </div>

      <!-- Pestañas de Navegación -->
      <div class="nav-tabs">
        <button class="nav-tab-btn ${this.activeTab === 'parcels' ? 'active' : ''}" id="tab-btn-parcels">
          Parcelas (${this.parcels.length})
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'crops' ? 'active' : ''}" id="tab-btn-crops">
          Cultivos Registrados
        </button>
      </div>

      <!-- Contenedor dinámico de la tabla -->
      <div id="parcels-crops-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);
  }

  async _loadData() {
    const siteMap = new Map(this.sites.map(s => [s.id, s.name]));

    if (this.activeTab === 'parcels') {
      this.parcels = await ParcelsService.getAll();
      const enriched = this.parcels.map(p => ({
        ...p,
        siteName: siteMap.get(p.siteId) || 'Sin asignar',
        statusBadge: renderStatusBadge(p.status),
        areaDisplay: p.area !== null ? `${p.area} ${p.areaUnit === 'hectareas' ? 'ha' : 'm²'}` : 'No registrada',
        coordsDisplay: formatCoordinates(p.latitude, p.longitude)
      }));

      this.dataTable = new DataTable({
        columns: [
          { key: 'code', label: 'Código', render: (p) => `<code data-allow-copy="true" class="allow-copy" title="Código habilitado para copia">${escapeHtml(p.code)}</code>` },
          { key: 'name', label: 'Nombre de Parcela' },
          { key: 'siteName', label: 'Comunidad / Vereda' },
          { key: 'responsible', label: 'Productor / Responsable', render: (p) => escapeHtml(p.responsible || '—') },
          { key: 'areaDisplay', label: 'Área' },
          { key: 'statusBadge', label: 'Estado', render: (p) => p.statusBadge },
          { key: 'coordsDisplay', label: 'Coordenadas', render: (p) => `<span data-allow-copy="true" class="allow-copy" title="Coordenadas habilitadas para copia">${escapeHtml(p.coordsDisplay)}</span>` },
          {
            key: 'actions',
            label: 'Acciones',
            render: (p) => `
              <div class="table-actions">
                <button class="btn btn-blue btn-sm btn-add-crop" data-id="${p.id}" title="Sembrar cultivo">Sembrar</button>
                <button class="btn btn-outline btn-sm btn-edit-parcel" data-id="${p.id}" title="Editar">Editar</button>
                <button class="btn btn-outline btn-sm btn-delete-parcel" data-id="${p.id}" title="Eliminar">Eliminar</button>
              </div>
            `
          }
        ],
        emptyTitle: 'No hay parcelas registradas',
        emptyDescription: 'Registre las fincas o parcelas comunitarias para vincularlas con las observaciones y precipitaciones.'
      });

      this.dataTable.setItems(enriched);
    } else {
      // Pestaña Cultivos
      const crops = await ParcelsService.getCrops();
      const parcelMap = new Map(this.parcels.map(p => [p.id, p]));

      const enriched = crops.map(c => {
        const parcel = parcelMap.get(c.parcelId);
        return {
          ...c,
          parcelName: parcel ? `${parcel.code} — ${parcel.name}` : c.parcelId,
          plantDateFormatted: formatDate(c.plantDate),
          cropAreaDisplay: c.cropArea !== null ? `${c.cropArea} ha` : '—',
          statusBadge: renderStatusBadge(c.status)
        };
      });

      this.dataTable = new DataTable({
        columns: [
          { key: 'name', label: 'Cultivo / Rubro' },
          { key: 'parcelName', label: 'Parcela Asociada' },
          { key: 'plantDateFormatted', label: 'Fecha Siembra' },
          { key: 'cropAreaDisplay', label: 'Área Sembrada' },
          { key: 'statusBadge', label: 'Estado', render: (c) => c.statusBadge },
          { key: 'notes', label: 'Notas de Desarrollo', render: (c) => escapeHtml(c.notes || '—') },
          {
            key: 'actions',
            label: 'Acciones',
            render: (c) => `
              <div class="table-actions">
                <button class="btn btn-outline btn-sm btn-edit-crop" data-id="${c.id}" title="Editar">Editar</button>
                <button class="btn btn-outline btn-sm btn-delete-crop" data-id="${c.id}" title="Eliminar">Eliminar</button>
              </div>
            `
          }
        ],
        emptyTitle: 'No hay cultivos registrados',
        emptyDescription: 'Agregue los cultivos establecidos (ñame, yuca, maíz, hortalizas) vinculados a sus parcelas.'
      });

      this.dataTable.setItems(enriched);
    }

    const container = document.getElementById('parcels-crops-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActions(container));
      this._bindTableActions(container);
    }
  }

  _setupTable(container) {
    this._loadData();
  }

  _bindTableActions(container) {
    if (this.activeTab === 'parcels') {
      container.querySelectorAll('.btn-add-crop').forEach(btn => {
        btn.addEventListener('click', () => this.openCropModal(null, btn.dataset.id));
      });

      container.querySelectorAll('.btn-edit-parcel').forEach(btn => {
        btn.addEventListener('click', () => this.openParcelModal(btn.dataset.id));
      });

      container.querySelectorAll('.btn-delete-parcel').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const parcel = await ParcelsService.getById(id);
          if (!parcel) return;

          const confirmed = await modal.confirm({
            title: `Eliminar Parcela: ${parcel.name}`,
            message: `¿Desea eliminar la parcela "${parcel.name}"? Si tiene cultivos registrados, la regla de integridad referencial bloqueará la acción.`,
            confirmText: 'Intentar Eliminar',
            isDanger: true
          });

          if (confirmed) {
            try {
              await ParcelsService.delete(id);
              notification.success('Parcela eliminada', 'El registro fue retirado exitosamente.');
              this._loadData();
            } catch (err) {
              notification.error('Operación bloqueada', err.message);
            }
          }
        });
      });
    } else {
      // Acciones cultivos
      container.querySelectorAll('.btn-edit-crop').forEach(btn => {
        btn.addEventListener('click', () => this.openCropModal(btn.dataset.id));
      });

      container.querySelectorAll('.btn-delete-crop').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const confirmed = await modal.confirm({
            title: 'Eliminar Cultivo',
            message: '¿Está seguro de eliminar este registro de cultivo?',
            confirmText: 'Eliminar',
            isDanger: true
          });

          if (confirmed) {
            await ParcelsService.deleteCrop(id);
            notification.success('Cultivo eliminado', 'El cultivo fue retirado.');
            this._loadData();
          }
        });
      });
    }
  }

  _bindEvents(container) {
    const tabParcels = container.querySelector('#tab-btn-parcels');
    const tabCrops = container.querySelector('#tab-btn-crops');
    const createBtn = container.querySelector('#btn-create-parcel-crop');
    const createLabel = container.querySelector('#btn-create-label');

    if (tabParcels) {
      tabParcels.addEventListener('click', () => {
        this.activeTab = 'parcels';
        tabParcels.classList.add('active');
        if (tabCrops) tabCrops.classList.remove('active');
        if (createLabel) createLabel.textContent = 'Nueva Parcela';
        this._loadData();
      });
    }

    if (tabCrops) {
      tabCrops.addEventListener('click', () => {
        this.activeTab = 'crops';
        tabCrops.classList.add('active');
        if (tabParcels) tabParcels.classList.remove('active');
        if (createLabel) createLabel.textContent = 'Nuevo Cultivo';
        this._loadData();
      });
    }

    if (createBtn) {
      createBtn.addEventListener('click', () => {
        if (this.activeTab === 'parcels') {
          this.openParcelModal();
        } else {
          this.openCropModal();
        }
      });
    }
  }

  async openParcelModal(id = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await ParcelsService.getById(id) : null;

    const siteOptions = [
      { value: '', label: '— Seleccionar comunidad (opcional) —' },
      ...this.sites.map(s => ({ value: s.id, label: `${s.name} (${s.municipality})` }))
    ];

    const statusOptions = Object.entries(PARCEL_STATUSES).map(([k, v]) => ({ value: k, label: v }));
    const areaUnitOptions = Object.entries(AREA_UNITS).map(([k, v]) => ({ value: k, label: v }));

    const contentHtml = `
      <form id="form-parcel">
        <div class="form-grid-2">
          ${renderTextField({
            id: 'par-code',
            label: 'Código de Parcela',
            value: current ? current.code : '',
            placeholder: 'Ej: PARC-ESPERANZA-01',
            required: true
          })}

          ${renderTextField({
            id: 'par-name',
            label: 'Nombre de la Parcela o Predio',
            value: current ? current.name : '',
            placeholder: 'Ej: Lote Los Mangos',
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderSelectField({
            id: 'par-site',
            label: 'Comunidad o Vereda',
            value: current ? (current.siteId || '') : '',
            options: siteOptions
          })}

          ${renderTextField({
            id: 'par-responsible',
            label: 'Productor / Propietario',
            value: current ? current.responsible : '',
            placeholder: 'Nombre del productor'
          })}
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'par-area',
            label: 'Área Estimada (opcional)',
            value: current ? current.area : '',
            type: 'number',
            step: '0.1',
            placeholder: 'Ej: 2.5'
          })}

          ${renderSelectField({
            id: 'par-area-unit',
            label: 'Unidad de Medida',
            value: current ? current.areaUnit : 'hectareas',
            options: areaUnitOptions
          })}
        </div>

        ${renderSelectField({
          id: 'par-status',
          label: 'Estado Productivo',
          value: current ? current.status : 'activa',
          options: statusOptions,
          required: true
        })}

        ${renderCoordinatesPicker({
          latId: 'par-lat',
          lonId: 'par-lon',
          latitude: current ? current.latitude : '',
          longitude: current ? current.longitude : ''
        })}

        ${renderTextareaField({
          id: 'par-notes',
          label: 'Observaciones',
          value: current ? current.notes : '',
          placeholder: 'Tipo de suelo, pendiente, drenaje natural...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Parcela' : 'Registrar Nueva Parcela',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Parcela' : 'Guardar Parcela'}</button>
      `,
      onMount: (dialog) => {
        bindCoordinatesPickerEvents(dialog, { latId: 'par-lat', lonId: 'par-lon' });

        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              code: dialog.querySelector('#par-code').value,
              name: dialog.querySelector('#par-name').value,
              siteId: dialog.querySelector('#par-site').value || null,
              responsible: dialog.querySelector('#par-responsible').value,
              area: dialog.querySelector('#par-area').value || null,
              areaUnit: dialog.querySelector('#par-area-unit').value,
              status: dialog.querySelector('#par-status').value,
              latitude: dialog.querySelector('#par-lat').value || null,
              longitude: dialog.querySelector('#par-lon').value || null,
              notes: dialog.querySelector('#par-notes').value
            };

            if (isEdit) {
              await ParcelsService.update(id, formData);
              notification.success('Parcela actualizada', 'Los datos fueron guardados exitosamente.');
            } else {
              await ParcelsService.create(formData);
              notification.success('Parcela creada', 'La parcela fue registrada en la base local.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Parcela' : 'Guardar Parcela';
          }
        });
      }
    });
  }

  async openCropModal(id = null, preselectedParcelId = null) {
    if (this.parcels.length === 0) {
      notification.warning('Sin parcelas', 'Debe registrar primero una parcela antes de vincular un cultivo.');
      this.openParcelModal();
      return;
    }

    const isEdit = Boolean(id);
    let current = null;
    if (isEdit) {
      const allCrops = await ParcelsService.getCrops();
      current = allCrops.find(c => c.id === id);
    }

    const parcelOptions = this.parcels.map(p => ({
      value: p.id,
      label: `${p.code} — ${p.name}`
    }));

    const statusOptions = Object.entries(CROP_STATUSES).map(([k, v]) => ({ value: k, label: v }));

    const contentHtml = `
      <form id="form-crop">
        ${renderSelectField({
          id: 'crop-parcel',
          label: 'Parcela Asociada',
          value: current ? current.parcelId : (preselectedParcelId || (this.parcels[0] ? this.parcels[0].id : '')),
          options: parcelOptions,
          required: true
        })}

        <div class="form-grid-2">
          ${renderTextField({
            id: 'crop-name',
            label: 'Nombre del Cultivo',
            value: current ? current.name : '',
            placeholder: 'Ej: Ñame Diamante, Yuca, Maíz...',
            required: true
          })}

          ${renderSelectField({
            id: 'crop-status',
            label: 'Estado del Cultivo',
            value: current ? current.status : 'activo',
            options: statusOptions,
            required: true
          })}
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'crop-date',
            label: 'Fecha de Siembra (opcional)',
            value: current && current.plantDate ? current.plantDate : '',
            type: 'date'
          })}

          ${renderTextField({
            id: 'crop-area',
            label: 'Área Sembrada (ha, opcional)',
            value: current ? current.cropArea : '',
            type: 'number',
            step: '0.1',
            placeholder: 'Ej: 1.0'
          })}
        </div>

        ${renderTextareaField({
          id: 'crop-notes',
          label: 'Notas del Cultivo',
          value: current ? current.notes : '',
          placeholder: 'Fase vegetativa, vigor, requerimiento hídrico observado...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Cultivo' : 'Registrar Nuevo Cultivo',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Cultivo' : 'Guardar Cultivo'}</button>
      `,
      onMount: (dialog) => {
        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const formData = {
              parcelId: dialog.querySelector('#crop-parcel').value,
              name: dialog.querySelector('#crop-name').value,
              status: dialog.querySelector('#crop-status').value,
              plantDate: dialog.querySelector('#crop-date').value || null,
              cropArea: dialog.querySelector('#crop-area').value || null,
              notes: dialog.querySelector('#crop-notes').value
            };

            if (isEdit) {
              await ParcelsService.updateCrop(id, formData);
              notification.success('Cultivo actualizado', 'Datos modificados con éxito.');
            } else {
              await ParcelsService.createCrop(formData);
              notification.success('Cultivo registrado', 'El cultivo fue vinculado a la parcela.');
            }

            modal.close();
            this._loadData();
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Cultivo' : 'Guardar Cultivo';
          }
        });
      }
    });
  }
}
