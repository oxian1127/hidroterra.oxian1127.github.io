/**
 * Componente: Sistema de Alertas Agroclimáticas Informativas (Sección 6)
 * Presenta avisos orientativos generados por reglas configurables sin declarar diagnósticos definitivos.
 */

import { escapeHtml } from '../../../core/validators.js';
import { formatDateTime } from '../../../core/date-utils.js';

export function renderClimateAlertsPanel(alerts = []) {
  if (!alerts || alerts.length === 0) return '';

  const levelLabels = {
    informativo: 'Nivel Informativo',
    atencion: 'Atención Preventiva',
    seguimiento: 'Seguimiento Hídrico Recomendado'
  };

  return `
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <h3 class="card-title"><i class="fa-solid fa-bell" style="color: var(--color-warning);"></i> Avisos y Alertas Agroclimáticas Orientativas</h3>
          <p class="card-subtitle">Indicadores generados automáticamente a partir de los umbrales de pronóstico configurados</p>
        </div>
        <span class="badge badge-neutral">${alerts.length} ${alerts.length === 1 ? 'aviso activo' : 'avisos activos'}</span>
      </div>

      <div class="card-body">
        <div class="climate-alerts-list">
          ${alerts.map(alert => `
            <div class="climate-alert-card level-${escapeHtml(alert.attentionLevel)}">
              <div class="climate-alert-header">
                <div class="d-flex align-center gap-2" style="flex-wrap: wrap;">
                  <span class="climate-alert-icon"><i class="fa-solid ${escapeHtml(alert.icon || 'fa-circle-info')}"></i></span>
                  <h4 style="margin: 0; font-size: var(--font-size-base); color: var(--color-neutral-900);">
                    ${escapeHtml(alert.type)}
                  </h4>
                </div>
                <span class="badge ${escapeHtml(alert.badgeClass || 'badge-info')}">
                  ${escapeHtml(levelLabels[alert.attentionLevel] || alert.attentionLevel)}
                </span>
              </div>

              <div class="climate-alert-meta">
                <span><i class="fa-solid fa-location-dot"></i> <strong>Ubicación:</strong> ${escapeHtml(alert.location)}</span>
                <span><i class="fa-regular fa-clock"></i> <strong>Generado:</strong> ${formatDateTime(alert.generatedAt)}</span>
                <span><i class="fa-solid fa-sliders"></i> <strong>Variables origen:</strong> <code>${escapeHtml(alert.triggerVariables)}</code></span>
              </div>

              <p class="climate-alert-desc">${escapeHtml(alert.description)}</p>

              <div class="climate-alert-recommendation">
                <strong><i class="fa-solid fa-lightbulb"></i> Recomendación orientativa:</strong>
                <span>${escapeHtml(alert.recommendation)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

