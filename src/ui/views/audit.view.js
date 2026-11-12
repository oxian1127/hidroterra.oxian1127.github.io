/**
 * Vista: Registro de Auditoría e Historial de Actividad — HIDROTERRA (Sección 13)
 *
 * Muestra inicios/cierres de sesión, creaciones, modificaciones, eliminaciones,
 * gestión de usuarios, cambios institucionales y sincronizaciones con Firestore.
 * Cuando el Superadministrador modifica datos de otra organización, permite inspeccionar
 * los valores anteriores (previousValues) y nuevos (newValues).
 */

import { auditService } from '../../application/audit.service.js';
import { sessionService } from '../../core/session.service.js';
import { formatDateTime } from '../../core/date-utils.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';

export class AuditView {
  constructor(router) {
    this.router = router;
    this.logs = [];
    this.organizations = [];
    this.filters = {
      organizationId: 'all',
      module: 'all',
      action: 'all',
      search: ''
    };
  }

  async render(container) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <p class="text-muted">Consultando historial de auditoría en Firestore...</p>
      </div>
    `;

    const isSuper = sessionService.isSuperAdmin();
    this.organizations = await sessionService.getOrganizations(true);

    if (!isSuper) {
      this.filters.organizationId = sessionService.getCurrentUser()?.organizationId || 'all';
    }

    this.logs = await auditService.getAuditLogs(this.filters);
    this._renderView(container);
  }

  _renderView(container) {
    const isSuper = sessionService.isSuperAdmin();
    const modules = [...new Set(this.logs.map(l => l.module).filter(Boolean))].sort();
    const actions = [...new Set(this.logs.map(l => l.action).filter(Boolean))].sort();

    container.innerHTML = `
      <div class="audit-view">
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Registro de Auditoría e Historial de Actividad</h2>
            <p class="text-muted">
              Trazabilidad de sesiones, creaciones, ediciones, eliminaciones, administración de usuarios y sincronizaciones con Firestore.
            </p>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btn-audit-refresh">
            <span>Actualizar Historial</span>
          </button>
        </div>

        <div class="card mb-4" style="border-left: 4px solid var(--color-earth-700);">
          <div class="card-body" style="padding: var(--spacing-3) var(--spacing-4); font-size: var(--font-size-xs); color: var(--color-neutral-700);">
            <strong>Nota de alcance técnico:</strong> Esta bitácora de auditoría tiene carácter demostrativo y académico. Al operar directamente desde el cliente sobre Firestore sin un servidor intermedio de validación, ofrece trazabilidad operativa en la interfaz pero no garantiza inmutabilidad criptográfica frente a accesos directos a la base de datos.
          </div>
        </div>

        <!-- Filtros -->
        <div class="filter-bar mb-4" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--spacing-3); padding: var(--spacing-3);">
          <div>
            <label class="form-label">Buscar usuario, registro o detalle</label>
            <input type="text" id="audit-search" class="form-control" placeholder="Buscar..." value="${escapeHtml(this.filters.search)}" />
          </div>
          ${isSuper ? `
            <div>
              <label class="form-label">Organización</label>
              <select id="audit-org" class="form-control">
                <option value="all">Todas las organizaciones</option>
                ${this.organizations.map(o => `<option value="${escapeHtml(o.id)}" ${this.filters.organizationId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
              </select>
            </div>
          ` : ''}
          <div>
            <label class="form-label">Módulo</label>
            <select id="audit-module" class="form-control">
              <option value="all">Todos los módulos</option>
              ${modules.map(m => `<option value="${escapeHtml(m)}" ${this.filters.module === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Acción</label>
            <select id="audit-action" class="form-control">
              <option value="all">Todas las acciones</option>
              ${actions.map(a => `<option value="${escapeHtml(a)}" ${this.filters.action === a ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Eventos Registrados (${this.logs.length})</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Organización</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>ID Registro</th>
                  <th>Detalle</th>
                  <th>Cambios</th>
                </tr>
              </thead>
              <tbody>
                ${this.logs.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 24px;" class="text-muted">
                      No hay eventos de auditoría que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ` : this.logs.slice(0, 150).map(log => `
                  <tr>
                    <td style="white-space: nowrap;">${escapeHtml(formatDateTime(log.timestamp || log.createdAt))}</td>
                    <td>
                      <strong>${escapeHtml(log.userName || '—')}</strong>
                      <div style="font-size: 0.72rem; color: var(--color-neutral-500);">${escapeHtml(log.userRole || '')}</div>
                    </td>
                    <td>${escapeHtml(log.organizationName || log.organizationId || '—')}</td>
                    <td><span class="badge badge-info">${escapeHtml(log.module || '—')}</span></td>
                    <td><span class="badge ${log.action === 'delete' ? 'badge-danger' : log.action === 'create' ? 'badge-success' : 'badge-warning'}">${escapeHtml(log.action || '—')}</span></td>
                    <td><code>${escapeHtml(String(log.recordId || '—'))}</code></td>
                    <td>${escapeHtml(log.details || '—')}</td>
                    <td>
                      ${(log.previousValues || log.newValues) ? `
                        <button type="button" class="btn btn-outline btn-sm btn-audit-diff" data-log-id="${escapeHtml(log.id)}">
                          <span>Ver valores</span>
                        </button>
                      ` : '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-audit-refresh')?.addEventListener('click', () => this.render(container));

    const applyFilters = async () => {
      this.filters.search = container.querySelector('#audit-search')?.value || '';
      if (isSuper && container.querySelector('#audit-org')) {
        this.filters.organizationId = container.querySelector('#audit-org').value;
      }
      this.filters.module = container.querySelector('#audit-module')?.value || 'all';
      this.filters.action = container.querySelector('#audit-action')?.value || 'all';
      this.logs = await auditService.getAuditLogs(this.filters);
      this._renderView(container);
    };

    container.querySelector('#audit-search')?.addEventListener('change', applyFilters);
    container.querySelector('#audit-org')?.addEventListener('change', applyFilters);
    container.querySelector('#audit-module')?.addEventListener('change', applyFilters);
    container.querySelector('#audit-action')?.addEventListener('change', applyFilters);

    container.querySelectorAll('.btn-audit-diff').forEach(btn => {
      btn.addEventListener('click', () => {
        const log = this.logs.find(l => l.id === btn.dataset.logId);
        if (log) this._openDiffModal(log);
      });
    });
  }

  _openDiffModal(log) {
    modal.open({
      title: `Detalle de Auditoría — ${log.action} (${log.module})`,
      size: 'lg',
      content: `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-3); font-size: var(--font-size-xs);">
          <div>
            <strong>Usuario ejecutor:</strong> ${escapeHtml(log.userName)} (${escapeHtml(log.userRole)}) |
            <strong>Fecha:</strong> ${escapeHtml(formatDateTime(log.timestamp))} |
            <strong>Organización destino:</strong> ${escapeHtml(log.organizationName || log.organizationId)}
          </div>
          <div class="form-grid-2">
            <div>
              <strong style="display: block; margin-bottom: 6px; color: var(--color-danger);">Valores Anteriores:</strong>
              <pre style="background-color: var(--color-neutral-50); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200); max-height: 280px; overflow: auto; margin: 0;">${escapeHtml(log.previousValues ? JSON.stringify(log.previousValues, null, 2) : 'Sin registro previo (Creación)')}</pre>
            </div>
            <div>
              <strong style="display: block; margin-bottom: 6px; color: var(--color-green-700);">Valores Nuevos:</strong>
              <pre style="background-color: var(--color-neutral-50); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200); max-height: 280px; overflow: auto; margin: 0;">${escapeHtml(log.newValues ? JSON.stringify(log.newValues, null, 2) : 'Eliminado')}</pre>
            </div>
          </div>
        </div>
      `,
      footer: `<button type="button" class="btn btn-primary" data-modal-close>Cerrar</button>`
    });
  }
}

