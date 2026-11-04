/**
 * Vista: Sistema de Alertas Hídricas (WaterAlertsView — Sección 9)
 * Consulta, filtrado, atención de alertas generadas sobre datos reales y configuración de reglas.
 */

import { WaterAlertsService } from '../../application/water-alerts.service.js';
import {
  WATER_ALERT_TYPES,
  WATER_ALERT_PRIORITIES,
  WATER_ALERT_STATUSES
} from '../../domain/models/WaterAlert.js';
import { formatDateTime } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { renderStatusBadge } from '../components/status-badge.js';
import { renderEmptyState } from '../components/empty-state.js';

export class WaterAlertsView {
  constructor(router) {
    this.router = router;
    this.alerts = [];
    this.filters = {
      status: 'all',
      priority: 'all',
      type: 'all'
    };
  }

  async render(container) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;" class="text-muted">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
        <p>Evaluando reglas de alertas hídricas sobre registros territoriales...</p>
      </div>
    `;

    container.innerHTML = `
      <div class="water-alerts-view">
        <div class="view-header d-flex justify-between align-center mb-4">
          <div>
            <h2><i class="fa-solid fa-bell" style="color: var(--color-warning);"></i> Sistema de Alertas Hídricas Territoriales</h2>
            <p class="text-muted">Monitoreo automático basado en reglas configurables sobre disponibilidad de fuentes, variaciones de nivel y precipitaciones reales.</p>
          </div>
          <div class="d-flex gap-2" style="flex-wrap: wrap;">
            <button class="btn btn-outline" id="btn-alerts-config-rules">
              <span><i class="fa-solid fa-sliders"></i> Configurar Umbrales y Reglas</span>
            </button>
            <button class="btn btn-primary" id="btn-alerts-refresh">
              <span><i class="fa-solid fa-arrows-rotate"></i> Reevaluar Alertas</span>
            </button>
          </div>
        </div>

        <!-- Resumen de Alertas -->
        <div id="water-alerts-summary" class="mb-4"></div>

        <!-- Barra de Filtros -->
        <div class="filter-bar mb-4">
          <select class="form-control filter-select" id="alert-filter-status">
            <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>Todos los estados (Activas y Atendidas)</option>
            ${Object.entries(WATER_ALERT_STATUSES).map(([k, v]) => `
              <option value="${k}" ${this.filters.status === k ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('')}
          </select>

          <select class="form-control filter-select" id="alert-filter-priority">
            <option value="all" ${this.filters.priority === 'all' ? 'selected' : ''}>Todas las prioridades</option>
            ${Object.entries(WATER_ALERT_PRIORITIES).map(([k, v]) => `
              <option value="${k}" ${this.filters.priority === k ? 'selected' : ''}>Prioridad: ${escapeHtml(v)}</option>
            `).join('')}
          </select>

          <select class="form-control filter-select" id="alert-filter-type">
            <option value="all" ${this.filters.type === 'all' ? 'selected' : ''}>Todos los tipos de alerta</option>
            ${Object.entries(WATER_ALERT_TYPES).map(([k, v]) => `
              <option value="${k}" ${this.filters.type === k ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('')}
          </select>

          <button class="btn btn-outline btn-sm" id="btn-alert-clear-filters">Limpiar Filtros</button>
        </div>

        <!-- Lista de Alertas -->
        <div id="water-alerts-list-container"></div>
      </div>
    `;

    this._bindEvents(container);
    await this._loadData();
  }

  async _loadData() {
    const allAlerts = await WaterAlertsService.evaluateAndGetAlerts({});
    const filtered = await WaterAlertsService.evaluateAndGetAlerts(this.filters);
    this.alerts = filtered;

    this._renderSummary(allAlerts);
    this._renderAlertsList(filtered);
  }

  _renderSummary(allAlerts) {
    const box = document.getElementById('water-alerts-summary');
    if (!box) return;

    const activeCount = allAlerts.filter(a => a.status === 'activa').length;
    const criticalOrHighCount = allAlerts.filter(a => a.status === 'activa' && (a.priority === 'critica' || a.priority === 'alta')).length;
    const resolvedCount = allAlerts.filter(a => a.status === 'atendida').length;

    box.innerHTML = `
      <div class="dashboard-metrics-grid">
        <div class="metric-card">
          <div class="metric-icon-box site"><i class="fa-solid fa-bell"></i></div>
          <div class="metric-info">
            <span class="metric-value">${activeCount}</span>
            <span class="metric-label">Alertas Activas</span>
            <span class="metric-sub">Pendientes de atención</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box water"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="metric-info">
            <span class="metric-value">${criticalOrHighCount}</span>
            <span class="metric-label">Prioridad Crítica o Alta</span>
            <span class="metric-sub">Requieren seguimiento prioritario</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box agro"><i class="fa-solid fa-check-double"></i></div>
          <div class="metric-info">
            <span class="metric-value">${resolvedCount}</span>
            <span class="metric-label">Alertas Atendidas</span>
            <span class="metric-sub">Con registro de resolución</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderAlertsList(alerts) {
    const container = document.getElementById('water-alerts-list-container');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body">
            ${renderEmptyState({
              icon: '<i class="fa-solid fa-shield-heart"></i>',
              title: 'No hay alertas hídricas registradas para este filtro',
              description: 'El sistema solo genera alertas cuando existen datos reales de fuentes, mediciones de nivel o precipitaciones que superan los umbrales configurados.'
            })}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
        ${alerts.map(alert => {
          const isResolved = alert.status === 'atendida';
          const borderColor = isResolved
            ? 'var(--color-green-600)'
            : alert.priority === 'critica'
              ? 'var(--color-danger)'
              : alert.priority === 'alta'
                ? '#e07a5f'
                : 'var(--color-warning)';

          return `
            <div class="card" style="border-left: 5px solid ${borderColor};">
              <div class="card-body" style="padding: var(--spacing-4);">
                <div class="d-flex justify-between align-center mb-2" style="flex-wrap: wrap; gap: 8px;">
                  <div class="d-flex align-center gap-2" style="flex-wrap: wrap;">
                    ${renderStatusBadge(alert.priority)}
                    <strong>${escapeHtml(WATER_ALERT_TYPES[alert.type] || alert.type)}</strong>
                    <code style="font-size: 0.72rem; color: var(--color-neutral-500);">ID: ${escapeHtml(alert.id.slice(0, 8))}</code>
                  </div>
                  <div class="d-flex align-center gap-2">
                    ${renderStatusBadge(alert.status)}
                    <span class="text-muted" style="font-size: 0.78rem;">
                      <i class="fa-regular fa-clock"></i> Generada: ${formatDateTime(alert.generatedAt)}
                    </span>
                  </div>
                </div>

                <p style="font-size: 0.92rem; margin: 6px 0;">${escapeHtml(alert.description)}</p>

                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; margin: 8px 0;">
                  <div><strong>Entidad relacionada:</strong> ${escapeHtml(alert.relatedEntityName || 'Territorio general')}</div>
                  <div><strong>Regla que la originó:</strong> ${escapeHtml(alert.ruleDescription)}</div>
                  ${isResolved && alert.resolvedAt ? `
                    <div style="color: var(--color-green-700); margin-top: 4px;">
                      <i class="fa-solid fa-check"></i> <strong>Atendida el ${formatDateTime(alert.resolvedAt)}:</strong> ${escapeHtml(alert.resolutionNotes || 'Resuelta')}
                    </div>
                  ` : ''}
                </div>

                <div class="d-flex justify-between align-center gap-2" style="margin-top: 10px; flex-wrap: wrap;">
                  <div>
                    ${alert.relatedEntityType === 'water_source' && alert.relatedEntityId ? `
                      <button class="btn btn-outline btn-sm btn-alert-goto-source" data-source-id="${alert.relatedEntityId}">
                        <i class="fa-solid fa-file-lines"></i> Ver Ficha de Disponibilidad
                      </button>
                    ` : ''}
                    ${alert.relatedEntityType === 'pluviometer' && alert.relatedEntityId ? `
                      <button class="btn btn-outline btn-sm btn-alert-goto-pluv" data-pluv-id="${alert.relatedEntityId}">
                        <i class="fa-solid fa-cloud-rain"></i> Ver Pluviómetro
                      </button>
                    ` : ''}
                  </div>

                  <div>
                    ${!isResolved ? `
                      <button class="btn btn-primary btn-sm btn-resolve-alert" data-id="${alert.id}">
                        <i class="fa-solid fa-check"></i> Marcar como Atendida
                      </button>
                    ` : `
                      <button class="btn btn-outline btn-sm btn-reopen-alert" data-id="${alert.id}">
                        <i class="fa-solid fa-rotate-left"></i> Reabrir Alerta
                      </button>
                    `}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.btn-alert-goto-source').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('water-availability', { sourceId: btn.dataset.sourceId, openSheet: true });
      });
    });

    container.querySelectorAll('.btn-alert-goto-pluv').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('rainfall');
      });
    });

    container.querySelectorAll('.btn-resolve-alert').forEach(btn => {
      btn.addEventListener('click', () => this.openResolveModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-reopen-alert').forEach(btn => {
      btn.addEventListener('click', async () => {
        await WaterAlertsService.reopenAlert(btn.dataset.id);
        notification.info('Alerta reabierta', 'La alerta volvió al estado pendiente de atención.');
        await this._loadData();
      });
    });
  }

  openResolveModal(alertId) {
    modal.open({
      title: 'Marcar Alerta Hídrica como Atendida',
      size: 'md',
      contentHtml: `
        <div class="form-group">
          <label class="form-label" for="alert-res-notes">Acción tomada u observación de atención (opcional):</label>
          <textarea id="alert-res-notes" class="form-control" rows="3"
                    placeholder="Ej: Se realizó visita de verificación en campo y medición actualizada con el comité local."></textarea>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-outline" id="btn-res-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-res-confirm"><i class="fa-solid fa-check"></i> Confirmar Atención</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-res-cancel').addEventListener('click', () => modal.close());
        dialog.querySelector('#btn-res-confirm').addEventListener('click', async () => {
          const notes = dialog.querySelector('#alert-res-notes').value;
          await WaterAlertsService.markAsResolved(alertId, notes);
          modal.close();
          notification.success('Alerta atendida', 'Se registró la fecha de resolución y nota de seguimiento.');
          await this._loadData();
        });
      }
    });
  }

  openConfigRulesModal() {
    const currentRules = WaterAlertsService.getRulesConfig();

    modal.open({
      title: 'Configurar Reglas y Umbrales de Alertas Hídricas',
      size: 'md',
      contentHtml: `
        <form id="form-alert-rules">
          <div class="form-group">
            <label class="form-label" for="rule-drop-pct">Umbral de disminución significativa de nivel entre mediciones (%):</label>
            <input type="number" min="5" max="90" id="rule-drop-pct" class="form-control" value="${currentRules.significantDropThresholdPct}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rule-stale-days">Días máximos sin nuevas mediciones hídricas en fuente monitoreada:</label>
            <input type="number" min="7" max="180" id="rule-stale-days" class="form-control" value="${currentRules.maxDaysWithoutMeasurement}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rule-low-storage">Umbral de riesgo por baja capacidad de almacenamiento (%):</label>
            <input type="number" min="5" max="60" id="rule-low-storage" class="form-control" value="${currentRules.lowStorageCapacityThresholdPct}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rule-low-rain">Precipitación mensual mínima esperada por pluviómetro (mm):</label>
            <input type="number" min="5" max="300" id="rule-low-rain" class="form-control" value="${currentRules.minMonthlyRainfallThresholdMm}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rule-outdated-days">Días para alerta de información de fuente desactualizada:</label>
            <input type="number" min="15" max="365" id="rule-outdated-days" class="form-control" value="${currentRules.outdatedEntityDays}" />
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-outline" id="btn-rules-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-rules-save">Guardar Reglas y Reevaluar</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-rules-cancel').addEventListener('click', () => modal.close());
        dialog.querySelector('#btn-rules-save').addEventListener('click', async () => {
          WaterAlertsService.saveRulesConfig({
            significantDropThresholdPct: dialog.querySelector('#rule-drop-pct').value,
            maxDaysWithoutMeasurement: dialog.querySelector('#rule-stale-days').value,
            lowStorageCapacityThresholdPct: dialog.querySelector('#rule-low-storage').value,
            minMonthlyRainfallThresholdMm: dialog.querySelector('#rule-low-rain').value,
            outdatedEntityDays: dialog.querySelector('#rule-outdated-days').value
          });
          modal.close();
          notification.success('Reglas actualizadas', 'Se guardaron los umbrales y se reevaluaron las alertas.');
          await this._loadData();
        });
      }
    });
  }

  _bindEvents(container) {
    const configBtn = container.querySelector('#btn-alerts-config-rules');
    const refreshBtn = container.querySelector('#btn-alerts-refresh');
    const statusSel = container.querySelector('#alert-filter-status');
    const prioritySel = container.querySelector('#alert-filter-priority');
    const typeSel = container.querySelector('#alert-filter-type');
    const clearBtn = container.querySelector('#btn-alert-clear-filters');

    if (configBtn) configBtn.addEventListener('click', () => this.openConfigRulesModal());
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this._loadData();
        notification.info('Alertas verificadas', 'Se evaluaron las reglas sobre los datos actuales.');
      });
    }

    const onFilter = () => {
      this.filters.status = statusSel ? statusSel.value : 'all';
      this.filters.priority = prioritySel ? prioritySel.value : 'all';
      this.filters.type = typeSel ? typeSel.value : 'all';
      this._loadData();
    };

    if (statusSel) statusSel.addEventListener('change', onFilter);
    if (prioritySel) prioritySel.addEventListener('change', onFilter);
    if (typeSel) typeSel.addEventListener('change', onFilter);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.filters = { status: 'all', priority: 'all', type: 'all' };
        if (statusSel) statusSel.value = 'all';
        if (prioritySel) prioritySel.value = 'all';
        if (typeSel) typeSel.value = 'all';
        this._loadData();
      });
    }
  }
}

