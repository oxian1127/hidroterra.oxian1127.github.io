/**
 * Componente: Generador de Campos de Formulario y Captura de Coordenadas
 */

import { escapeHtml } from '../../core/validators.js';
import { GeolocationService } from '../../infrastructure/geo/geolocation.js';
import { isWithinMontesDeMaria, formatCoordinates } from '../../domain/rules/coordinates.rules.js';
import { notification } from './notification.js';

export function renderTextField({ id, label, value = '', placeholder = '', required = false, help = '', type = 'text', min = null, max = null, step = null }) {
  return `
    <div class="form-group">
      <label class="form-label ${required ? 'required' : ''}" for="${id}">${escapeHtml(label)}</label>
      <input type="${type}" id="${id}" name="${id}" class="form-control" 
             value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"
             ${required ? 'required' : ''}
             ${min !== null ? `min="${min}"` : ''}
             ${max !== null ? `max="${max}"` : ''}
             ${step !== null ? `step="${step}"` : ''} />
      ${help ? `<div class="form-help">${escapeHtml(help)}</div>` : ''}
      <div class="form-error" id="error-${id}"></div>
    </div>
  `;
}

export function renderSelectField({ id, label, value = '', options = [], required = false, help = '' }) {
  return `
    <div class="form-group">
      <label class="form-label ${required ? 'required' : ''}" for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${id}" class="form-control form-select" ${required ? 'required' : ''}>
        ${options.map(opt => `
          <option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(value) ? 'selected' : ''}>
            ${escapeHtml(opt.label)}
          </option>
        `).join('')}
      </select>
      ${help ? `<div class="form-help">${escapeHtml(help)}</div>` : ''}
      <div class="form-error" id="error-${id}"></div>
    </div>
  `;
}

export function renderTextareaField({ id, label, value = '', placeholder = '', required = false, help = '' }) {
  return `
    <div class="form-group">
      <label class="form-label ${required ? 'required' : ''}" for="${id}">${escapeHtml(label)}</label>
      <textarea id="${id}" name="${id}" class="form-control" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>
      ${help ? `<div class="form-help">${escapeHtml(help)}</div>` : ''}
      <div class="form-error" id="error-${id}"></div>
    </div>
  `;
}

export function renderCoordinatesPicker({ latId = 'latitude', lonId = 'longitude', altId = null, latitude = '', longitude = '', altitude = '', required = false }) {
  return `
    <div class="coords-picker-box">
      <div class="coords-picker-header">
        <span class="coords-picker-title"><i class="fa-solid fa-location-dot" style="color: var(--color-green-700);"></i> Georreferenciación (Coordenadas)</span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-get-gps-location">
          <span><i class="fa-solid fa-location-crosshairs"></i> Obtener ubicación actual</span>
        </button>
      </div>

      <p class="form-help" style="margin-bottom: var(--spacing-3);">
        Las coordenadas pueden capturarse con el GPS del navegador o ingresarse manualmente en grados decimales (WGS84).
      </p>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label ${required ? 'required' : ''}" for="${latId}">Latitud (-90 a 90°)</label>
          <input type="number" step="0.000001" min="-90" max="90" id="${latId}" name="${latId}" 
                 class="form-control" value="${latitude !== null ? latitude : ''}" placeholder="Ej: 9.717450" />
        </div>
        <div class="form-group">
          <label class="form-label ${required ? 'required' : ''}" for="${lonId}">Longitud (-180 a 180°)</label>
          <input type="number" step="0.000001" min="-180" max="180" id="${lonId}" name="${lonId}" 
                 class="form-control" value="${longitude !== null ? longitude : ''}" placeholder="Ej: -75.121300" />
        </div>
      </div>

      ${altId ? `
        <div class="form-group">
          <label class="form-label" for="${altId}">Altitud (metros sobre el nivel del mar - msnm, opcional)</label>
          <input type="number" step="1" id="${altId}" name="${altId}" 
                 class="form-control" value="${altitude !== null ? altitude : ''}" placeholder="Ej: 160" />
        </div>
      ` : ''}

      <div id="coords-status-feedback"></div>
    </div>
  `;
}

export function bindCoordinatesPickerEvents(container, { latId = 'latitude', lonId = 'longitude', altId = null }) {
  const btn = container.querySelector('#btn-get-gps-location');
  const latInput = container.querySelector(`#${latId}`);
  const lonInput = container.querySelector(`#${lonId}`);
  const altInput = altId ? container.querySelector(`#${altId}`) : null;
  const feedback = container.querySelector('#coords-status-feedback');

  const checkMontesDeMariaWarning = () => {
    const lat = latInput.value ? Number(latInput.value) : null;
    const lon = lonInput.value ? Number(lonInput.value) : null;

    if (lat !== null && lon !== null) {
      const isRegional = isWithinMontesDeMaria(lat, lon);
      if (isRegional === false) {
        feedback.innerHTML = `
          <div class="coords-warning-badge">
            <i class="fa-solid fa-circle-info"></i> Las coordenadas ingresadas (${lat}, ${lon}) se encuentran fuera del polígono típico de Montes de María. El registro se guardará con exactitud.
          </div>
        `;
      } else {
        feedback.innerHTML = `
          <span class="coords-feedback-badge"><i class="fa-solid fa-check"></i> Coordenadas en rango de Montes de María</span>
        `;
      }
    } else {
      feedback.innerHTML = '';
    }
  };

  if (latInput) latInput.addEventListener('input', checkMontesDeMariaWarning);
  if (lonInput) lonInput.addEventListener('input', checkMontesDeMariaWarning);

  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Consultando sensor GPS...</span>';
      feedback.innerHTML = '<span class="text-muted">Esperando fijación de señal satelital/red...</span>';

      try {
        const coords = await GeolocationService.getCurrentPosition();
        latInput.value = coords.latitude;
        lonInput.value = coords.longitude;
        if (altInput && coords.altitude !== null) {
          altInput.value = coords.altitude;
        }

        notification.success('GPS Capturado', `Precisión aproximada: ±${coords.accuracy} metros.`);
        checkMontesDeMariaWarning();
      } catch (err) {
        notification.warning('Captura GPS no disponible', err.message);
        feedback.innerHTML = `<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(err.message)}</span>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span><i class="fa-solid fa-location-crosshairs"></i> Obtener ubicación actual</span>';
      }
    });
  }
}
