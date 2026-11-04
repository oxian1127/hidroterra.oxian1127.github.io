/**
 * Componente: Estado Vacío Explicativo (Empty State)
 */

import { escapeHtml } from '../../core/validators.js';

export function renderEmptyState({ icon = '<i class="fa-solid fa-folder-open"></i>', title = 'No hay registros', description = 'Aún no se ha registrado información en este módulo.', actionText = null, actionId = null }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon.startsWith('<') ? icon : escapeHtml(icon)}</div>
      <h3 class="empty-state-title">${escapeHtml(title)}</h3>
      <p class="empty-state-text">${escapeHtml(description)}</p>
      ${actionText && actionId ? `
        <button class="btn btn-primary" id="${escapeHtml(actionId)}">
          ${escapeHtml(actionText)}
        </button>
      ` : ''}
    </div>
  `;
}
