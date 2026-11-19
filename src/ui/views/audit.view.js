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
    this.currentPage = 1;
    this.pageSize = 10;
    this.filters = {
      organizationId: 'all',
      module: 'all',
      action: 'all',
      search: ''
    };
  }

  /**
   * Divide un texto en líneas de máximo 20 caracteres respetando palabras cuando es posible.
   */
  _splitIntoLines20(rawText, maxLen = 20) {
    const text = String(rawText || '').trim();
    if (!text) return [];
    if (text.length <= maxLen) return [text];

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
    return lines;
  }

  /**
   * Formatea texto general en bloques de máximo 20 caracteres por línea.
   */
  _formatText20Chars(rawText) {
    const lines = this._splitIntoLines20(rawText, 20);
    if (lines.length === 0) return '—';
    return lines
      .map(line => `<span style="display: block; white-space: nowrap;">${escapeHtml(line)}</span>`)
      .join('');
  }

  /**
   * Formatea un identificador (ID Registro) en líneas de máximo 20 caracteres.
   */
  _formatRecordId20Chars(rawId) {
    const text = String(rawId || '').trim();
    if (!text) return '<code>—</code>';
    const maxLen = 20;
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
      chunks.push(text.slice(i, i + maxLen));
    }
    return `<code style="display: inline-block; line-height: 1.35;">${chunks
      .map(chunk => `<span style="display: block; white-space: nowrap;">${escapeHtml(chunk)}</span>`)
      .join('')}</code>`;
  }

  /**
   * Formatea el nombre del usuario mostrando los dos primeros nombres arriba y los apellidos abajo,
   * manteniendo un ancho máximo de 20 caracteres por línea.
   */
  _formatUserNameTwoLines(rawName) {
    const text = String(rawName || '').trim();
    if (!text) return '<strong>—</strong>';

    const words = text.split(/\s+/).filter(Boolean);
    let givenNames = '';
    let surnames = '';

    if (words.length >= 3) {
      givenNames = words.slice(0, 2).join(' ');
      surnames = words.slice(2).join(' ');
    } else if (words.length === 2) {
      givenNames = words[0];
      surnames = words[1];
    } else {
      givenNames = text;
    }

    const givenLines = this._splitIntoLines20(givenNames, 20);
    const surnameLines = surnames ? this._splitIntoLines20(surnames, 20) : [];

    return `
      <strong style="display: block; line-height: 1.3;">
        ${givenLines.map(l => `<span style="display: block; white-space: nowrap;">${escapeHtml(l)}</span>`).join('')}
        ${surnameLines.map(l => `<span style="display: block; white-space: nowrap;">${escapeHtml(l)}</span>`).join('')}
      </strong>
    `;
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

    const totalLogs = this.logs.length;
    const totalPages = Math.max(1, Math.ceil(totalLogs / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, totalLogs);
    const pageLogs = this.logs.slice(startIdx, endIdx);

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
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 class="card-title">Eventos Registrados (${totalLogs})</h3>
            <span style="font-size: var(--font-size-xs); color: var(--color-neutral-600);">
              ${totalLogs > 0 ? `Mostrando ${startIdx + 1}–${endIdx} de ${totalLogs} (10 por página)` : 'Sin resultados'}
            </span>
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
                ${pageLogs.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 24px;" class="text-muted">
                      No hay eventos de auditoría que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ` : pageLogs.map(log => `
                  <tr>
                    <td style="white-space: nowrap;">${escapeHtml(formatDateTime(log.timestamp || log.createdAt))}</td>
                    <td style="white-space: nowrap; line-height: 1.35;">
                      ${this._formatUserNameTwoLines(log.userName)}
                      ${log.userRole ? `<div style="font-size: 0.72rem; color: var(--color-neutral-500); margin-top: 2px;">${this._formatText20Chars(log.userRole)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(log.organizationName || log.organizationId || '—')}</td>
                    <td><span class="badge badge-info">${escapeHtml(log.module || '—')}</span></td>
                    <td><span class="badge ${log.action === 'delete' ? 'badge-danger' : log.action === 'create' ? 'badge-success' : 'badge-warning'}">${escapeHtml(log.action || '—')}</span></td>
                    <td style="white-space: nowrap; line-height: 1.35;">${this._formatRecordId20Chars(log.recordId)}</td>
                    <td style="white-space: nowrap; line-height: 1.35;">${this._formatText20Chars(log.details)}</td>
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
          ${totalLogs > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: var(--spacing-3) var(--spacing-4); border-top: 1px solid var(--color-neutral-200);">
              <div style="font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Página <strong>${this.currentPage}</strong> de <strong>${totalPages}</strong> (${totalLogs} registros en total)
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-audit-prev-page" ${this.currentPage <= 1 ? 'disabled' : ''}>
                  <span>Anterior</span>
                </button>
                <span style="font-size: var(--font-size-xs); font-weight: 600; padding: 0 8px;">
                  ${this.currentPage} / ${totalPages}
                </span>
                <button type="button" class="btn btn-outline btn-sm" id="btn-audit-next-page" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                  <span>Siguiente</span>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.querySelector('#btn-audit-refresh')?.addEventListener('click', () => this.render(container));

    container.querySelector('#btn-audit-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this._renderView(container);
      }
    });

    container.querySelector('#btn-audit-next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this._renderView(container);
      }
    });

    const applyFilters = async () => {
      this.filters.search = container.querySelector('#audit-search')?.value || '';
      if (isSuper && container.querySelector('#audit-org')) {
        this.filters.organizationId = container.querySelector('#audit-org').value;
      }
      this.filters.module = container.querySelector('#audit-module')?.value || 'all';
      this.filters.action = container.querySelector('#audit-action')?.value || 'all';
      this.currentPage = 1;
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

