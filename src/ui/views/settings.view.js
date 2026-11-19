/**
 * Vista: Configuración, Perfil, Mi Organización, Seguridad, Usuarios,
 * Sincronización con Firebase Firestore y Respaldos Locales — HIDROTERRA
 * (Secciones 9 y 11)
 */

import { BackupService } from '../../application/backup.service.js';
import {
  FirebaseSyncService,
  MODULE_SYNC_METADATA
} from '../../application/firebase-sync.service.js';
import {
  sessionService,
  USER_ROLES,
  USER_ROLE_LABELS
} from '../../core/session.service.js';
import { validatePasswordStrength } from '../../core/crypto-auth.js';
import { firebaseService } from '../../../js/firebase-service.js';
import { DB_CONFIG } from '../../config/database.config.js';
import { formatDateTime } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { SAMPLE_MONTES_DE_MARIA } from '../../../data/examples/sample-data.js';
import { ThemeService } from '../../core/theme.js';
import { events } from '../../core/events.js';

export class SettingsView {
  constructor(router) {
    this.router = router;
    this.activeTab = 'local'; // 'local' | 'profile' | 'organization' | 'security' | 'users' | 'sync'
    this.filterOrgIdForUsers = 'all';
    this.syncAnalysis = null;
    this.syncPreview = null;
    this.syncHistory = [];
    this.selectedSyncTargetOrg = 'all';
    this._creatingNewOrgInTab = false;
  }

  /**
   * Ejecuta una operación asíncrona mostrando guía visual de carga en el botón pulsado
   * y en la barra superior de actividad del sistema.
   */
  async _runWithBtnLoading(btnEl, busyLabel, btnLoadingLabel, asyncFn) {
    events.emit('app:busy', {
      busy: true,
      label: busyLabel || 'Procesando acción...',
      button: btnEl,
      buttonLabel: btnLoadingLabel || 'Procesando...'
    });
    if (btnEl) {
      btnEl.classList.add('is-loading');
      btnEl.disabled = true;
      const span = btnEl.querySelector('span');
      if (span && btnLoadingLabel) {
        if (!btnEl.dataset.origLabel) btnEl.dataset.origLabel = span.textContent;
        span.textContent = btnLoadingLabel;
      }
    }
    try {
      return await asyncFn();
    } finally {
      events.emit('app:busy', { busy: false });
      if (btnEl) {
        btnEl.classList.remove('is-loading');
        btnEl.disabled = false;
        const span = btnEl.querySelector('span');
        if (span && btnEl.dataset.origLabel) {
          span.textContent = btnEl.dataset.origLabel;
          delete btnEl.dataset.origLabel;
        }
      }
    }
  }

  async render(container, params = {}) {
    if (params.tab && ['sync', 'profile', 'organization', 'security', 'users', 'local'].includes(params.tab)) {
      this.activeTab = params.tab;
    }
    if (params.orgId) {
      this.filterOrgIdForUsers = params.orgId;
    }

    container.innerHTML = `
      <div class="settings-loading" style="padding: 40px; text-align: center;">
        <p class="text-muted">Cargando configuración, perfil institucional y estado de sincronización con Firestore...</p>
      </div>
    `;

    const currentUser = sessionService.getCurrentUser();
    const isSuper = sessionService.isSuperAdmin();
    const isOrgAdmin = sessionService.isOrgAdmin();
    const canManageUsers = isSuper || isOrgAdmin;
    const canManageOrg = isSuper || isOrgAdmin;

    const fbStatus = firebaseService.getStatus();

    container.innerHTML = `
      <div class="settings-view">
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Configuración, Perfil, Usuarios y Sincronización con Firebase</h2>
            <p class="text-muted">
              Administración de cuenta, organización, seguridad criptográfica PBKDF2, sincronización con Firestore y respaldos locales.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${fbStatus.status === 'connected' ? 'badge-success' : fbStatus.status === 'offline' ? 'badge-warning' : 'badge-info'}">
              Firestore: ${fbStatus.status === 'connected' ? 'Conectado' : fbStatus.status === 'offline' ? 'Modo Local (Offline)' : 'Verificando'}
            </span>
          </div>
        </div>

        <!-- Pestañas de Configuración Reorganizadas: Apariencia y Respaldos Locales primero, Sincronizar Datos con Firebase último -->
        <div class="nav-tabs mb-4" role="tablist" style="display: flex; flex-wrap: wrap; gap: 6px;">
          <button type="button" class="nav-tab-btn ${this.activeTab === 'local' ? 'active' : ''}" data-tab="local">
            <span>Apariencia y Respaldos Locales</span>
          </button>
          <button type="button" class="nav-tab-btn ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
            <span>Mi Perfil</span>
          </button>
          ${canManageOrg ? `
            <button type="button" class="nav-tab-btn ${this.activeTab === 'organization' ? 'active' : ''}" data-tab="organization">
              <span>Mi Organización</span>
            </button>
          ` : ''}
          <button type="button" class="nav-tab-btn ${this.activeTab === 'security' ? 'active' : ''}" data-tab="security">
            <span>Seguridad</span>
          </button>
          ${canManageUsers ? `
            <button type="button" class="nav-tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
              <span>Gestión de Usuarios</span>
            </button>
          ` : ''}
          <button type="button" class="nav-tab-btn ${this.activeTab === 'sync' ? 'active' : ''}" data-tab="sync">
            <span>Sincronizar Datos con Firebase</span>
          </button>
        </div>

        <div id="settings-tab-outlet"></div>
      </div>
    `;

    container.querySelectorAll('.nav-tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.activeTab = btn.dataset.tab;
        container.querySelectorAll('.nav-tab-btn[data-tab]').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === this.activeTab);
        });
        await this._renderActiveTab(container);
      });
    });

    await this._renderActiveTab(container);
  }

  async _renderActiveTab(container) {
    const outlet = container.querySelector('#settings-tab-outlet');
    if (!outlet) return;

    if (this.activeTab === 'sync') {
      await this._renderSyncTab(outlet, container);
    } else if (this.activeTab === 'profile') {
      await this._renderProfileTab(outlet, container);
    } else if (this.activeTab === 'organization') {
      await this._renderOrganizationTab(outlet, container);
    } else if (this.activeTab === 'security') {
      await this._renderSecurityTab(outlet, container);
    } else if (this.activeTab === 'users') {
      await this._renderUsersTab(outlet, container);
    } else {
      await this._renderLocalAndAppearanceTab(outlet, container);
    }
  }

  // =========================================================================
  // 1. PESTAÑA PRIORITARIA: SINCRONIZAR DATOS CON FIREBASE (Sección 9)
  // =========================================================================
  async _renderSyncTab(outlet, rootContainer) {
    outlet.innerHTML = `<div class="card" style="padding: 28px; text-align: center;"><p class="text-muted" style="margin:0;">Analizando estructuras de almacenamiento local e historial de sincronización...</p></div>`;

    const organizations = await sessionService.getOrganizations(true);
    this.syncAnalysis = await FirebaseSyncService.analyzeLocalData();
    this.syncHistory = await FirebaseSyncService.getSyncHistory();

    const analysis = this.syncAnalysis;
    const isSuper = sessionService.isSuperAdmin();
    const userOrgId = sessionService.getCurrentUser()?.organizationId;

    if (!isSuper && userOrgId) {
      this.selectedSyncTargetOrg = userOrgId;
    }

    const rainInfo = analysis.byModule.rainfall_records || { total: 0 };
    const pluvInfo = analysis.byModule.pluviometers || { total: 0 };
    const sourcesInfo = analysis.byModule.water_sources || { total: 0 };
    const measInfo = analysis.byModule.water_measurements || { total: 0 };
    const otherTotal =
      (analysis.byModule.sites?.total || 0) +
      (analysis.byModule.parcels?.total || 0) +
      (analysis.byModule.crops?.total || 0) +
      (analysis.byModule.observations?.total || 0) +
      (analysis.byModule.water_alerts?.total || 0);

    outlet.innerHTML = `
      <div class="card mb-4" style="border-top: 4px solid var(--color-green-700);">
        <div class="card-header">
          <div>
            <h3 class="card-title">SINCRONIZAR DATOS CON FIREBASE</h3>
            <p class="card-subtitle">
              Transferencia idempotente por lotes de los registros locales (IndexedDB) hacia Firebase Firestore conservando IDs, fechas y coordenadas GPS.
            </p>
          </div>
          <span class="badge ${analysis.unassignedCount > 0 ? 'badge-warning' : 'badge-success'}">
            ${analysis.alreadySyncedCount} / ${analysis.totalRecords} Sincronizados
          </span>
        </div>

        <div class="card-body">
          <!-- Resumen de datos locales encontrados -->
          <div class="dashboard-metrics-grid mb-4">
            <div class="metric-card">
              <div>
                <div class="metric-label">Datos Locales Encontrados</div>
                <div class="metric-value">${analysis.totalRecords}</div>
                <div class="metric-subtext">${analysis.assignedCount} con organización identificada</div>
              </div>
            </div>
            <div class="metric-card">
              <div>
                <div class="metric-label">Registros de Lluvias</div>
                <div class="metric-value">${rainInfo.total}</div>
                <div class="metric-subtext">Colección rain_events</div>
              </div>
            </div>
            <div class="metric-card">
              <div>
                <div class="metric-label">Pluviómetros</div>
                <div class="metric-value">${pluvInfo.total}</div>
                <div class="metric-subtext">Colección pluviometers</div>
              </div>
            </div>
            <div class="metric-card">
              <div>
                <div class="metric-label">Fuentes Hídricas</div>
                <div class="metric-value">${sourcesInfo.total}</div>
                <div class="metric-subtext">Colección water_sources</div>
              </div>
            </div>
            <div class="metric-card">
              <div>
                <div class="metric-label">Mediciones de Agua</div>
                <div class="metric-value">${measInfo.total}</div>
                <div class="metric-subtext">Colección water_measurements</div>
              </div>
            </div>
            <div class="metric-card">
              <div>
                <div class="metric-label">Otros Módulos Identificados</div>
                <div class="metric-value">${otherTotal}</div>
                <div class="metric-subtext">Sitios, parcelas, cultivos, notas y alertas</div>
              </div>
            </div>
          </div>

          <!-- Selector de organización de destino y estado -->
          <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); margin-bottom: var(--spacing-4);">
            <div class="form-grid-2" style="align-items: end;">
              <div>
                <label class="form-label" for="sync-target-org">Organización de destino para sincronización</label>
                <select id="sync-target-org" class="form-control" ${!isSuper ? 'disabled' : ''}>
                  <option value="all" ${this.selectedSyncTargetOrg === 'all' ? 'selected' : ''}>Todas las organizaciones identificadas (${organizations.length})</option>
                  ${organizations.map(o => `<option value="${escapeHtml(o.id)}" ${this.selectedSyncTargetOrg === o.id ? 'selected' : ''}>${escapeHtml(o.name)} (${escapeHtml(o.municipality)})</option>`).join('')}
                </select>
              </div>
              <div>
                <div style="font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  <strong>Estado de sincronización:</strong>
                  <span id="sync-status-summary">
                    ${analysis.totalRecords === 0
                      ? 'No hay datos locales en IndexedDB. Puede cargar los datos de muestra o importar un respaldo JSON.'
                      : `${analysis.assignedCount} listos para migrar | ${analysis.unassignedCount} sin organización identificada | ${analysis.duplicateCount} duplicados omitidos`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Botonera principal solicitada (Sección 9) -->
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: var(--spacing-4);">
            <button type="button" class="btn btn-outline" id="btn-sync-analyze">
              <span>1. Analizar datos locales</span>
            </button>
            <button type="button" class="btn btn-outline" id="btn-sync-preview">
              <span>2. Vista previa de migración</span>
            </button>
            <button type="button" class="btn btn-primary" id="btn-sync-execute">
              <span>3. Sincronizar con Firestore</span>
            </button>
            <button type="button" class="btn btn-outline" id="btn-sync-history">
              <span>4. Consultar historial de sincronización</span>
            </button>
            <button type="button" class="btn btn-blue" id="btn-sync-export-local">
              <span>Exportar respaldo local</span>
            </button>
          </div>

          <!-- Barra de progreso y resultado de sincronización -->
          <div id="sync-progress-box" style="display: none; margin-bottom: var(--spacing-4); padding: var(--spacing-3); border-radius: var(--radius-md); background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200);">
            <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); margin-bottom: 6px;">
              <strong id="sync-progress-text">Sincronizando registros con Firestore...</strong>
              <span id="sync-progress-pct">0%</span>
            </div>
            <div style="width: 100%; height: 10px; background-color: var(--color-neutral-200); border-radius: 999px; overflow: hidden;">
              <div id="sync-progress-bar" style="width: 0%; height: 100%; background-color: var(--color-green-600); transition: width 0.2s ease;"></div>
            </div>
            <div id="sync-result-details" style="margin-top: 8px; font-size: var(--font-size-xs);"></div>
          </div>

          <!-- Clasificación de registros sin organización identificada (solo Superadministrador) -->
          ${analysis.unassignedRecords.length > 0 ? `
            <div class="card mb-4" style="border-left: 4px solid var(--color-warning);">
              <div class="card-header">
                <div>
                  <h4 class="card-title" style="font-size: var(--font-size-base);">
                    Registros sin Organización Identificada (${analysis.unassignedRecords.length})
                  </h4>
                  <p class="card-subtitle">
                    Por regla de integridad, el sistema no asigna organizaciones arbitrariamente. Clasifíquelos aquí antes de sincronizarlos.
                  </p>
                </div>
                ${isSuper ? `
                  <button type="button" class="btn btn-primary btn-sm" id="btn-save-unassigned-classifications">
                    <span>Guardar Clasificación</span>
                  </button>
                ` : ''}
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th>ID / Nombre del Registro</th>
                      <th>Responsable en Registro</th>
                      <th>Asignar Organización</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${analysis.unassignedRecords.map(uRec => `
                      <tr>
                        <td><span class="badge badge-info">${escapeHtml(uRec.moduleLabel)}</span></td>
                        <td><strong>${escapeHtml(uRec.label)}</strong> (<code>${escapeHtml(uRec.id)}</code>)</td>
                        <td>${escapeHtml(uRec.responsible)}</td>
                        <td>
                          <select class="form-control unassigned-org-select" data-store="${escapeHtml(uRec.storeName)}" data-id="${escapeHtml(uRec.id)}" ${!isSuper ? 'disabled' : ''}>
                            <option value="">-- Seleccione organización --</option>
                            ${organizations.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join('')}
                          </select>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Contenedor dinámico para Análisis por Módulo / Vista Previa / Historial -->
          <div id="sync-dynamic-panel">
            ${this._renderSyncAnalysisTable(analysis)}
          </div>
        </div>
      </div>
    `;

    outlet.querySelector('#sync-target-org')?.addEventListener('change', (e) => {
      this.selectedSyncTargetOrg = e.target.value;
    });

    outlet.querySelector('#btn-sync-analyze')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await this._runWithBtnLoading(btn, 'Analizando datos locales en IndexedDB...', 'Analizando...', async () => {
        this.syncAnalysis = await FirebaseSyncService.analyzeLocalData();
        const panel = outlet.querySelector('#sync-dynamic-panel');
        if (panel) panel.innerHTML = this._renderSyncAnalysisTable(this.syncAnalysis);
        notification.info('Análisis completado', `Se encontraron ${this.syncAnalysis.totalRecords} registros locales en IndexedDB.`);
      });
    });

    outlet.querySelector('#btn-sync-preview')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await this._runWithBtnLoading(btn, 'Generando vista previa de migración...', 'Generando vista previa...', async () => {
        const preview = await FirebaseSyncService.buildMigrationPreview(this.selectedSyncTargetOrg);
        const panel = outlet.querySelector('#sync-dynamic-panel');
        if (panel) panel.innerHTML = this._renderSyncPreviewTable(preview);
      });
    });

    outlet.querySelector('#btn-sync-history')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await this._runWithBtnLoading(btn, 'Consultando historial de sincronizaciones en Firestore...', 'Consultando...', async () => {
        this.syncHistory = await FirebaseSyncService.getSyncHistory();
        const panel = outlet.querySelector('#sync-dynamic-panel');
        if (panel) panel.innerHTML = this._renderSyncHistoryTable(this.syncHistory);
      });
    });

    outlet.querySelector('#btn-sync-export-local')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const confirmed = await modal.confirm({
        title: 'Exportar Respaldo Local Antes de Migrar',
        message: `¿Desea descargar una copia JSON completa con los ${analysis.totalRecords} registros locales actuales antes de sincronizar con Firestore?`,
        confirmText: 'Sí, Exportar Respaldo Local',
        cancelText: 'Cancelar'
      });
      if (!confirmed) return;
      await this._runWithBtnLoading(btn, 'Generando respaldo local JSON...', 'Exportando...', async () => {
        const res = await FirebaseSyncService.exportLocalBackupBeforeMigration();
        notification.success('Respaldo local exportado', `Se descargó "${res.filename}" correctamente.`);
      });
    });

    outlet.querySelector('#btn-save-unassigned-classifications')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const selects = outlet.querySelectorAll('.unassigned-org-select');
      const assignments = [];
      selects.forEach(sel => {
        if (sel.value) {
          assignments.push({
            storeName: sel.dataset.store,
            id: sel.dataset.id,
            organizationId: sel.value
          });
        }
      });
      if (assignments.length === 0) {
        notification.warning('Sin selección', 'Seleccione al menos una organización para clasificar los registros.');
        return;
      }
      await this._runWithBtnLoading(btn, 'Guardando clasificación de registros...', 'Guardando...', async () => {
        const res = await FirebaseSyncService.classifyUnassignedRecords(assignments);
        notification.success('Registros clasificados', `Se asignó organización a ${res.updated} registros locales.`);
        await this._renderSyncTab(outlet, rootContainer);
      });
    });

    outlet.querySelector('#btn-sync-execute')?.addEventListener('click', async (e) => {
      const execBtn = e.currentTarget;
      const progressBox = outlet.querySelector('#sync-progress-box');
      const progressBar = outlet.querySelector('#sync-progress-bar');
      const progressPct = outlet.querySelector('#sync-progress-pct');
      const progressText = outlet.querySelector('#sync-progress-text');
      const resultDetails = outlet.querySelector('#sync-result-details');

      if (progressBox) progressBox.style.display = 'block';

      await this._runWithBtnLoading(execBtn, 'Sincronizando registros locales con Firebase Firestore...', 'Sincronizando con Firestore...', async () => {
        try {
          const result = await FirebaseSyncService.synchronizeWithFirestore({
            targetOrganizationId: this.selectedSyncTargetOrg,
            onProgress: (done, total) => {
              const pct = total > 0 ? Math.round((done / total) * 100) : 100;
              if (progressBar) progressBar.style.width = `${pct}%`;
              if (progressPct) progressPct.textContent = `${pct}%`;
              if (progressText) progressText.textContent = `Transfiriendo registros a Firestore (${done} de ${total})...`;
            }
          });

          if (progressBar) progressBar.style.width = '100%';
          if (progressPct) progressPct.textContent = '100%';
          if (progressText) {
            progressText.textContent = `Sincronización finalizada (${result.status.toUpperCase()})`;
          }
          if (resultDetails) {
            resultDetails.innerHTML = `
              <div><strong>Transferidos con éxito:</strong> ${result.succeededCount} de ${result.attemptedCount} registros.</div>
              <div><strong>Omitidos sin organización:</strong> ${result.skippedUnassignedCount} | <strong>Duplicados evitados:</strong> ${result.skippedDuplicatesCount}</div>
              ${result.errors.length > 0 ? `<div class="text-danger"><strong>Errores:</strong> ${escapeHtml(result.errors.join('; '))}</div>` : ''}
            `;
          }

          if (result.succeededCount > 0) {
            notification.success(
              'Sincronización con Firestore Completada',
              `Se transfirieron ${result.succeededCount} registros conservando la copia local en IndexedDB.`
            );
          } else if (result.errors.length > 0) {
            notification.error('Error en sincronización', result.errors[0]);
          } else {
            notification.info('Sincronización revisada', 'No había registros pendientes o transferibles para el filtro seleccionado.');
          }
        } catch (err) {
          notification.error('Error al sincronizar', err.message);
        }
      });
    });
  }

  _renderSyncAnalysisTable(analysis) {
    return `
      <h4 style="font-size: var(--font-size-base); margin-bottom: var(--spacing-2);">
        Desglose de Análisis Local por Módulo y Colección Firestore
      </h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Módulo Local</th>
              <th>Colección Firestore</th>
              <th>Total Local</th>
              <th>Con Organización</th>
              <th>Sin Organización</th>
              <th>Duplicados</th>
              <th>Ya Sincronizados</th>
            </tr>
          </thead>
          <tbody>
            ${MODULE_SYNC_METADATA.map(mod => {
              const m = analysis.byModule[mod.storeName] || { total: 0, assigned: 0, unassigned: 0, duplicates: 0, synced: 0 };
              return `
                <tr>
                  <td style="white-space: nowrap; word-break: keep-all; overflow-wrap: normal;"><strong>${escapeHtml(mod.shortLabel)}</strong></td>
                  <td style="white-space: nowrap; word-break: keep-all; overflow-wrap: normal;"><code style="white-space: nowrap; word-break: normal; overflow-wrap: normal;">${escapeHtml(mod.firestoreCollection)}</code></td>
                  <td><strong>${m.total}</strong></td>
                  <td><span class="badge badge-success">${m.assigned}</span></td>
                  <td><span class="badge ${m.unassigned > 0 ? 'badge-warning' : 'badge-info'}">${m.unassigned}</span></td>
                  <td>${m.duplicates}</td>
                  <td>${m.synced}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderSyncPreviewTable(preview) {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: var(--spacing-2);">
        <h4 style="font-size: var(--font-size-base); margin: 0;">
          Vista Previa de Migración (${preview.transferableCount} registros listos para transferir)
        </h4>
        ${preview.blockedUnassignedCount > 0 ? `
          <span class="badge badge-warning">
            Advertencia: ${preview.blockedUnassignedCount} registros sin organización no se transferirán hasta ser clasificados
          </span>
        ` : `<span class="badge badge-success">Todos los registros cuentan con organización identificada</span>`}
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID Original</th>
              <th>Módulo / Colección</th>
              <th>Descripción / Nombre</th>
              <th>Organización Destino</th>
              <th>Coordenadas</th>
              <th>Estado Previo</th>
            </tr>
          </thead>
          <tbody>
            ${preview.items.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; padding: 20px;" class="text-muted">No hay registros locales para previsualizar.</td></tr>
            ` : preview.items.slice(0, 100).map(item => `
              <tr>
                <td style="white-space: nowrap;"><code style="white-space: nowrap;">${escapeHtml(String(item.id))}</code></td>
                <td style="white-space: nowrap; word-break: keep-all; overflow-wrap: normal;">
                  <strong>${escapeHtml(item.moduleLabel)}</strong>
                  <div style="margin-top: 2px;"><code style="white-space: nowrap;">${escapeHtml(item.firestoreCollection)}</code></div>
                </td>
                <td><strong>${escapeHtml(String(item.nameOrSummary))}</strong></td>
                <td>${escapeHtml(item.organizationName)}</td>
                <td>${escapeHtml(item.coordinates)}</td>
                <td>
                  <span class="badge ${item.willTransfer ? 'badge-success' : 'badge-warning'}">
                    ${item.willTransfer ? 'Listo para transferir' : 'Requiere asignar organización'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderSyncHistoryTable(history) {
    return `
      <h4 style="font-size: var(--font-size-base); margin-bottom: var(--spacing-2);">
        Historial de Sincronizaciones con Firebase Firestore (${history.length})
      </h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Ejecutado por</th>
              <th>Organización Destino</th>
              <th>Sincronizados</th>
              <th>Omitidos / Errores</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${history.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; padding: 20px;" class="text-muted">Aún no se han registrado ejecuciones de sincronización.</td></tr>
            ` : history.map(run => `
              <tr>
                <td>${escapeHtml(formatDateTime(run.executedAt))}</td>
                <td>${escapeHtml(run.executedByUserName || '—')}</td>
                <td>${escapeHtml(run.targetOrganizationId === 'all' ? 'Todas las organizaciones' : run.targetOrganizationId)}</td>
                <td><strong>${run.succeededCount}</strong> / ${run.attemptedCount}</td>
                <td>${run.skippedUnassignedCount || 0} sin org | ${run.failedCount || 0} fallidos</td>
                <td>
                  <span class="badge ${run.status === 'exitosa' ? 'badge-success' : run.status === 'parcial' ? 'badge-warning' : 'badge-danger'}">
                    ${escapeHtml(run.status || '—')}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // =========================================================================
  // 2. PESTAÑA: MI PERFIL (Sección 11)
  // =========================================================================
  async _renderProfileTab(outlet, rootContainer) {
    const user = sessionService.getCurrentUser() || {};
    const org = sessionService.getCurrentOrganization() || {};

    outlet.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Mi Perfil de Usuario</h3>
            <p class="card-subtitle">Actualice sus datos personales y de contacto dentro de su organización</p>
          </div>
          <span class="badge badge-info">${escapeHtml(USER_ROLE_LABELS[user.role] || user.role || 'Usuario')}</span>
        </div>
        <div class="card-body">
          <form id="form-my-profile">
            <div style="display: flex; align-items: center; gap: var(--spacing-4); margin-bottom: var(--spacing-4); flex-wrap: wrap;">
              <div id="profile-photo-preview" style="width: 72px; height: 72px; border-radius: 50%; background-color: var(--color-green-100); color: var(--color-green-800); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.4rem; overflow: hidden; border: 2px solid var(--color-green-600);">
                ${user.photoDataUrl
                  ? `<img src="${escapeHtml(user.photoDataUrl)}" alt="Foto" style="width:100%; height:100%; object-fit:cover;" />`
                  : escapeHtml((user.firstName || user.name || 'U').substring(0, 2).toUpperCase())}
              </div>
              <div>
                <label class="form-label" for="prof-photo-input" style="margin-bottom: 4px;">Fotografía de perfil (opcional)</label>
                <input type="file" id="prof-photo-input" accept="image/*" class="form-control" style="max-width: 320px;" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Nombres *</label>
                <input type="text" id="prof-first" class="form-control" value="${escapeHtml(user.firstName || user.name || '')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos</label>
                <input type="text" id="prof-last" class="form-control" value="${escapeHtml(user.lastName || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Cargo / Rol comunitario</label>
                <input type="text" id="prof-pos" class="form-control" value="${escapeHtml(user.position || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Correo electrónico *</label>
                <input type="email" id="prof-email" class="form-control" value="${escapeHtml(user.email || '')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" id="prof-phone" class="form-control" value="${escapeHtml(user.phone || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Organización y Rol Asignado (No modificables por el usuario)</label>
                <input type="text" class="form-control" value="${escapeHtml(org.name || user.organizationName || '—')} — ${escapeHtml(USER_ROLE_LABELS[user.role] || user.role || '')}" disabled />
              </div>
            </div>

            <div class="mt-3">
              <button type="submit" class="btn btn-primary" id="btn-save-my-profile">
                <span>Guardar Cambios de Perfil</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    let pendingPhotoDataUrl = user.photoDataUrl || '';
    const photoInput = outlet.querySelector('#prof-photo-input');
    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingPhotoDataUrl = String(ev.target.result || '');
        const preview = outlet.querySelector('#profile-photo-preview');
        if (preview) {
          preview.innerHTML = `<img src="${escapeHtml(pendingPhotoDataUrl)}" alt="Foto" style="width:100%; height:100%; object-fit:cover;" />`;
        }
      };
      reader.readAsDataURL(file);
    });

    outlet.querySelector('#form-my-profile')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = outlet.querySelector('#btn-save-my-profile');
      await this._runWithBtnLoading(saveBtn, 'Guardando cambios de perfil en Firestore...', 'Guardando cambios...', async () => {
        try {
          await sessionService.updateMyProfile({
            firstName: outlet.querySelector('#prof-first')?.value || '',
            lastName: outlet.querySelector('#prof-last')?.value || '',
            position: outlet.querySelector('#prof-pos')?.value || '',
            email: outlet.querySelector('#prof-email')?.value || '',
            phone: outlet.querySelector('#prof-phone')?.value || '',
            photoDataUrl: pendingPhotoDataUrl
          });
          notification.success('Perfil actualizado', 'Sus datos personales fueron guardados en Firestore.');
        } catch (err) {
          notification.error('Error al actualizar perfil', err.message);
        }
      });
    });
  }

  // =========================================================================
  // 3. PESTAÑA: MI ORGANIZACIÓN Y DIRECTORIO PÚBLICO (Secciones 11 y 12)
  // =========================================================================
  async _renderOrganizationTab(outlet, rootContainer) {
    const orgs = await sessionService.getOrganizations(sessionService.isSuperAdmin());
    const currentOrg = sessionService.getCurrentOrganization() || orgs[0] || {};
    const isCreatingNew = Boolean(this._creatingNewOrgInTab && sessionService.isSuperAdmin());
    const targetOrg = isCreatingNew
      ? { id: '', name: '', shortName: '', organizationType: 'Comité Comunitario de Agua', department: 'Bolívar', municipality: '', privacySettings: { publishedInDirectory: true, consentGranted: false } }
      : (orgs.find(o => o.id === currentOrg.id) || orgs[0] || {});
    const priv = targetOrg.privacySettings || {};

    outlet.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${isCreatingNew ? 'Crear Nueva Organización Institucional' : 'Información Institucional de Mi Organización'}</h3>
            <p class="card-subtitle">Administre los datos oficiales y la visibilidad en el Directorio Público de Organizaciones</p>
          </div>
          ${sessionService.isSuperAdmin() ? `
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${!isCreatingNew ? `
                <select id="org-tab-selector" class="form-control" style="max-width: 260px;">
                  ${orgs.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === targetOrg.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-outline btn-sm" id="btn-org-new-mode">
                  <span>+ Nueva Organización</span>
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-sm" id="btn-org-cancel-new">
                  <span>Volver a Organizaciones Existentes</span>
                </button>
              `}
            </div>
          ` : ''}
        </div>
        <div class="card-body">
          <form id="form-my-organization" novalidate>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Nombre completo de la organización *</label>
                <input type="text" id="org-name" class="form-control" value="${escapeHtml(targetOrg.name || '')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Nombre corto / Sigla</label>
                <input type="text" id="org-short" class="form-control" value="${escapeHtml(targetOrg.shortName || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">NIT (opcional)</label>
                <input type="text" id="org-nit" class="form-control" value="${escapeHtml(targetOrg.nit || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Tipo de organización</label>
                <input type="text" id="org-type" class="form-control" value="${escapeHtml(targetOrg.organizationType || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Departamento *</label>
                <input type="text" id="org-dept" class="form-control" value="${escapeHtml(targetOrg.department || 'Bolívar')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Municipio *</label>
                <input type="text" id="org-muni" class="form-control" value="${escapeHtml(targetOrg.municipality || '')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Dirección / Comunidad / Vereda</label>
                <input type="text" id="org-addr" class="form-control" value="${escapeHtml(targetOrg.address || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Responsable / Representante</label>
                <input type="text" id="org-rep" class="form-control" value="${escapeHtml(targetOrg.representativeName || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Cargo del representante</label>
                <input type="text" id="org-reprole" class="form-control" value="${escapeHtml(targetOrg.representativeRole || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Correo electrónico institucional</label>
                <input type="email" id="org-email" class="form-control" value="${escapeHtml(targetOrg.institutionalEmail || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" id="org-phone" class="form-control" value="${escapeHtml(targetOrg.phone || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp</label>
                <input type="text" id="org-wa" class="form-control" value="${escapeHtml(targetOrg.whatsapp || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Página web</label>
                <input type="url" id="org-web" class="form-control" value="${escapeHtml(targetOrg.website || '')}" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label class="form-label">Redes sociales</label>
                <input type="text" id="org-social" class="form-control" value="${escapeHtml(targetOrg.socialLinks || '')}" placeholder="@organizacion" />
              </div>
              <div class="form-group">
                <label class="form-label">Áreas de trabajo (separadas por coma)</label>
                <input type="text" id="org-areas" class="form-control" value="${escapeHtml(Array.isArray(targetOrg.workAreas) ? targetOrg.workAreas.join(', ') : '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Logotipo institucional (imagen opcional)</label>
                <input type="file" id="org-logo-input" accept="image/*" class="form-control" />
              </div>
            </div>

            <div class="form-group mt-2 mb-3">
              <label class="form-label">¿A qué se dedica la organización? (Productos o servicios que comercializa o brinda)</label>
              <textarea id="org-products" class="form-control" rows="2" placeholder="Ej. Comercialización de ñame espino, miel de abejas, yuca, artesanías, servicio de acueducto comunitario o asistencia técnica agropecuaria...">${escapeHtml(targetOrg.productsOrServices || '')}</textarea>
            </div>

            <div class="form-group mb-4">
              <label class="form-label">Descripción institucional</label>
              <textarea id="org-desc" class="form-control" rows="2">${escapeHtml(targetOrg.description || '')}</textarea>
            </div>

            <!-- Configuración de Visibilidad en el Directorio Público y Consentimiento Ley 1581 -->
            <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); margin-bottom: var(--spacing-4);">
              <h4 style="font-size: var(--font-size-base); margin: 0 0 6px;">
                Configuración de Publicación en el Directorio Público de Organizaciones
              </h4>
              <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-3);">
                Seleccione qué datos institucionales autoriza mostrar públicamente en el Directorio de Organizaciones. Ningún dato de contacto personal se publica sin su consentimiento expreso.
              </p>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: var(--font-size-sm); margin-bottom: var(--spacing-3);">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-published" ${priv.publishedInDirectory !== false ? 'checked' : ''} />
                  <span>Mostrar organización en el Directorio Público</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-contact-name" ${priv.showContactName !== false ? 'checked' : ''} />
                  <span>Publicar nombre del representante</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-email" ${(priv.showEmail || Boolean(targetOrg.institutionalEmail)) ? 'checked' : ''} />
                  <span>Publicar correo institucional</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-phone" ${(priv.showPhone || Boolean(targetOrg.phone)) ? 'checked' : ''} />
                  <span>Publicar teléfono de contacto</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-wa" ${(priv.showWhatsapp || Boolean(targetOrg.whatsapp)) ? 'checked' : ''} />
                  <span>Publicar número de WhatsApp</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-web" ${(priv.showWebsite || Boolean(targetOrg.website)) ? 'checked' : ''} />
                  <span>Publicar página web</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-social" ${(priv.showSocialLinks || Boolean(targetOrg.socialLinks)) ? 'checked' : ''} />
                  <span>Publicar redes sociales</span>
                </label>
              </div>

              <div id="priv-consent-box" style="padding: 12px; border-top: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); font-size: var(--font-size-xs); transition: background-color 0.2s ease, border-color 0.2s ease;">
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="priv-consent" ${priv.consentGranted ? 'checked' : ''} required style="margin-top: 3px;" />
                  <span>
                    <strong>Consentimiento Informado (Ley 1581 de 2012 — Colombia) <span style="color: var(--color-danger, #dc2626);">* (Obligatorio)</span>:</strong> Autorizo de manera libre, previa, expresa e informada el tratamiento institucional y la publicación de los datos de contacto marcados arriba en el Directorio Público de Organizaciones de HIDROTERRA con fines de articulación comunitaria y gestión hídrica territorial.
                  </span>
                </label>
                <div id="priv-consent-error" style="display: none; margin-top: 8px; padding: 8px 10px; border-radius: var(--radius-sm); background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 600;">
                  Debe marcar la casilla de Consentimiento Informado (Ley 1581 de 2012) antes de poder guardar la información de la organización.
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-save-organization">
              <span>${isCreatingNew ? 'Crear Organización y Guardar en Firestore' : 'Guardar Información Institucional y Privacidad'}</span>
            </button>
          </form>
        </div>
      </div>
    `;

    let pendingLogoDataUrl = targetOrg.logoDataUrl || '';
    outlet.querySelector('#org-logo-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingLogoDataUrl = String(ev.target.result || '');
      };
      reader.readAsDataURL(file);
    });

    outlet.querySelector('#org-tab-selector')?.addEventListener('change', async (e) => {
      this._creatingNewOrgInTab = false;
      sessionService.setSuperadminOrganizationFilter(e.target.value);
      await this._renderOrganizationTab(outlet, rootContainer);
    });

    outlet.querySelector('#btn-org-new-mode')?.addEventListener('click', async () => {
      this._creatingNewOrgInTab = true;
      await this._renderOrganizationTab(outlet, rootContainer);
    });

    outlet.querySelector('#btn-org-cancel-new')?.addEventListener('click', async () => {
      this._creatingNewOrgInTab = false;
      await this._renderOrganizationTab(outlet, rootContainer);
    });

    const consentCheckbox = outlet.querySelector('#priv-consent');
    const consentErrorEl = outlet.querySelector('#priv-consent-error');
    const consentBoxEl = outlet.querySelector('#priv-consent-box');

    // Al ingresar un dato de contacto (correo, teléfono, WhatsApp, página web o redes), activar automáticamente su casilla de publicación
    const autoCheckMap = [
      ['#org-rep', '#priv-contact-name'],
      ['#org-email', '#priv-email'],
      ['#org-phone', '#priv-phone'],
      ['#org-wa', '#priv-wa'],
      ['#org-web', '#priv-web'],
      ['#org-social', '#priv-social']
    ];
    autoCheckMap.forEach(([inputSel, chkSel]) => {
      const inp = outlet.querySelector(inputSel);
      const chk = outlet.querySelector(chkSel);
      inp?.addEventListener('input', () => {
        if (inp.value.trim() && chk) {
          chk.checked = true;
        }
      });
    });

    consentCheckbox?.addEventListener('change', () => {
      if (consentCheckbox.checked) {
        if (consentErrorEl) consentErrorEl.style.display = 'none';
        if (consentBoxEl) {
          consentBoxEl.style.backgroundColor = 'transparent';
          consentBoxEl.style.border = 'none';
          consentBoxEl.style.borderTop = '1px solid var(--color-neutral-200)';
        }
      }
    });

    outlet.querySelector('#form-my-organization')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orgNameVal = (outlet.querySelector('#org-name')?.value || '').trim();
      if (!orgNameVal) {
        notification.warning('Nombre obligatorio', 'Ingrese el nombre completo de la organización.');
        outlet.querySelector('#org-name')?.focus();
        return;
      }

      const consentChecked = Boolean(consentCheckbox?.checked);
      if (!consentChecked) {
        if (consentErrorEl) consentErrorEl.style.display = 'block';
        if (consentBoxEl) {
          consentBoxEl.style.backgroundColor = 'rgba(254, 242, 242, 0.7)';
          consentBoxEl.style.border = '1px solid #ef4444';
        }
        consentCheckbox?.focus();
        notification.warning(
          'Consentimiento Informado Obligatorio',
          'Debe marcar la casilla de Consentimiento Informado (Ley 1581 de 2012) antes de guardar la información de la organización.'
        );
        return;
      }

      const saveBtn = outlet.querySelector('#btn-save-organization');
      await this._runWithBtnLoading(
        saveBtn,
        'Guardando información institucional en Firebase Firestore...',
        'Guardando organización...',
        async () => {
          try {
            const savedOrg = await sessionService.saveOrganization({
              ...targetOrg,
              name: orgNameVal,
              shortName: outlet.querySelector('#org-short')?.value || '',
              nit: outlet.querySelector('#org-nit')?.value || '',
              organizationType: outlet.querySelector('#org-type')?.value || '',
              department: outlet.querySelector('#org-dept')?.value || '',
              municipality: outlet.querySelector('#org-muni')?.value || '',
              address: outlet.querySelector('#org-addr')?.value || '',
              representativeName: outlet.querySelector('#org-rep')?.value || '',
              representativeRole: outlet.querySelector('#org-reprole')?.value || '',
              institutionalEmail: outlet.querySelector('#org-email')?.value || '',
              phone: outlet.querySelector('#org-phone')?.value || '',
              whatsapp: outlet.querySelector('#org-wa')?.value || '',
              website: outlet.querySelector('#org-web')?.value || '',
              socialLinks: outlet.querySelector('#org-social')?.value || '',
              workAreas: outlet.querySelector('#org-areas')?.value || '',
              productsOrServices: outlet.querySelector('#org-products')?.value || '',
              description: outlet.querySelector('#org-desc')?.value || '',
              logoDataUrl: pendingLogoDataUrl,
              privacySettings: {
                publishedInDirectory: Boolean(outlet.querySelector('#priv-published')?.checked),
                consentGranted: true,
                consentDate: new Date().toISOString(),
                showContactName: Boolean(outlet.querySelector('#priv-contact-name')?.checked),
                showEmail: Boolean(outlet.querySelector('#priv-email')?.checked),
                showPhone: Boolean(outlet.querySelector('#priv-phone')?.checked),
                showWhatsapp: Boolean(outlet.querySelector('#priv-wa')?.checked),
                showWebsite: Boolean(outlet.querySelector('#priv-web')?.checked),
                showSocialLinks: Boolean(outlet.querySelector('#priv-social')?.checked)
              }
            }, isCreatingNew);

            if (isCreatingNew) {
              this._creatingNewOrgInTab = false;
              sessionService.setSuperadminOrganizationFilter(savedOrg.id);
              notification.success('Organización creada', `La organización "${savedOrg.name}" fue registrada en Firestore.`);
              await this._renderOrganizationTab(outlet, rootContainer);
            } else {
              notification.success('Organización actualizada', 'Los datos institucionales y el Directorio Público se actualizaron en Firestore.');
            }
          } catch (err) {
            notification.error('Error al guardar organización', err.message);
          }
        }
      );
    });
  }

  // =========================================================================
  // 4. PESTAÑA: SEGURIDAD (Sección 11)
  // =========================================================================
  async _renderSecurityTab(outlet) {
    const user = sessionService.getCurrentUser() || {};

    outlet.innerHTML = `
      <div class="form-grid-2">
        <div class="card" style="margin: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title">Cambiar Contraseña</h3>
              <p class="card-subtitle">Verificación de hash actual y derivación PBKDF2-SHA256 con nueva sal aleatoria</p>
            </div>
          </div>
          <div class="card-body">
            <form id="form-change-pwd">
              <div class="form-group mb-3">
                <label class="form-label">Contraseña actual *</label>
                <input type="password" id="sec-cur-pwd" class="form-control" required />
              </div>
              <div class="form-group mb-2">
                <label class="form-label">Nueva contraseña *</label>
                <input type="password" id="sec-new-pwd" class="form-control" required />
              </div>
              <div id="sec-pwd-strength" style="font-size: var(--font-size-xs); margin-bottom: var(--spacing-3); color: var(--color-neutral-600);">
                Fortaleza: Ingrese al menos 8 caracteres combinando mayúsculas, minúsculas y números.
              </div>
              <div class="form-group mb-4">
                <label class="form-label">Confirmar nueva contraseña *</label>
                <input type="password" id="sec-conf-pwd" class="form-control" required />
              </div>
              <button type="submit" class="btn btn-primary">
                <span>Actualizar Contraseña</span>
              </button>
            </form>
          </div>
        </div>

        <div class="card" style="margin: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title">Estado de la Cuenta y Criptografía</h3>
              <p class="card-subtitle">Información de sesión y algoritmo aplicado</p>
            </div>
            <span class="badge badge-success">${escapeHtml(user.status || 'activo')}</span>
          </div>
          <div class="card-body" style="font-size: var(--font-size-sm); display: flex; flex-direction: column; gap: 10px;">
            <div><strong>ID de Usuario:</strong> <code class="allow-copy" data-allow-copy="true">${escapeHtml(user.id || '—')}</code></div>
            <div><strong>Correo autenticado:</strong> ${escapeHtml(user.email || '—')}</div>
            <div><strong>Rol activo:</strong> <span class="badge badge-info">${escapeHtml(USER_ROLE_LABELS[user.role] || user.role || '—')}</span></div>
            <div><strong>Organización asociada:</strong> ${escapeHtml(user.organizationName || user.organizationId || '—')}</div>
            <div><strong>Algoritmo de Hash:</strong> <code>PBKDF2-SHA256</code> (120,000 iteraciones + sal aleatoria de 128 bits)</div>
            <div style="padding: 10px; background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); font-size: var(--font-size-xs); color: var(--color-neutral-600);">
              Su contraseña nunca se almacena en texto plano ni en <code>localStorage</code>. Tampoco se expone el hash ni la sal en la interfaz.
            </div>
          </div>
        </div>
      </div>
    `;

    const newPwdInput = outlet.querySelector('#sec-new-pwd');
    const strengthEl = outlet.querySelector('#sec-pwd-strength');

    newPwdInput?.addEventListener('input', () => {
      const check = validatePasswordStrength(newPwdInput.value);
      if (strengthEl) {
        strengthEl.innerHTML = `Fortaleza: <strong>${escapeHtml(check.label)}</strong> ${check.errors.length > 0 ? `— ${escapeHtml(check.errors.join(' '))}` : '— Cumple todos los criterios.'}`;
      }
    });

    outlet.querySelector('#form-change-pwd')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const curPwd = outlet.querySelector('#sec-cur-pwd')?.value || '';
      const newPwd = outlet.querySelector('#sec-new-pwd')?.value || '';
      const confPwd = outlet.querySelector('#sec-conf-pwd')?.value || '';

      try {
        await sessionService.changeMyPassword(curPwd, newPwd, confPwd);
        notification.success('Contraseña actualizada', 'Se ha generado un nuevo hash PBKDF2 y sal aleatoria en Firestore.');
        outlet.querySelector('#form-change-pwd')?.reset();
      } catch (err) {
        notification.error('Error al cambiar contraseña', err.message);
      }
    });
  }

  /**
   * Formatea el nombre del cargo en líneas de máximo 20 caracteres sin saltos prematuros
   * para garantizar una lectura limpia y uniforme en la tabla de usuarios.
   */
  _formatUserPosition(rawPosition) {
    const text = String(rawPosition || '').trim();
    if (!text) return '—';

    const maxLen = 20;
    if (text.length <= maxLen) {
      return `<span style="display: inline-block; white-space: nowrap;">${escapeHtml(text)}</span>`;
    }

    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= maxLen) {
          currentLine = word;
        } else {
          for (let i = 0; i < word.length; i += maxLen) {
            const chunk = word.slice(i, i + maxLen);
            if (chunk.length === maxLen && i + maxLen < word.length) {
              lines.push(chunk);
            } else {
              currentLine = chunk;
            }
          }
        }
      } else if (currentLine.length + 1 + word.length <= maxLen) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = '';
        if (word.length <= maxLen) {
          currentLine = word;
        } else {
          for (let i = 0; i < word.length; i += maxLen) {
            const chunk = word.slice(i, i + maxLen);
            if (chunk.length === maxLen && i + maxLen < word.length) {
              lines.push(chunk);
            } else {
              currentLine = chunk;
            }
          }
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines
      .map(line => `<span style="display: block; white-space: nowrap;">${escapeHtml(line)}</span>`)
      .join('');
  }

  /**
   * Formatea el nombre del usuario mostrando los dos primeros nombres en la línea superior
   * y los apellidos en la línea inferior para facilitar su lectura.
   */
  _formatUserNameTwoLines(u) {
    const first = String(u?.firstName || '').trim();
    const last = String(u?.lastName || '').trim();

    if (first && last) {
      return `
        <strong style="display: block; line-height: 1.3;">
          <span style="display: block; white-space: nowrap;">${escapeHtml(first)}</span>
          <span style="display: block; white-space: nowrap;">${escapeHtml(last)}</span>
        </strong>
      `;
    }

    const full = String(u?.name || first || last || '').trim();
    if (!full) return '<strong>—</strong>';

    const words = full.split(/\s+/).filter(Boolean);
    let topLine = '';
    let bottomLine = '';

    if (words.length >= 3) {
      topLine = words.slice(0, 2).join(' ');
      bottomLine = words.slice(2).join(' ');
    } else if (words.length === 2) {
      topLine = words[0];
      bottomLine = words[1];
    } else {
      topLine = full;
    }

    return `
      <strong style="display: block; line-height: 1.3;">
        <span style="display: block; white-space: nowrap;">${escapeHtml(topLine)}</span>
        ${bottomLine ? `<span style="display: block; white-space: nowrap;">${escapeHtml(bottomLine)}</span>` : ''}
      </strong>
    `;
  }

  // =========================================================================
  // 5. PESTAÑA: GESTIÓN DE USUARIOS (Sección 11)
  // =========================================================================
  async _renderUsersTab(outlet, rootContainer) {
    const isSuper = sessionService.isSuperAdmin();
    const organizations = await sessionService.getOrganizations(true);
    const users = await sessionService.getUsers(isSuper ? this.filterOrgIdForUsers : null);

    outlet.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Gestión de Usuarios (${users.length})</h3>
            <p class="card-subtitle">
              ${isSuper
                ? 'Administración global de usuarios y roles en todas las organizaciones'
                : 'Administración de usuarios pertenecientes a su organización'}
            </p>
          </div>
          <div class="d-flex gap-2" style="flex-wrap: wrap;">
            ${isSuper ? `
              <select id="users-org-filter" class="form-control" style="max-width: 240px;">
                <option value="all" ${this.filterOrgIdForUsers === 'all' ? 'selected' : ''}>Todas las organizaciones</option>
                ${organizations.map(o => `<option value="${escapeHtml(o.id)}" ${this.filterOrgIdForUsers === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
              </select>
            ` : ''}
            <button type="button" class="btn btn-primary btn-sm" id="btn-new-user">
              <span>Crear Usuario</span>
            </button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Correo Electrónico</th>
                <th>Cargo</th>
                <th>Organización</th>
                <th>Rol</th>
                <th>Estado / Clave</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 24px;" class="text-muted">No hay usuarios registrados para este filtro.</td></tr>
              ` : users.map(u => `
                <tr>
                  <td style="white-space: nowrap; line-height: 1.35;">${this._formatUserNameTwoLines(u)}</td>
                  <td>
                    ${u.email
                      ? `<a href="mailto:${escapeHtml(u.email)}?subject=${encodeURIComponent('Contacto Institucional HIDROTERRA')}" class="btn btn-outline btn-sm" style="text-decoration: none; white-space: nowrap;" title="${escapeHtml(u.email)}"><span>Enviar correo</span></a>`
                      : '<em class="text-muted">—</em>'}
                  </td>
                  <td style="white-space: nowrap; line-height: 1.35;">${this._formatUserPosition(u.position)}</td>
                  <td>${escapeHtml(u.organizationName || u.organizationId || '—')}</td>
                  <td><span class="badge badge-info">${escapeHtml(USER_ROLE_LABELS[u.role] || u.role)}</span></td>
                  <td>
                    <span class="badge ${u.status === 'suspendido' ? 'badge-danger' : 'badge-success'}">${escapeHtml(u.status || 'activo')}</span>
                    ${u.pendingPasswordSetup ? `<span class="badge badge-warning">Clave inicial pendiente</span>` : ''}
                    ${u.passwordResetRequested ? `<span class="badge badge-danger">Solicitó restablecer clave</span>` : ''}
                  </td>
                  <td>
                    <div class="d-flex gap-1" style="flex-wrap: wrap;">
                      <button type="button" class="btn btn-outline btn-sm btn-edit-user" data-user-id="${escapeHtml(u.id)}">Editar</button>
                      ${u.id !== sessionService.getCurrentUser()?.id ? `
                        <button type="button" class="btn ${u.status === 'suspendido' ? 'btn-primary' : 'btn-danger'} btn-sm btn-toggle-user" data-user-id="${escapeHtml(u.id)}">
                          ${u.status === 'suspendido' ? 'Reactivar' : 'Suspender'}
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelector('#users-org-filter')?.addEventListener('change', async (e) => {
      this.filterOrgIdForUsers = e.target.value;
      await this._renderUsersTab(outlet, rootContainer);
    });

    outlet.querySelector('#btn-new-user')?.addEventListener('click', () => {
      this._openUserModal(null, organizations, outlet, rootContainer);
    });

    outlet.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = users.find(item => item.id === btn.dataset.userId);
        if (u) this._openUserModal(u, organizations, outlet, rootContainer);
      });
    });

    outlet.querySelectorAll('.btn-toggle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const u = users.find(item => item.id === btn.dataset.userId);
        if (!u) return;
        const newStatus = u.status === 'suspendido' ? 'activo' : 'suspendido';
        await sessionService.saveUser({ ...u, status: newStatus }, false);
        notification.success('Estado de usuario actualizado', `El usuario "${u.name}" ahora está ${newStatus}.`);
        await this._renderUsersTab(outlet, rootContainer);
      });
    });
  }

  _openUserModal(userObj, organizations, outlet, rootContainer) {
    const isNew = !userObj;
    const isSuper = sessionService.isSuperAdmin();
    const currentUserOrgId = sessionService.getCurrentUser()?.organizationId;

    const allowedRoles = isSuper
      ? [USER_ROLES.SUPERADMINISTRADOR, USER_ROLES.ADMIN_ORGANIZACION, USER_ROLES.EDITOR, USER_ROLES.CONSULTA]
      : [USER_ROLES.ADMIN_ORGANIZACION, USER_ROLES.EDITOR, USER_ROLES.CONSULTA];

    modal.open({
      title: isNew ? 'Crear Nuevo Usuario' : `Editar Usuario — ${userObj.name}`,
      size: 'lg',
      content: `
        <form id="form-modal-user">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Nombres *</label>
              <input type="text" id="mu-first" class="form-control" value="${escapeHtml(userObj?.firstName || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Apellidos</label>
              <input type="text" id="mu-last" class="form-control" value="${escapeHtml(userObj?.lastName || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Correo electrónico *</label>
              <input type="email" id="mu-email" class="form-control" value="${escapeHtml(userObj?.email || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" id="mu-phone" class="form-control" value="${escapeHtml(userObj?.phone || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Cargo / Función</label>
              <input type="text" id="mu-pos" class="form-control" value="${escapeHtml(userObj?.position || 'Monitor Comunitario')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Organización *</label>
              <select id="mu-org" class="form-control" ${!isSuper ? 'disabled' : ''}>
                ${organizations.map(o => `<option value="${escapeHtml(o.id)}" ${(userObj?.organizationId || currentUserOrgId) === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Rol del usuario *</label>
              <select id="mu-role" class="form-control">
                ${allowedRoles.map(r => `<option value="${escapeHtml(r)}" ${(userObj?.role || USER_ROLES.EDITOR) === r ? 'selected' : ''}>${escapeHtml(USER_ROLE_LABELS[r])}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Asignar contraseña (o dejar vacía para que el usuario la defina)</label>
              <input type="password" id="mu-pwd" class="form-control" placeholder="Mínimo 8 caracteres si desea fijarla ahora" />
            </div>
          </div>

          <div class="form-group mt-2">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: var(--font-size-xs);">
              <input type="checkbox" id="mu-require-setup" ${userObj?.pendingPasswordSetup || userObj?.passwordResetRequested ? 'checked' : ''} />
              <span>Permitir que el usuario establezca o restablezca su contraseña en su próximo inicio de sesión</span>
            </label>
          </div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-outline" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-modal-save-user">Guardar Usuario</button>
      `,
      onOpen: (modalEl) => {
        modalEl.querySelector('#btn-modal-save-user')?.addEventListener('click', async () => {
          try {
            await sessionService.saveUser({
              ...(userObj || {}),
              firstName: modalEl.querySelector('#mu-first')?.value || '',
              lastName: modalEl.querySelector('#mu-last')?.value || '',
              email: modalEl.querySelector('#mu-email')?.value || '',
              phone: modalEl.querySelector('#mu-phone')?.value || '',
              position: modalEl.querySelector('#mu-pos')?.value || '',
              organizationId: modalEl.querySelector('#mu-org')?.value || currentUserOrgId,
              role: modalEl.querySelector('#mu-role')?.value || USER_ROLES.CONSULTA,
              plainPassword: modalEl.querySelector('#mu-pwd')?.value || '',
              requirePasswordSetupOnNextLogin: Boolean(modalEl.querySelector('#mu-require-setup')?.checked)
            }, isNew);

            modal.close();
            notification.success('Usuario guardado', 'Los datos del usuario se guardaron en Firestore.');
            await this._renderUsersTab(outlet, rootContainer);
          } catch (err) {
            notification.error('Error al guardar usuario', err.message);
          }
        });
      }
    });
  }

  // =========================================================================
  // 6. PESTAÑA: APARIENCIA Y RESPALDOS LOCALES (Funcionalidades existentes conservadas + 7 nuevas opciones)
  // =========================================================================
  async _renderLocalAndAppearanceTab(outlet, rootContainer) {
    const storageInfo = await BackupService.getStorageInfo();
    const isDark = ThemeService.isDark();
    const isOverflowTooltipOn = ThemeService.isOverflowTooltipEnabled();
    const isBadgeMarqueeOn = ThemeService.isBadgeMarqueeEnabled();
    const prefs = ThemeService.getPreferences();

    outlet.innerHTML = `
      <!-- Configuración de Apariencia, Accesibilidad y Visualización -->
      <div class="card mb-4" id="card-theme-settings" data-no-truncate="true">
        <div class="card-header">
          <div>
            <h3 class="card-title">Apariencia, Accesibilidad en Campo y Visualización</h3>
            <p class="card-subtitle">Personalice el tema, tamaño de letra, densidad de tablas y lectura de textos recortados</p>
          </div>
          <span class="badge ${isDark ? 'badge-info' : 'badge-success'}" id="settings-theme-badge">
            ${isDark ? 'Modo Oscuro' : 'Modo Claro'}
          </span>
        </div>
        <div class="card-body">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
            <div style="max-width: 600px;">
              <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Modo Oscuro (Dark Mode)</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                Reduce la emisión de luz y el cansancio visual durante jornadas prolongadas en campo y ahorra batería en dispositivos móviles.
              </p>
            </div>
            <div class="theme-switch-wrapper">
              <label class="theme-switch" for="settings-theme-toggle">
                <input type="checkbox" id="settings-theme-toggle" ${isDark ? 'checked' : ''} />
                <span class="theme-slider"><span class="theme-slider-thumb"></span></span>
              </label>
              <span id="settings-theme-status-text" style="font-weight: 600; font-size: var(--font-size-sm);">
                ${isDark ? 'Modo Oscuro Activado' : 'Modo Claro Activado'}
              </span>
            </div>
          </div>

          <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
            <div style="max-width: 600px;">
              <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Mostrar Texto Completo de Botones y Textos Recortados (...)</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                Actívelo si desea ver un globo emergente con el texto completo al pasar el cursor (PC) o al presionar (móvil) sobre botones o listas desplegables cuyos textos tengan puntos suspensivos (<code>...</code>).
              </p>
            </div>
            <div class="theme-switch-wrapper">
              <label class="theme-switch" for="settings-overflow-tooltip-toggle">
                <input type="checkbox" id="settings-overflow-tooltip-toggle" ${isOverflowTooltipOn ? 'checked' : ''} />
                <span class="theme-slider"><span class="theme-slider-thumb"></span></span>
              </label>
              <span id="settings-overflow-tooltip-status" style="font-weight: 600; font-size: var(--font-size-sm);">
                ${isOverflowTooltipOn ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>

          <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
            <div style="max-width: 600px;">
              <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Desplazamiento Horizontal en Etiquetas con Texto Largo</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                Cuando el texto de una etiqueta o insignia de estado no cabe completo en su espacio, desplaza el texto suavemente de forma horizontal sobre la etiqueta para poder leerlo completo sin ensanchar las columnas.
              </p>
            </div>
            <div class="theme-switch-wrapper">
              <label class="theme-switch" for="settings-badge-marquee-toggle">
                <input type="checkbox" id="settings-badge-marquee-toggle" ${isBadgeMarqueeOn ? 'checked' : ''} />
                <span class="theme-slider"><span class="theme-slider-thumb"></span></span>
              </label>
              <span id="settings-badge-marquee-status" style="font-weight: 600; font-size: var(--font-size-sm);">
                ${isBadgeMarqueeOn ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>

          <!-- 1 y 2. Tamaño de Fuente, Densidad de Tablas y Cantidad de Registros por Página -->
          <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200);">
            <h4 style="margin-bottom: 10px; font-size: var(--font-size-base);">Accesibilidad Visual y Paginación de Tablas</h4>
            <div class="form-grid-2" style="gap: var(--spacing-3);">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-font-scale">Tamaño de Fuente (Lectura en Campo)</label>
                <select id="pref-font-scale" class="form-control" data-no-truncate="true">
                  <option value="normal" ${prefs.fontSizeScale === 'normal' ? 'selected' : ''}>Normal (100% — Estándar)</option>
                  <option value="large" ${prefs.fontSizeScale === 'large' ? 'selected' : ''}>Grande (108% — Mayor legibilidad)</option>
                  <option value="xlarge" ${prefs.fontSizeScale === 'xlarge' ? 'selected' : ''}>Extra Grande (116% — Exteriores / Sol)</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-table-density">Densidad de Filas en Tablas</label>
                <select id="pref-table-density" class="form-control" data-no-truncate="true">
                  <option value="compact" ${prefs.tableDensity === 'compact' ? 'selected' : ''}>Compacta (Más registros visibles)</option>
                  <option value="comfortable" ${prefs.tableDensity === 'comfortable' ? 'selected' : ''}>Cómoda (Predeterminada)</option>
                  <option value="spacious" ${prefs.tableDensity === 'spacious' ? 'selected' : ''}>Amplia (Fácil pulsación táctil)</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-default-pagesize">Registros por Página Predeterminados</label>
                <select id="pref-default-pagesize" class="form-control" data-no-truncate="true">
                  <option value="10" ${Number(prefs.defaultPageSize) === 10 ? 'selected' : ''}>10 registros por página</option>
                  <option value="15" ${Number(prefs.defaultPageSize) === 15 ? 'selected' : ''}>15 registros por página (Predeterminado)</option>
                  <option value="25" ${Number(prefs.defaultPageSize) === 25 ? 'selected' : ''}>25 registros por página</option>
                  <option value="50" ${Number(prefs.defaultPageSize) === 50 ? 'selected' : ''}>50 registros por página</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-session-timeout">Cierre Automático de Sesión por Inactividad</label>
                <select id="pref-session-timeout" class="form-control" data-no-truncate="true">
                  <option value="0" ${Number(prefs.sessionTimeoutMinutes) === 0 ? 'selected' : ''}>Nunca (Mantener sesión abierta)</option>
                  <option value="15" ${Number(prefs.sessionTimeoutMinutes) === 15 ? 'selected' : ''}>Tras 15 minutos de inactividad</option>
                  <option value="30" ${Number(prefs.sessionTimeoutMinutes) === 30 ? 'selected' : ''}>Tras 30 minutos de inactividad</option>
                  <option value="60" ${Number(prefs.sessionTimeoutMinutes) === 60 ? 'selected' : ''}>Tras 1 hora de inactividad</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3, 5 y 6. Unidades de Medida, Umbrales de Alertas Hídricas/Climáticas y Modo Ahorro de Datos -->
      <div class="card mb-4" data-no-truncate="true">
        <div class="card-header">
          <div>
            <h3 class="card-title">Unidades de Medida, Umbrales de Alertas y Sincronización</h3>
            <p class="card-subtitle">Configure unidades territoriales, criterios preventivos de alerta y uso de datos móviles</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid-2 mb-4" style="gap: var(--spacing-3);">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="pref-volume-unit">Unidad de Volumen de Agua Preferida</label>
              <select id="pref-volume-unit" class="form-control" data-no-truncate="true">
                <option value="L" ${prefs.volumeUnit === 'L' ? 'selected' : ''}>Litros (L)</option>
                <option value="m3" ${prefs.volumeUnit === 'm3' ? 'selected' : ''}>Metros cúbicos (m³)</option>
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="pref-coord-format">Formato de Visualización de Coordenadas</label>
              <select id="pref-coord-format" class="form-control" data-no-truncate="true">
                <option value="decimal" ${prefs.coordinateFormat === 'decimal' ? 'selected' : ''}>Grados Decimales (9.71800° N, 75.12180° W)</option>
                <option value="dms" ${prefs.coordinateFormat === 'dms' ? 'selected' : ''}>Grados, Minutos y Segundos — GMS (9° 43' 04.8" N)</option>
              </select>
            </div>
          </div>

          <div style="padding-top: var(--spacing-3); border-top: 1px solid var(--color-neutral-200); margin-bottom: var(--spacing-4);">
            <h4 style="margin-bottom: 8px; font-size: var(--font-size-base);">Umbrales Personalizados de Alertas Hídricas y Climáticas</h4>
            <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: 12px;">
              Defina a partir de qué porcentaje de capacidad disponible se clasifica una fuente en alerta preventiva o crítica y cuántos días sin lluvia disparan alerta de periodo seco.
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-3);">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-water-low-pct">Umbral de Alerta Preventiva / Nivel Bajo (%)</label>
                <select id="pref-water-low-pct" class="form-control" data-no-truncate="true">
                  <option value="50" ${Number(prefs.waterLowAlertPct) === 50 ? 'selected' : ''}>50% de capacidad disponible</option>
                  <option value="45" ${Number(prefs.waterLowAlertPct) === 45 ? 'selected' : ''}>45% de capacidad disponible</option>
                  <option value="40" ${Number(prefs.waterLowAlertPct) === 40 ? 'selected' : ''}>40% de capacidad (Predeterminado)</option>
                  <option value="35" ${Number(prefs.waterLowAlertPct) === 35 ? 'selected' : ''}>35% de capacidad disponible</option>
                  <option value="30" ${Number(prefs.waterLowAlertPct) === 30 ? 'selected' : ''}>30% de capacidad disponible</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-water-crit-pct">Umbral de Alerta Crítica de Agua (%)</label>
                <select id="pref-water-crit-pct" class="form-control" data-no-truncate="true">
                  <option value="25" ${Number(prefs.waterCriticalAlertPct) === 25 ? 'selected' : ''}>25% de capacidad disponible</option>
                  <option value="20" ${Number(prefs.waterCriticalAlertPct) === 20 ? 'selected' : ''}>20% de capacidad (Predeterminado)</option>
                  <option value="15" ${Number(prefs.waterCriticalAlertPct) === 15 ? 'selected' : ''}>15% de capacidad disponible</option>
                  <option value="10" ${Number(prefs.waterCriticalAlertPct) === 10 ? 'selected' : ''}>10% de capacidad disponible</option>
                </select>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="pref-drought-days">Alerta Climática por Días Secos Seguidos</label>
                <select id="pref-drought-days" class="form-control" data-no-truncate="true">
                  <option value="3" ${Number(prefs.droughtDryDaysAlert) === 3 ? 'selected' : ''}>3 días secos consecutivos</option>
                  <option value="4" ${Number(prefs.droughtDryDaysAlert) === 4 ? 'selected' : ''}>4 días secos consecutivos (Predeterminado)</option>
                  <option value="5" ${Number(prefs.droughtDryDaysAlert) === 5 ? 'selected' : ''}>5 días secos consecutivos</option>
                  <option value="6" ${Number(prefs.droughtDryDaysAlert) === 6 ? 'selected' : ''}>6 días secos consecutivos</option>
                  <option value="7" ${Number(prefs.droughtDryDaysAlert) === 7 ? 'selected' : ''}>7 días secos consecutivos</option>
                </select>
              </div>
            </div>
          </div>

          <div style="padding-top: var(--spacing-3); border-top: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
            <div style="max-width: 600px;">
              <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Sincronización Automática con Firebase (Desactivar para Ahorro de Datos)</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                Cuando está activada, cada registro nuevo o editado se envía automáticamente a Firestore. Si la desactiva (<strong>Modo Ahorro de Datos en Campo</strong>), los registros se guardan solo en IndexedDB local y podrá sincronizarlos por lote cuando tenga Wi-Fi.
              </p>
            </div>
            <div class="theme-switch-wrapper">
              <label class="theme-switch" for="pref-auto-firestore-sync">
                <input type="checkbox" id="pref-auto-firestore-sync" ${prefs.autoFirestoreSync ? 'checked' : ''} />
                <span class="theme-slider"><span class="theme-slider-thumb"></span></span>
              </label>
              <span id="pref-auto-firestore-sync-status" style="font-weight: 600; font-size: var(--font-size-sm);">
                ${prefs.autoFirestoreSync ? 'Tiempo Real Activado' : 'Modo Ahorro de Datos'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Copias de Seguridad JSON Locales y Recordatorios Automáticos -->
      <div class="card mb-4" data-no-truncate="true">
        <div class="card-header">
          <div>
            <h3 class="card-title">Copias de Seguridad Locales (Archivos JSON) y Datos de Muestra</h3>
            <p class="card-subtitle">Almacén local IndexedDB: <code>${DB_CONFIG.name}</code> (${storageInfo.counts.totalRecords} registros)</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid-2 mb-4" style="gap: var(--spacing-3); padding-bottom: var(--spacing-3); border-bottom: 1px solid var(--color-neutral-200);">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="pref-backup-warning-days">Frecuencia de Recordatorio de Respaldo Local</label>
              <select id="pref-backup-warning-days" class="form-control" data-no-truncate="true">
                <option value="3" ${Number(prefs.backupWarningDays) === 3 ? 'selected' : ''}>Recordar cada 3 días</option>
                <option value="7" ${Number(prefs.backupWarningDays) === 7 ? 'selected' : ''}>Recordar cada 7 días (Predeterminado)</option>
                <option value="15" ${Number(prefs.backupWarningDays) === 15 ? 'selected' : ''}>Recordar cada 15 días</option>
                <option value="30" ${Number(prefs.backupWarningDays) === 30 ? 'selected' : ''}>Recordar cada 30 días</option>
              </select>
            </div>
            <div style="display: flex; flex-direction: column; justify-content: center;">
              <label class="form-label" style="margin-bottom: 6px;">Auto-Descarga de Respaldo al Cerrar Sesión</label>
              <div class="theme-switch-wrapper">
                <label class="theme-switch" for="pref-auto-backup-logout">
                  <input type="checkbox" id="pref-auto-backup-logout" ${prefs.autoBackupOnLogout ? 'checked' : ''} />
                  <span class="theme-slider"><span class="theme-slider-thumb"></span></span>
                </label>
                <span id="pref-auto-backup-logout-status" style="font-weight: 600; font-size: var(--font-size-xs);">
                  ${prefs.autoBackupOnLogout ? 'Descargar JSON al cerrar sesión' : 'Solo descarga manual'}
                </span>
              </div>
            </div>
          </div>

          <div class="form-grid-2 mb-4">
            <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4);">
              <h4>Exportar Respaldo Completo JSON</h4>
              <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin: 6px 0 12px;">
                Descarga un archivo <code>hidroterra-respaldo-AAAA-MM-DD.json</code> previa confirmación.
              </p>
              <button type="button" class="btn btn-primary" id="btn-settings-export-json">
                <span>Descargar Respaldo JSON</span>
              </button>
            </div>

            <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4);">
              <h4>Importar / Restaurar Archivo JSON</h4>
              <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin: 6px 0 12px;">
                Analiza un respaldo JSON previo antes de combinar o restaurar los datos locales.
              </p>
              <input type="file" id="input-import-json-file" accept=".json,application/json" style="display: none;" />
              <button type="button" class="btn btn-outline" id="btn-settings-trigger-import">
                <span>Seleccionar Archivo JSON...</span>
              </button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: var(--spacing-3); border-top: 1px solid var(--color-neutral-200);">
            <button type="button" class="btn btn-outline" id="btn-load-sample-dataset">
              <span>Cargar Datos de Prueba de Montes de María</span>
            </button>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              <button type="button" class="btn btn-outline" id="btn-clear-database-all">
                <span>Vaciar Solo Registros Locales (IndexedDB)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta explicativa para cierre de periodo de pruebas -->
      ${(sessionService.isSuperAdmin() || sessionService.isOrgAdmin()) ? `
        <div class="card mb-4" style="border-left: 4px solid var(--color-danger, #dc2626);">
          <div class="card-header">
            <div>
              <h3 class="card-title">Finalizar Periodo de Pruebas e Iniciar con Datos Reales (Firestore + Local)</h3>
              <p class="card-subtitle">Limpia los registros operativos de prueba en Firebase Firestore conservando las organizaciones y cuentas de usuario activas</p>
            </div>
          </div>
          <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--spacing-3);">
            <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; max-width: 720px; line-height: 1.55;">
              Cuando concluya las pruebas iniciales del sistema, utilice esta opción para eliminar de <strong>Firebase Firestore</strong> (<code>nam5</code>) y de <strong>IndexedDB</strong> los registros de prueba (lluvias, pluviómetros, fuentes hídricas, mediciones, alertas, sitios, parcelas, cultivos y observaciones), dejando las organizaciones y usuarios listos para capturar datos reales de campo.
            </p>
            <button type="button" class="btn btn-danger" id="btn-card-clear-firestore">
              <span>Vaciar Firestore para Datos Reales</span>
            </button>
          </div>
        </div>
      ` : ''}
    `;

    this._bindLocalTabEvents(outlet, rootContainer);
  }

  _bindLocalTabEvents(outlet, rootContainer) {
    const themeToggle = outlet.querySelector('#settings-theme-toggle');
    const overflowTooltipToggle = outlet.querySelector('#settings-overflow-tooltip-toggle');
    const overflowTooltipStatus = outlet.querySelector('#settings-overflow-tooltip-status');
    const badgeMarqueeToggle = outlet.querySelector('#settings-badge-marquee-toggle');
    const badgeMarqueeStatus = outlet.querySelector('#settings-badge-marquee-status');

    themeToggle?.addEventListener('change', () => {
      ThemeService.setTheme(themeToggle.checked ? 'dark' : 'light');
    });

    overflowTooltipToggle?.addEventListener('change', () => {
      const enabled = ThemeService.setOverflowTooltipEnabled(overflowTooltipToggle.checked);
      if (overflowTooltipStatus) {
        overflowTooltipStatus.textContent = enabled ? 'Activado' : 'Desactivado';
      }
      notification.info(
        enabled ? 'Lectura de textos completos activada' : 'Lectura de textos completos desactivada',
        enabled
          ? 'Se mostrará el texto completo al pasar el cursor o presionar elementos con (...).'
          : 'No se mostrarán globos emergentes en textos recortados.'
      );
    });

    badgeMarqueeToggle?.addEventListener('change', () => {
      const enabled = ThemeService.setBadgeMarqueeEnabled(badgeMarqueeToggle.checked);
      if (badgeMarqueeStatus) {
        badgeMarqueeStatus.textContent = enabled ? 'Activado' : 'Desactivado';
      }
      notification.info(
        enabled ? 'Desplazamiento en etiquetas activado' : 'Desplazamiento en etiquetas desactivado',
        enabled
          ? 'Los textos largos dentro de las etiquetas se desplazarán horizontalmente para su lectura completa.'
          : 'Las etiquetas con texto largo se mantendrán estáticas.'
      );
    });

    // Eventos de las 7 nuevas opciones de configuración
    const bindSelectPref = (selector, key, labelMsg) => {
      const el = outlet.querySelector(selector);
      if (!el) return;
      el.addEventListener('change', () => {
        ThemeService.updatePreferences({ [key]: el.value });
        notification.info('Preferencia actualizada', labelMsg);
      });
    };

    bindSelectPref('#pref-font-scale', 'fontSizeScale', 'El tamaño de fuente de la interfaz ha sido actualizado.');
    bindSelectPref('#pref-table-density', 'tableDensity', 'La densidad de filas de las tablas ha sido actualizada.');
    bindSelectPref('#pref-default-pagesize', 'defaultPageSize', 'La cantidad predeterminada de registros por página ha sido guardada.');
    bindSelectPref('#pref-session-timeout', 'sessionTimeoutMinutes', 'El tiempo de cierre automático de sesión por inactividad fue actualizado.');
    bindSelectPref('#pref-volume-unit', 'volumeUnit', 'La unidad de medida de volumen preferida ha sido actualizada.');
    bindSelectPref('#pref-coord-format', 'coordinateFormat', 'El formato de coordenadas geográficas ha sido actualizado.');
    bindSelectPref('#pref-water-low-pct', 'waterLowAlertPct', 'El umbral de alerta preventiva de disponibilidad hídrica fue actualizado.');
    bindSelectPref('#pref-water-crit-pct', 'waterCriticalAlertPct', 'El umbral de alerta crítica de disponibilidad hídrica fue actualizado.');
    bindSelectPref('#pref-drought-days', 'droughtDryDaysAlert', 'El umbral de días secos consecutivos para alerta climática fue actualizado.');
    bindSelectPref('#pref-backup-warning-days', 'backupWarningDays', 'La frecuencia de recordatorio de copia de seguridad local fue actualizada.');

    const autoSyncToggle = outlet.querySelector('#pref-auto-firestore-sync');
    const autoSyncStatus = outlet.querySelector('#pref-auto-firestore-sync-status');
    autoSyncToggle?.addEventListener('change', () => {
      const updated = ThemeService.updatePreferences({ autoFirestoreSync: autoSyncToggle.checked });
      if (autoSyncStatus) {
        autoSyncStatus.textContent = updated.autoFirestoreSync ? 'Tiempo Real Activado' : 'Modo Ahorro de Datos';
      }
      notification.info(
        updated.autoFirestoreSync ? 'Sincronización en tiempo real activada' : 'Modo Ahorro de Datos activado',
        updated.autoFirestoreSync
          ? 'Los cambios se sincronizarán automáticamente con Firebase Firestore.'
          : 'Los registros se guardarán primero en IndexedDB local para ahorrar datos móviles.'
      );
    });

    const autoBackupLogoutToggle = outlet.querySelector('#pref-auto-backup-logout');
    const autoBackupLogoutStatus = outlet.querySelector('#pref-auto-backup-logout-status');
    autoBackupLogoutToggle?.addEventListener('change', () => {
      const updated = ThemeService.updatePreferences({ autoBackupOnLogout: autoBackupLogoutToggle.checked });
      if (autoBackupLogoutStatus) {
        autoBackupLogoutStatus.textContent = updated.autoBackupOnLogout ? 'Descargar JSON al cerrar sesión' : 'Solo descarga manual';
      }
      notification.info(
        updated.autoBackupOnLogout ? 'Respaldo automático al salir activado' : 'Respaldo automático al salir desactivado',
        updated.autoBackupOnLogout
          ? 'Se descargará automáticamente un respaldo JSON antes de cerrar su sesión.'
          : 'Los respaldos JSON se descargarán únicamente cuando lo solicite.'
      );
    });

    outlet.querySelector('#btn-settings-export-json')?.addEventListener('click', async () => {
      const currentInfo = await BackupService.getStorageInfo();
      const totalRecords = currentInfo?.counts?.totalRecords ?? 0;
      const confirmed = await modal.confirm({
        title: 'Confirmar Exportación de Copia de Seguridad',
        message: `¿Desea generar y descargar el archivo de respaldo JSON con los ${totalRecords} registros visibles?`,
        confirmText: 'Sí, Descargar Respaldo JSON',
        cancelText: 'Cancelar'
      });
      if (!confirmed) return;
      const res = await BackupService.exportBackup();
      notification.success('Respaldo generado', `Descargado "${res.filename}" con éxito.`);
    });

    const importBtn = outlet.querySelector('#btn-settings-trigger-import');
    const fileInput = outlet.querySelector('#input-import-json-file');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const analysis = await BackupService.analyzeFile(file);
          this._openImportModal(analysis, rootContainer);
        } catch (err) {
          notification.error('Archivo no válido', err.message);
        } finally {
          fileInput.value = '';
        }
      });
    }

    outlet.querySelector('#btn-load-sample-dataset')?.addEventListener('click', async () => {
      const confirmed = await modal.confirm({
        title: 'Cargar Datos de Prueba de Montes de María',
        message: '¿Desea incorporar los datos de ejemplo del territorio (El Carmen de Bolívar, San Jacinto, San Juan Nepomuceno y Ovejas)?',
        confirmText: 'Cargar Datos de Muestra'
      });
      if (!confirmed) return;
      try {
        localStorage.removeItem('hidroterra_test_period_cleared');
      } catch {
        // Ignorar
      }
      await BackupService.executeImport(SAMPLE_MONTES_DE_MARIA.data, 'merge');
      notification.success('Datos de muestra cargados', 'Ya puede analizarlos y sincronizarlos con Firebase en la pestaña "Sincronizar Datos con Firebase".');
      this.activeTab = 'sync';
      await this.render(rootContainer, { tab: 'sync' });
    });

    outlet.querySelector('#btn-clear-database-all')?.addEventListener('click', async () => {
      const confirmed = await modal.confirm({
        title: '¡ADVERTENCIA: Vaciar Base de Datos Local!',
        message: '¿Está seguro de eliminar todos los registros almacenados localmente en IndexedDB?',
        confirmText: 'Sí, Vaciar Base de Datos Local',
        isDanger: true
      });
      if (!confirmed) return;
      try {
        localStorage.setItem('hidroterra_test_period_cleared', 'true');
      } catch {
        // Ignorar
      }
      await BackupService.clearAll();
      events.emit('data:reloaded');
      notification.warning('Base de datos local vaciada', 'Los registros locales de IndexedDB fueron eliminados.');
      await this._renderLocalAndAppearanceTab(outlet, rootContainer);
    });

    outlet.querySelector('#btn-card-clear-firestore')?.addEventListener('click', () => {
      this._openClearFirestoreModal(outlet, rootContainer);
    });
  }

  async _openClearFirestoreModal(outlet, rootContainer) {
    const isSuper = sessionService.isSuperAdmin();
    const currentOrg = sessionService.getCurrentOrganization();
    const organizations = await sessionService.getOrganizations(true);

    modal.open({
      title: 'Finalizar Periodo de Pruebas — Vaciar Base de Datos en Firestore',
      size: 'lg',
      content: `
        <div style="display: flex; flex-direction: column; gap: 14px; font-size: var(--font-size-sm);">
          <div style="padding: 12px 14px; border-radius: var(--radius-md); background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
            <strong>Atención:</strong> Esta operación eliminará los registros operativos de prueba en <strong>Firebase Firestore (hidroterra-32ce7 · nam5)</strong> de las colecciones:
            <code>rain_events</code>, <code>pluviometers</code>, <code>water_sources</code>, <code>water_measurements</code>, <code>water_alerts</code>, <code>sites</code>, <code>parcels</code>, <code>crops</code> y <code>observations</code>.
            <br/><span style="font-size: var(--font-size-xs);">Las organizaciones y cuentas de usuario se conservarán intactas para que pueda ingresar de inmediato los datos reales.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Alcance del vaciado en Firestore</label>
            <select id="clear-fb-org-scope" class="form-control" ${!isSuper ? 'disabled' : ''}>
              ${isSuper ? `<option value="all" selected>Todas las organizaciones (Vaciado global de datos de prueba)</option>` : ''}
              ${organizations.map(o => `
                <option value="${escapeHtml(o.id)}" ${(!isSuper && currentOrg?.id === o.id) ? 'selected' : ''}>
                  Solo organización: ${escapeHtml(o.name)} (${escapeHtml(o.municipality || '')})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-clear-also-local" checked />
              <span><strong>Vaciar también la base de datos local (IndexedDB)</strong> y desactivar la recarga automática de datos de prueba</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-clear-export-backup" />
              <span>Descargar primero una copia de respaldo JSON antes de vaciar</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">Para confirmar, escriba la palabra <strong>VACIAR</strong> en el siguiente campo *</label>
            <input type="text" id="input-confirm-clear-word" class="form-control" placeholder="Escriba VACIAR en mayúsculas" autocomplete="off" />
          </div>

          <div id="clear-fb-progress-status" style="display: none; padding: 10px; border-radius: var(--radius-md); background-color: var(--color-neutral-100); font-weight: 600; text-align: center;">
            Eliminando documentos en Firebase Firestore...
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-outline" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn-danger" id="btn-confirm-execute-clear-fb">
          <span>Confirmar y Vaciar Firestore</span>
        </button>
      `,
      onOpen: (modalEl) => {
        const confirmBtn = modalEl.querySelector('#btn-confirm-execute-clear-fb');
        const wordInput = modalEl.querySelector('#input-confirm-clear-word');
        const statusBox = modalEl.querySelector('#clear-fb-progress-status');

        confirmBtn?.addEventListener('click', async () => {
          const typed = (wordInput?.value || '').trim().toUpperCase();
          if (typed !== 'VACIAR') {
            notification.warning('Confirmación requerida', 'Debe escribir la palabra VACIAR para confirmar el vaciado de Firestore.');
            wordInput?.focus();
            return;
          }

          const orgScope = modalEl.querySelector('#clear-fb-org-scope')?.value || 'all';
          const alsoLocal = Boolean(modalEl.querySelector('#chk-clear-also-local')?.checked);
          const exportFirst = Boolean(modalEl.querySelector('#chk-clear-export-backup')?.checked);

          confirmBtn.disabled = true;
          if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.textContent = 'Conectando con Firebase Firestore y eliminando registros de prueba...';
          }

          try {
            if (exportFirst) {
              await FirebaseSyncService.exportLocalBackupBeforeMigration();
            }

            const result = await FirebaseSyncService.clearFirestoreForProduction({
              organizationId: orgScope,
              alsoClearLocalIndexedDB: alsoLocal,
              resetSyncHistory: true
            }, (deleted, total) => {
              if (statusBox) {
                statusBox.textContent = `Vaciando Firestore: ${deleted} de ${total} documentos eliminados...`;
              }
            });

            modal.close();
            events.emit('data:reloaded');
            notification.success(
              'Base de datos lista para datos reales',
              `Se eliminaron ${result.deleted} documentos en Firestore${alsoLocal ? ` y ${result.localDeletedCount} registros locales en IndexedDB` : ''}.`
            );

            await this.render(rootContainer, { tab: this.activeTab });
          } catch (err) {
            confirmBtn.disabled = false;
            if (statusBox) statusBox.style.display = 'none';
            notification.error('Error al vaciar Firestore', err.message);
          }
        });
      }
    });
  }

  _openImportModal(analysis, mainContainer) {
    const { metadata, diff, data } = analysis;
    modal.open({
      title: 'Confirmar Importación de Datos JSON',
      size: 'lg',
      contentHtml: `
        <div class="import-preview-box">
          <p><strong>Archivo de Respaldo:</strong> ${escapeHtml(metadata.appName || 'HIDROTERRA')} (${escapeHtml(formatDateTime(metadata.exportedAt))})</p>
          <p>Fuentes: +${diff.water_sources.newCount} nuevas | Mediciones: +${diff.water_measurements?.newCount || 0} nuevas | Lluvias: +${diff.rainfall_records.newCount} nuevas.</p>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-outline" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" id="btn-modal-import-confirm">Ejecutar Importación (Combinar)</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-modal-import-confirm')?.addEventListener('click', async () => {
          await BackupService.executeImport(data, 'merge');
          modal.close();
          notification.success('Importación Exitosa', 'Los registros fueron incorporados.');
          await this.render(mainContainer);
        });
      }
    });
  }

  destroy() {
    if (this._themeListener) {
      events.off('theme:changed', this._themeListener);
      this._themeListener = null;
    }
  }
}
