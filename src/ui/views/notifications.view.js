/**
 * Vista en Pantalla Completa: Centro de Notificaciones y Avisos Territoriales (#notifications)
 * Permite visualizar en pantalla completa todas las notificaciones activas, ejecutar acciones
 * directas, descartar notificaciones individualmente o en bloque y gestionar el apartado de descartadas.
 */

import { notificationCenter } from '../../core/notification-center.js';
import { BackupService } from '../../application/backup.service.js';
import { JsonExportService } from '../../infrastructure/files/json-export.js';
import { waterAlertRepository } from '../../infrastructure/database/repositories/water-alert.repository.js';
import { APP_CONFIG } from '../../config/app.config.js';
import { formatDateTime } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { events } from '../../core/events.js';

const TAB_STORAGE_KEY = 'hidroterra_notif_center_tab_v1';

export class NotificationsView {
  constructor(router) {
    this.router = router;
    let savedTab = 'active';
    try {
      savedTab = localStorage.getItem(TAB_STORAGE_KEY) || 'active';
    } catch {
      savedTab = 'active';
    }
    this.activeTab = ['active', 'dismissed'].includes(savedTab) ? savedTab : 'active';
    this._onUpdateListener = null;
  }

  async render(container, params = {}) {
    if (params.tab && ['active', 'dismissed'].includes(params.tab)) {
      this.activeTab = params.tab;
      try {
        localStorage.setItem(TAB_STORAGE_KEY, this.activeTab);
      } catch {
        // Ignorar
      }
    }

    // Hidratar estado de notificaciones descartadas y calcular estado real de respaldos y alertas
    try {
      await notificationCenter._hydrateFromIndexedDB();
      const [activeAlerts, info] = await Promise.all([
        waterAlertRepository.getByStatus('activa').catch(() => []),
        BackupService.getStorageInfo().catch(() => null)
      ]);

      let showBackupWarning = notificationCenter.rawState.showBackupWarning;
      let daysSince = notificationCenter.rawState.daysSince;

      if (info) {
        showBackupWarning = false;
        daysSince = null;
        if (info.lastBackupDate) {
          const diffMs = Date.now() - new Date(info.lastBackupDate).getTime();
          daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysSince >= APP_CONFIG.storage.backupWarningDays) {
            showBackupWarning = true;
          }
        } else if (info.counts && info.counts.totalRecords > 0) {
          showBackupWarning = true;
        }
      }

      notificationCenter.setRawNotifications({
        showBackupWarning,
        daysSince,
        activeAlerts
      });
    } catch {
      // Ignorar si no hay sesión o error local
    }

    this._renderView(container);

    if (this._onUpdateListener) {
      events.off('notifications:updated', this._onUpdateListener);
    }
    this._onUpdateListener = () => {
      this._renderView(container);
    };
    events.on('notifications:updated', this._onUpdateListener);
  }

  _renderView(container) {
    const { active, dismissed, totalActive, totalDismissed } = notificationCenter.getAllNotifications();
    const waterAlertCount = active.filter(n => n.type === 'water_alert').length;
    const systemCount = active.filter(n => n.type !== 'water_alert').length;

    container.innerHTML = `
      <div class="notifications-fullscreen-view">
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Centro de Notificaciones y Avisos Territoriales</h2>
            <p class="text-muted">Visualización en pantalla completa de avisos de respaldo, seguridad territorial y alertas hídricas con opción de descarte y restauración.</p>
          </div>
          <div class="d-flex gap-2" style="flex-wrap: wrap;">
            ${totalActive > 0 ? `
              <button type="button" class="btn btn-outline btn-sm" id="btn-notif-view-dismiss-all">
                <span>Descartar Todas las Activas (${totalActive})</span>
              </button>
            ` : ''}
            ${totalDismissed > 0 ? `
              <button type="button" class="btn btn-outline btn-sm" id="btn-notif-view-restore-all">
                <span>Restaurar Descartadas (${totalDismissed})</span>
              </button>
            ` : ''}
            <button type="button" class="btn btn-primary btn-sm" id="btn-notif-view-go-alerts">
              <span>Ir al Módulo de Alertas Hídricas</span>
            </button>
          </div>
        </div>

        <!-- Indicadores Resumen -->
        <div class="dashboard-metrics-grid mb-4">
          <div class="metric-card">
            <div class="metric-info">
              <span class="metric-value">${totalActive}</span>
              <span class="metric-label">Notificaciones Activas</span>
              <span class="metric-sub">Pendientes de revisión o descarte</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-info">
              <span class="metric-value">${waterAlertCount}</span>
              <span class="metric-label">Alertas Hídricas Activas</span>
              <span class="metric-sub">Niveles críticos, descenso o déficit</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-info">
              <span class="metric-value">${systemCount}</span>
              <span class="metric-label">Avisos de Respaldo y Sistema</span>
              <span class="metric-sub">Seguridad de datos territoriales</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-info">
              <span class="metric-value">${totalDismissed}</span>
              <span class="metric-label">Notificaciones Descartadas</span>
              <span class="metric-sub">Ocultadas de la ventana superior</span>
            </div>
          </div>
        </div>

        <!-- Pestañas: Activas vs Apartado de Descartadas -->
        <div class="nav-tabs mb-4" role="tablist">
          <button type="button" class="nav-tab-btn ${this.activeTab === 'active' ? 'active' : ''}" data-tab="active">
            <span>Notificaciones Activas (${totalActive})</span>
          </button>
          <button type="button" class="nav-tab-btn ${this.activeTab === 'dismissed' ? 'active' : ''}" data-tab="dismissed">
            <span>Apartado de Descartadas (${totalDismissed})</span>
          </button>
        </div>

        <div id="notifications-tab-outlet">
          ${this.activeTab === 'active'
            ? this._renderActiveList(active)
            : this._renderDismissedList(dismissed)}
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _renderActiveList(activeList) {
    if (activeList.length === 0) {
      return `
        <div class="card">
          <div class="card-body" style="padding: var(--spacing-6); text-align: center;">
            <h3 style="margin-bottom: 6px; color: var(--color-neutral-900);">No hay notificaciones activas pendientes</h3>
            <p class="text-muted" style="margin-bottom: var(--spacing-4);">
              Todas las notificaciones han sido atendidas o descartadas. Si descartó alguna por error, puede consultarla en la pestaña «Apartado de Descartadas».
            </p>
            <button type="button" class="btn btn-outline btn-sm" id="btn-empty-switch-dismissed">
              <span>Ver Apartado de Descartadas</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
        ${activeList.map(item => {
          const borderColor = item.priority === 'alta' ? '#dc2626' : '#f59e0b';
          const badgeClass = item.priority === 'alta' ? 'badge-danger' : 'badge-warning';
          return `
            <div class="card" style="margin-bottom: 0; border-left: 4px solid ${borderColor};">
              <div class="card-body" style="padding: var(--spacing-4) var(--spacing-5); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--spacing-3);">
                <div style="flex: 1 1 420px; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                    <span class="badge ${badgeClass}">${escapeHtml((item.priority || 'media').toUpperCase())}</span>
                    <span class="badge badge-neutral">${escapeHtml(item.categoryLabel)}</span>
                    <small class="text-muted">${escapeHtml(formatDateTime(item.createdAt))}</small>
                  </div>
                  <h4 style="margin: 0 0 6px; font-size: var(--font-size-base); color: var(--color-neutral-900);">
                    ${escapeHtml(item.title)}
                  </h4>
                  <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-neutral-700); line-height: 1.5;">
                    ${escapeHtml(item.message)}
                  </p>
                  ${item.ruleDescription ? `
                    <p style="margin: 6px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-500);">
                      ${escapeHtml(item.ruleDescription)}
                    </p>
                  ` : ''}
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  ${item.actionType === 'export_backup' ? `
                    <button type="button" class="btn btn-primary btn-sm btn-notif-export-now">
                      <span>Exportar Respaldo Ahora</span>
                    </button>
                  ` : ''}
                  ${item.actionType === 'go_alerts' ? `
                    ${item.relatedEntityId ? `
                      <button type="button" class="btn btn-outline btn-sm btn-notif-view-source" data-source-id="${escapeHtml(item.relatedEntityId)}">
                        <span>Ver Ficha de Fuente</span>
                      </button>
                    ` : ''}
                    <button type="button" class="btn btn-primary btn-sm btn-notif-go-alerts">
                      <span>Atender en Alertas</span>
                    </button>
                  ` : ''}
                  <button type="button" class="btn btn-outline btn-sm btn-notif-dismiss-one" data-notif-id="${escapeHtml(item.id)}" title="Descartar esta notificación">
                    <span>Descartar</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderDismissedList(dismissedList) {
    if (dismissedList.length === 0) {
      return `
        <div class="card">
          <div class="card-body" style="padding: var(--spacing-6); text-align: center;">
            <h3 style="margin-bottom: 6px; color: var(--color-neutral-900);">No hay notificaciones descartadas</h3>
            <p class="text-muted" style="margin: 0;">
              Cuando descarte una notificación desde la ventana desplegable superior o desde esta vista, quedará archivada aquí por si desea consultarla o restaurarla.
            </p>
          </div>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
        ${dismissedList.map(item => `
          <div class="card" style="margin-bottom: 0; opacity: 0.9; border-left: 4px solid var(--color-neutral-400);">
            <div class="card-body" style="padding: var(--spacing-4) var(--spacing-5); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--spacing-3);">
              <div style="flex: 1 1 420px; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                  <span class="badge badge-neutral">Descartada</span>
                  <span class="badge badge-info">${escapeHtml(item.categoryLabel || 'Notificación')}</span>
                  <small class="text-muted">Descartada el ${escapeHtml(formatDateTime(item.dismissedAt))}</small>
                </div>
                <h4 style="margin: 0 0 4px; font-size: var(--font-size-sm); color: var(--color-neutral-800);">
                  ${escapeHtml(item.title)}
                </h4>
                <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  ${escapeHtml(item.message)}
                </p>
              </div>
              <div>
                <button type="button" class="btn btn-outline btn-sm btn-notif-restore-one" data-notif-id="${escapeHtml(item.id)}">
                  <span>Restaurar a Activas</span>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _bindEvents(container) {
    container.querySelectorAll('.nav-tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        try {
          localStorage.setItem(TAB_STORAGE_KEY, this.activeTab);
        } catch {
          // Ignorar
        }
        this._renderView(container);
      });
    });

    container.querySelector('#btn-empty-switch-dismissed')?.addEventListener('click', () => {
      this.activeTab = 'dismissed';
      try {
        localStorage.setItem(TAB_STORAGE_KEY, this.activeTab);
      } catch {
        // Ignorar
      }
      this._renderView(container);
    });

    container.querySelector('#btn-notif-view-go-alerts')?.addEventListener('click', () => {
      this.router.navigate('water-alerts');
    });

    container.querySelector('#btn-notif-view-dismiss-all')?.addEventListener('click', () => {
      const count = notificationCenter.dismissAllActive();
      notification.info('Notificaciones descartadas', `Se descartaron ${count} notificaciones activas.`);
    });

    container.querySelector('#btn-notif-view-restore-all')?.addEventListener('click', () => {
      notificationCenter.restoreAllDismissed();
      notification.success('Notificaciones restauradas', 'Todas las notificaciones descartadas volvieron a la lista activa.');
    });

    container.querySelectorAll('.btn-notif-dismiss-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.notifId;
        notificationCenter.dismiss(id);
        notification.info('Notificación descartada', 'La notificación se movió al apartado de descartadas.');
      });
    });

    container.querySelectorAll('.btn-notif-restore-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.notifId;
        notificationCenter.restore(id);
        notification.success('Notificación restaurada', 'La notificación volvió a la lista de activas.');
      });
    });

    container.querySelectorAll('.btn-notif-go-alerts').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('water-alerts');
      });
    });

    container.querySelectorAll('.btn-notif-view-source').forEach(btn => {
      btn.addEventListener('click', () => {
        const sourceId = btn.dataset.sourceId;
        this.router.navigate('water-availability', { sourceId, openSheet: true });
      });
    });

    container.querySelectorAll('.btn-notif-export-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storageInfo = await BackupService.getStorageInfo();
        const totalRecords = storageInfo?.counts?.totalRecords ?? 0;
        const confirmed = await modal.confirm({
          title: 'Confirmar Exportación de Copia de Seguridad',
          message: `¿Desea exportar ahora una copia de seguridad completa en formato JSON con los ${totalRecords} registros almacenados?`,
          confirmText: 'Sí, Exportar Respaldo JSON',
          cancelText: 'Cancelar'
        });
        if (!confirmed) return;
        const result = await JsonExportService.exportFullBackup();
        notification.success('Respaldo Exportado', `Se descargó "${result.filename}" con éxito.`);
        notificationCenter.setRawNotifications({
          ...notificationCenter.rawState,
          showBackupWarning: false
        });
      });
    });
  }

  destroy() {
    if (this._onUpdateListener) {
      events.off('notifications:updated', this._onUpdateListener);
      this._onUpdateListener = null;
    }
  }
}

