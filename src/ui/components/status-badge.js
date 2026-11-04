/**
 * Componente: Insignias de Estado (Status Badges)
 */

import { escapeHtml } from '../../core/validators.js';

export function renderStatusBadge(status) {
  if (!status) return '<span class="badge badge-neutral">—</span>';

  const clean = String(status).toLowerCase();

  const statusLabels = {
    alta: 'Disponibilidad alta',
    moderada: 'Disponibilidad moderada',
    baja: 'Disponibilidad baja',
    critica: 'Disponibilidad crítica',
    sin_informacion: 'Sin información suficiente',
    sin_verificar: 'Sin verificar',
    atendida: 'Atendida'
  };

  const label = statusLabels[clean] || status;

  switch (clean) {
    case 'activo':
    case 'disponible':
    case 'activa':
    case 'alta':
    case 'atendida':
      return `<span class="badge badge-success"><span class="status-dot online"></span> ${escapeHtml(label)}</span>`;

    case 'limitada':
    case 'mantenimiento':
    case 'moderada':
    case 'baja':
    case 'media':
      return `<span class="badge badge-warning"><span class="status-dot offline"></span> ${escapeHtml(label)}</span>`;

    case 'seca':
    case 'contaminada':
    case 'perdido':
    case 'retirado':
    case 'critica':
      return `<span class="badge badge-danger">${escapeHtml(label)}</span>`;

    case 'inactivo':
    case 'inactiva':
    case 'cosechado':
    case 'sin_informacion':
      return `<span class="badge badge-neutral">${escapeHtml(label)}</span>`;

    case 'sin_verificar':
    default:
      return `<span class="badge badge-info">${escapeHtml(label)}</span>`;
  }
}
