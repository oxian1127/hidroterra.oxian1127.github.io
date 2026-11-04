/**
 * Componente: Insignias de Estado (Status Badges)
 */

import { escapeHtml } from '../../core/validators.js';

export function renderStatusBadge(status) {
  if (!status) return '<span class="badge badge-neutral">—</span>';

  const clean = String(status).toLowerCase();

  switch (clean) {
    case 'activo':
    case 'disponible':
    case 'activa':
      return `<span class="badge badge-success"><span class="status-dot online"></span> ${escapeHtml(status)}</span>`;

    case 'limitada':
    case 'mantenimiento':
      return `<span class="badge badge-warning"><span class="status-dot offline"></span> ${escapeHtml(status)}</span>`;

    case 'seca':
    case 'contaminada':
    case 'perdido':
    case 'retirado':
      return `<span class="badge badge-danger">${escapeHtml(status)}</span>`;

    case 'inactivo':
    case 'inactiva':
    case 'cosechado':
      return `<span class="badge badge-neutral">${escapeHtml(status)}</span>`;

    case 'sin_verificar':
    default:
      return `<span class="badge badge-info">${escapeHtml(status)}</span>`;
  }
}
