/**
 * Vista: Registro de Lluvias (Rainfall View)
 */

import { RainfallService } from '../../application/rainfall.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { MEASUREMENT_TYPES } from '../../domain/models/RainfallRecord.js';
import { DataTable } from '../components/data-table.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import {
  renderTextField,
  renderSelectField,
  renderTextareaField
} from '../components/form-field.js';
import {
  todayDateInput,
  nowTimeInput,
  combineDateTimeToIso,
  formatDateTime,
  getMonthName
} from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';

export class RainfallView {
  constructor(router) {
    this.router = router;
    this.dataTable = null;
    this.pluviometers = [];
    this.chartInstance = null;
    this.chartMode = 'daily'; // 'daily' | 'monthly'
    this.currentFilters = {
      pluviometerId: 'all',
      startDate: '',
      endDate: '',
      responsible: ''
    };
  }

  async render(container, params = {}) {
    this.pluviometers = await PluviometersService.getAll();

    if (params.pluviometerId) {
      this.currentFilters.pluviometerId = params.pluviometerId;
    }

    container.innerHTML = `
      <div class="view-header d-flex justify-between align-center mb-4">
        <div>
          <h2>Registro y Seguimiento de Precipitaciones</h2>
          <p class="text-muted">Captura de lecturas en milímetros (mm), acumulados diarios, mensuales y control de mediciones.</p>
        </div>
        <button class="btn btn-blue" id="btn-create-rain">
          <span><i class="fa-solid fa-plus"></i> Registrar Nueva Medición</span>
        </button>
      </div>

      <!-- Tarjetas de Resumen Estadístico del Periodo Filtrado -->
      <div class="dashboard-metrics-grid mb-4" id="rainfall-stats-bar"></div>

      <!-- Gráfico de Precipitaciones con Selector de Modo -->
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <h3 class="card-title">Comportamiento de las Precipitaciones</h3>
            <p class="card-subtitle">Visualización según datos registrados</p>
          </div>
          <div class="nav-tabs" style="margin: 0; border: none;">
            <button class="nav-tab-btn ${this.chartMode === 'daily' ? 'active' : ''}" id="btn-chart-mode-daily">Acumulado Diario</button>
            <button class="nav-tab-btn ${this.chartMode === 'monthly' ? 'active' : ''}" id="btn-chart-mode-monthly">Acumulado Mensual</button>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-wrapper">
            <canvas id="rainfall-visual-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Barra de Filtros -->
      <div class="filter-bar">
        <select class="form-control filter-select" id="rain-filter-pluv">
          <option value="all">Todos los pluviómetros</option>
          ${this.pluviometers.map(p => `
            <option value="${p.id}" ${this.currentFilters.pluviometerId === p.id ? 'selected' : ''}>
              ${escapeHtml(p.code)} — ${escapeHtml(p.name)}
            </option>
          `).join('')}
        </select>

        <div class="d-flex align-center gap-2">
          <label class="form-label" style="margin: 0; font-size: var(--font-size-xs);" for="rain-filter-start">Desde:</label>
          <input type="date" class="form-control" style="width: auto;" id="rain-filter-start" value="${this.currentFilters.startDate}" />
        </div>

        <div class="d-flex align-center gap-2">
          <label class="form-label" style="margin: 0; font-size: var(--font-size-xs);" for="rain-filter-end">Hasta:</label>
          <input type="date" class="form-control" style="width: auto;" id="rain-filter-end" value="${this.currentFilters.endDate}" />
        </div>

        <button class="btn btn-outline btn-sm" id="btn-clear-rain-filters">Limpiar Filtros</button>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="rainfall-table-container"></div>
    `;

    this._setupTable(container);
    this._bindEvents(container);

    if (params.openModal) {
      this.openFormModal(null, params.pluviometerId || null);
    }
  }

  async _loadData() {
    const stats = await RainfallService.getStatistics(this.currentFilters);
    const pluvMap = new Map(this.pluviometers.map(p => [p.id, p]));

    // Renderizar barra de métricas
    const statsBar = document.getElementById('rainfall-stats-bar');
    if (statsBar) {
      statsBar.innerHTML = `
        <div class="metric-card">
          <div class="metric-icon-box rain"><i class="fa-solid fa-umbrella"></i></div>
          <div class="metric-info">
            <span class="metric-value">${stats.totals.totalMm} <small style="font-size: 1rem;">mm</small></span>
            <span class="metric-label">Total Precipitación</span>
            <span class="metric-sub">Periodo seleccionado</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box pluv"><i class="fa-solid fa-calendar-days"></i></div>
          <div class="metric-info">
            <span class="metric-value">${stats.totals.measuredDaysCount}</span>
            <span class="metric-label">Días con Registros</span>
            <span class="metric-sub">Promedio: ${stats.totals.averageDailyMm} mm/día</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box water"><i class="fa-solid fa-cloud-bolt"></i></div>
          <div class="metric-info">
            <span class="metric-value">${stats.totals.maxDailyMm} <small style="font-size: 1rem;">mm</small></span>
            <span class="metric-label">Lluvia Máxima en 24h</span>
            <span class="metric-sub">Mayor registro diario</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box agro"><i class="fa-solid fa-clipboard-check"></i></div>
          <div class="metric-info">
            <span class="metric-value">${stats.records.length}</span>
            <span class="metric-label">Lecturas Totales</span>
            <span class="metric-sub">En base de datos</span>
          </div>
        </div>
      `;
    }

    // Actualizar gráfico
    this._updateChart(stats);

    // Enriquecer registros para la tabla
    const enriched = stats.records.map(r => {
      const pluv = pluvMap.get(r.pluviometerId);
      return {
        ...r,
        pluviometerCode: pluv ? pluv.code : '—',
        pluviometerName: pluv ? pluv.name : r.pluviometerId,
        dateFormatted: formatDateTime(r.measuredAt),
        typeLabel: MEASUREMENT_TYPES[r.measurementType] || r.measurementType
      };
    });

    this.dataTable.setItems(enriched);
    const container = document.getElementById('rainfall-table-container');
    if (container) {
      container.innerHTML = this.dataTable.render();
      this.dataTable.bindEvents(container, () => this._bindTableActionButtons(container));
      this._bindTableActionButtons(container);
    }
  }

  _setupTable(container) {
    this.dataTable = new DataTable({
      columns: [
        { key: 'dateFormatted', label: 'Fecha y Hora de Medición' },
        { key: 'precipitationMm', label: 'Precipitación', render: (r) => `<strong>${r.precipitationMm} mm</strong>` },
        { key: 'pluviometerCode', label: 'Cód. Pluviómetro' },
        { key: 'pluviometerName', label: 'Nombre Equipo' },
        { key: 'typeLabel', label: 'Tipo Medición' },
        { key: 'responsible', label: 'Responsable', render: (r) => escapeHtml(r.responsible || '—') },
        {
          key: 'actions',
          label: 'Acciones',
          render: (item) => `
            <div class="table-actions">
              <button class="btn btn-outline btn-sm btn-edit-rain" data-id="${item.id}" title="Editar medición"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn btn-outline btn-sm btn-delete-rain" data-id="${item.id}" title="Eliminar medición"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          `
        }
      ],
      emptyTitle: 'No se encontraron mediciones de lluvia',
      emptyDescription: 'Utilice el botón «Registrar Nueva Medición» para capturar las lecturas de los pluviómetros.'
    });

    this._loadData();
  }

  _bindTableActionButtons(container) {
    container.querySelectorAll('.btn-edit-rain').forEach(btn => {
      btn.addEventListener('click', () => this.openFormModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-delete-rain').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const confirmed = await modal.confirm({
          title: 'Eliminar Medición de Lluvia',
          message: '¿Está seguro de eliminar esta lectura de precipitación? Esta acción modificará los acumulados del pluviómetro.',
          confirmText: 'Eliminar Registro',
          isDanger: true
        });

        if (confirmed) {
          await RainfallService.delete(id);
          notification.success('Registro eliminado', 'La medición de lluvia fue eliminada correctamente.');
          this._loadData();
        }
      });
    });
  }

  _bindEvents(container) {
    const createBtn = container.querySelector('#btn-create-rain');
    const pluvSelect = container.querySelector('#rain-filter-pluv');
    const startInput = container.querySelector('#rain-filter-start');
    const endInput = container.querySelector('#rain-filter-end');
    const clearBtn = container.querySelector('#btn-clear-rain-filters');

    const modeDailyBtn = container.querySelector('#btn-chart-mode-daily');
    const modeMonthlyBtn = container.querySelector('#btn-chart-mode-monthly');

    if (createBtn) createBtn.addEventListener('click', () => this.openFormModal());

    const applyFilters = () => {
      this.currentFilters.pluviometerId = pluvSelect.value;
      this.currentFilters.startDate = startInput.value;
      this.currentFilters.endDate = endInput.value;
      this._loadData();
    };

    if (pluvSelect) pluvSelect.addEventListener('change', applyFilters);
    if (startInput) startInput.addEventListener('change', applyFilters);
    if (endInput) endInput.addEventListener('change', applyFilters);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.currentFilters = { pluviometerId: 'all', startDate: '', endDate: '', responsible: '' };
        pluvSelect.value = 'all';
        startInput.value = '';
        endInput.value = '';
        this._loadData();
      });
    }

    if (modeDailyBtn) {
      modeDailyBtn.addEventListener('click', () => {
        this.chartMode = 'daily';
        modeDailyBtn.classList.add('active');
        if (modeMonthlyBtn) modeMonthlyBtn.classList.remove('active');
        this._loadData();
      });
    }

    if (modeMonthlyBtn) {
      modeMonthlyBtn.addEventListener('click', () => {
        this.chartMode = 'monthly';
        modeMonthlyBtn.classList.add('active');
        if (modeDailyBtn) modeDailyBtn.classList.remove('active');
        this._loadData();
      });
    }
  }

  _updateChart(stats) {
    const canvas = document.getElementById('rainfall-visual-chart');
    if (!canvas || typeof window === 'undefined' || !window.Chart) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    let labels = [];
    let values = [];

    if (this.chartMode === 'monthly') {
      const sortedMonths = Object.keys(stats.monthly).sort();
      labels = sortedMonths.map(m => getMonthName(m));
      values = sortedMonths.map(m => stats.monthly[m].totalMm);
    } else {
      const sortedDays = Object.keys(stats.daily).sort();
      labels = sortedDays;
      values = sortedDays.map(d => stats.daily[d].totalMm);
    }

    try {
      this.chartInstance = new window.Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: this.chartMode === 'monthly' ? 'Total Mensual (mm)' : 'Total Diario (mm)',
            data: values,
            backgroundColor: '#0077b6',
            borderColor: '#023e8a',
            borderWidth: 1.5,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              callbacks: {
                label: (ctx) => `Lluvia: ${ctx.parsed.y} mm`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Milímetros (mm)' }
            },
            x: {
              title: { display: true, text: this.chartMode === 'monthly' ? 'Meses registrados' : 'Días registrados' }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error inicializando gráfico de lluvia', e);
    }
  }

  async openFormModal(id = null, preselectedPluviometerId = null) {
    const isEdit = Boolean(id);
    const current = isEdit ? await RainfallService.getById(id) : null;

    if (this.pluviometers.length === 0) {
      notification.warning(
        'Sin pluviómetros',
        'Debe registrar al menos un pluviómetro antes de ingresar mediciones de lluvia.'
      );
      this.router.navigate('pluviometers', { openModal: true });
      return;
    }

    const pluvOptions = [
      { value: '', label: '— Seleccionar pluviómetro —' },
      ...this.pluviometers.map(p => ({
        value: p.id,
        label: `${p.code} — ${p.name} (${p.status})`
      }))
    ];

    const typeOptions = Object.entries(MEASUREMENT_TYPES).map(([k, v]) => ({ value: k, label: v }));

    let defaultDate = todayDateInput();
    let defaultTime = '07:00'; // Hora típica de toma de datos en el campo

    if (current && current.measuredAt) {
      const parts = current.measuredAt.split('T');
      defaultDate = parts[0];
      if (parts[1]) defaultTime = parts[1].substring(0, 5);
    }

    const contentHtml = `
      <form id="form-rainfall-measurement">
        ${renderSelectField({
          id: 'rf-pluv',
          label: 'Pluviómetro Asociado',
          value: current ? current.pluviometerId : (preselectedPluviometerId || ''),
          options: pluvOptions,
          required: true,
          help: 'Equipo que capturó la precipitación'
        })}

        <div class="form-grid-2">
          ${renderTextField({
            id: 'rf-date',
            label: 'Fecha de la Medición',
            value: defaultDate,
            type: 'date',
            required: true
          })}

          ${renderTextField({
            id: 'rf-time',
            label: 'Hora de la Medición',
            value: defaultTime,
            type: 'time',
            required: true,
            help: 'Lectura estándar: 7:00 AM'
          })}
        </div>

        <div class="form-grid-2">
          ${renderTextField({
            id: 'rf-mm',
            label: 'Precipitación Registrada (mm)',
            value: current ? current.precipitationMm : '',
            type: 'number',
            step: '0.1',
            min: '0',
            max: '500',
            required: true,
            placeholder: 'Ej: 14.5'
          })}

          ${renderSelectField({
            id: 'rf-type',
            label: 'Tipo de Medición',
            value: current ? current.measurementType : 'manual',
            options: typeOptions,
            required: true
          })}
        </div>

        ${renderTextField({
          id: 'rf-responsible',
          label: 'Responsable de la Lectura',
          value: current ? current.responsible : '',
          placeholder: 'Nombre del monitor o comunero'
        })}

        ${renderTextareaField({
          id: 'rf-notes',
          label: 'Observaciones de la Lluvia',
          value: current ? current.notes : '',
          placeholder: 'Detalles sobre intensidad, viento, granizo o duración de la lluvia...'
        })}
      </form>
    `;

    modal.open({
      title: isEdit ? 'Editar Medición de Lluvia' : 'Registrar Medición de Lluvia',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="modal-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-btn-save">${isEdit ? 'Actualizar Medición' : 'Guardar Medición'}</button>
      `,
      onMount: (dialog) => {
        const cancelBtn = dialog.querySelector('#modal-btn-cancel');
        const saveBtn = dialog.querySelector('#modal-btn-save');

        cancelBtn.addEventListener('click', () => modal.close());

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Verificando...';

          try {
            const dateVal = dialog.querySelector('#rf-date').value;
            const timeVal = dialog.querySelector('#rf-time').value || '07:00';
            const measuredAt = combineDateTimeToIso(dateVal, timeVal);

            const formData = {
              pluviometerId: dialog.querySelector('#rf-pluv').value,
              measuredAt,
              precipitationMm: dialog.querySelector('#rf-mm').value,
              measurementType: dialog.querySelector('#rf-type').value,
              responsible: dialog.querySelector('#rf-responsible').value,
              notes: dialog.querySelector('#rf-notes').value
            };

            if (isEdit) {
              await RainfallService.update(id, formData);
              notification.success('Medición actualizada', 'La lectura fue modificada con éxito.');
              modal.close();
              this._loadData();
            } else {
              // Intentar guardar con verificación preventiva de duplicados
              const res = await RainfallService.create(formData, false);

              if (res.warning && res.type === 'DUPLICATE_MEASUREMENT') {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar Medición';

                const confirmDuplicate = await modal.confirm({
                  title: 'Advertencia de Registro Cercano',
                  message: `${res.message}`,
                  confirmText: 'Guardar de Todos Modos',
                  cancelText: 'Volver a Revisar',
                  isDanger: false
                });

                if (confirmDuplicate) {
                  await RainfallService.create(formData, true);
                  notification.success('Medición guardada', 'El registro de lluvia fue almacenado en la base local.');
                  modal.close();
                  this._loadData();
                }
              } else {
                notification.success('Medición guardada', 'El registro de lluvia fue almacenado en la base local.');
                modal.close();
                this._loadData();
              }
            }
          } catch (err) {
            notification.error('Error al guardar', err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Actualizar Medición' : 'Guardar Medición';
          }
        });
      }
    });
  }

  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
