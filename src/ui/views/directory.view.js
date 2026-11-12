/**
 * Vista: Directorio Público de Organizaciones — HIDROTERRA (Sección 12)
 *
 * Disponible con y sin inicio de sesión.
 * Consulta exclusivamente la colección `public_directory` con la información institucional
 * explícitamente autorizada para publicación por cada organización.
 * Nunca expone hashes, sales, datos privados de usuarios ni coordenadas reservadas.
 */

import { sessionService } from '../../core/session.service.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';

export class DirectoryView {
  constructor(router) {
    this.router = router;
    this.entries = [];
    this.filters = {
      search: '',
      department: 'all',
      municipality: 'all',
      organizationType: 'all'
    };
  }

  async render(container) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <p class="text-muted">Consultando Directorio Público de Organizaciones en Firestore...</p>
      </div>
    `;

    this.entries = await sessionService.getPublicDirectoryEntries();
    this._renderView(container);
  }

  _getFilteredEntries() {
    return this.entries.filter(item => {
      if (this.filters.department !== 'all' && item.department !== this.filters.department) {
        return false;
      }
      if (this.filters.municipality !== 'all' && item.municipality !== this.filters.municipality) {
        return false;
      }
      if (this.filters.organizationType !== 'all' && item.organizationType !== this.filters.organizationType) {
        return false;
      }
      if (this.filters.search) {
        const q = this.filters.search.trim().toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(q) || (item.shortName || '').toLowerCase().includes(q);
        const matchMuni = (item.municipality || '').toLowerCase().includes(q);
        const matchAreas = Array.isArray(item.workAreas) && item.workAreas.some(a => a.toLowerCase().includes(q));
        if (!matchName && !matchMuni && !matchAreas) return false;
      }
      return true;
    });
  }

  _renderView(container) {
    const isAuthenticated = sessionService.isAuthenticated();
    const departments = [...new Set(this.entries.map(e => e.department).filter(Boolean))].sort();
    const municipalities = [...new Set(this.entries.map(e => e.municipality).filter(Boolean))].sort();
    const orgTypes = [...new Set(this.entries.map(e => e.organizationType).filter(Boolean))].sort();
    const filtered = this._getFilteredEntries();

    container.innerHTML = `
      <div class="directory-view">
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Directorio Público de Organizaciones — Montes de María</h2>
            <p class="text-muted">
              Red de colaboración comunitaria e interinstitucional para la gestión y monitoreo del agua en el territorio.
            </p>
          </div>
          <div class="d-flex gap-2">
            ${!isAuthenticated ? `
              <button type="button" class="btn btn-primary btn-sm" id="btn-dir-go-login">
                <span>Iniciar Sesión</span>
              </button>
            ` : `
              <button type="button" class="btn btn-outline btn-sm" id="btn-dir-manage-my-org">
                <span>Configurar Publicación de Mi Organización</span>
              </button>
            `}
          </div>
        </div>

        <!-- Aviso normativo de privacidad y consentimiento (Ley 1581 de 2012 Colombia) -->
        <div class="card mb-4" style="border-left: 4px solid var(--color-green-700);">
          <div class="card-body" style="padding: var(--spacing-3) var(--spacing-4); font-size: var(--font-size-xs); color: var(--color-neutral-700); line-height: 1.5;">
            <strong>Aviso de Privacidad y Protección de Datos (Ley 1581 de 2012 y Decreto 1377 de 2013 — Colombia):</strong>
            Este directorio publica exclusivamente la información institucional que cada organización participante ha autorizado de forma voluntaria y expresa en su configuración de visibilidad. No se exponen datos privados de usuarios, credenciales ni coordenadas reservadas de predios.
          </div>
        </div>

        <!-- Barra de filtros -->
        <div class="filter-bar mb-4" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--spacing-3); padding: var(--spacing-3);">
          <div>
            <label class="form-label" for="dir-search">Buscar por nombre o área</label>
            <input type="text" id="dir-search" class="form-control" placeholder="Ej. Caracolí, Las Palmas, Manantial..." value="${escapeHtml(this.filters.search)}" />
          </div>
          <div>
            <label class="form-label" for="dir-dept">Departamento</label>
            <select id="dir-dept" class="form-control">
              <option value="all">Todos los departamentos</option>
              ${departments.map(d => `<option value="${escapeHtml(d)}" ${this.filters.department === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" for="dir-muni">Municipio</label>
            <select id="dir-muni" class="form-control">
              <option value="all">Todos los municipios</option>
              ${municipalities.map(m => `<option value="${escapeHtml(m)}" ${this.filters.municipality === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" for="dir-type">Tipo de organización</label>
            <select id="dir-type" class="form-control">
              <option value="all">Todos los tipos</option>
              ${orgTypes.map(t => `<option value="${escapeHtml(t)}" ${this.filters.organizationType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Tarjetas institucionales -->
        <div id="dir-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: var(--spacing-4);">
          ${filtered.length === 0 ? `
            <div class="card" style="grid-column: 1 / -1; padding: var(--spacing-6); text-align: center;">
              <p class="text-muted" style="margin: 0;">No se encontraron organizaciones con los filtros seleccionados.</p>
            </div>
          ` : filtered.map(org => this._renderOrganizationCard(org)).join('')}
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _renderOrganizationCard(org) {
    const areas = Array.isArray(org.workAreas) && org.workAreas.length > 0
      ? org.workAreas
      : ['Monitoreo Hídrico Comunitario'];

    const logoHtml = org.logoDataUrl
      ? `<img src="${escapeHtml(org.logoDataUrl)}" alt="${escapeHtml(org.name)}" style="width: 52px; height: 52px; border-radius: 0.6rem; object-fit: cover; border: 1px solid var(--color-neutral-200); flex-shrink: 0;" />`
      : `<div style="width: 52px; height: 52px; border-radius: 0.6rem; background: linear-gradient(135deg, var(--color-green-700), var(--color-blue-700)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.05rem; flex-shrink: 0;">
           ${escapeHtml((org.shortName || org.name || 'OR').substring(0, 2).toUpperCase())}
         </div>`;

    return `
      <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--spacing-3);">
          <div style="display: flex; align-items: flex-start; gap: var(--spacing-3);">
            ${logoHtml}
            <div style="min-width: 0; flex: 1;">
              <span class="badge badge-success" style="margin-bottom: 4px; display: inline-block;">${escapeHtml(org.organizationType || 'Organización Comunitaria')}</span>
              <h3 style="font-size: var(--font-size-base); margin: 0; color: var(--color-neutral-900); line-height: 1.3;">
                ${escapeHtml(org.name)}
              </h3>
              <p style="margin: 3px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                ${escapeHtml(org.municipality || '—')}, ${escapeHtml(org.department || '—')}
              </p>
            </div>
          </div>

          <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-700); line-height: 1.55;">
            ${escapeHtml(org.description || 'Organización participante en la red de monitoreo hídrico territorial de Montes de María.')}
          </p>

          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--color-neutral-600); margin-bottom: 6px; text-transform: uppercase;">
              Áreas de trabajo:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${areas.map(a => `<span class="badge badge-info" style="font-weight: 500;">${escapeHtml(a)}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="card-footer" style="padding: var(--spacing-3) var(--spacing-4); border-top: 1px solid var(--color-neutral-200); display: flex; gap: 8px; background-color: var(--color-neutral-50); border-bottom-left-radius: 0.85rem; border-bottom-right-radius: 0.85rem;">
          <button type="button" class="btn btn-outline btn-sm btn-dir-profile" data-org-id="${escapeHtml(org.id)}" style="flex: 1;">
            <span>Ver perfil</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm btn-dir-contact" data-org-id="${escapeHtml(org.id)}" style="flex: 1;">
            <span>Contactar</span>
          </button>
        </div>
      </div>
    `;
  }

  _bindEvents(container) {
    container.querySelector('#btn-dir-go-login')?.addEventListener('click', () => {
      this.router.navigate('login');
    });

    container.querySelector('#btn-dir-manage-my-org')?.addEventListener('click', () => {
      this.router.navigate('settings', { tab: 'organization' });
    });

    const searchEl = container.querySelector('#dir-search');
    const deptEl = container.querySelector('#dir-dept');
    const muniEl = container.querySelector('#dir-muni');
    const typeEl = container.querySelector('#dir-type');

    const refreshList = () => {
      this.filters.search = searchEl?.value || '';
      this.filters.department = deptEl?.value || 'all';
      this.filters.municipality = muniEl?.value || 'all';
      this.filters.organizationType = typeEl?.value || 'all';

      const grid = container.querySelector('#dir-cards-grid');
      if (grid) {
        const filtered = this._getFilteredEntries();
        grid.innerHTML = filtered.length === 0
          ? `<div class="card" style="grid-column: 1 / -1; padding: var(--spacing-6); text-align: center;"><p class="text-muted" style="margin: 0;">No se encontraron organizaciones con los filtros seleccionados.</p></div>`
          : filtered.map(org => this._renderOrganizationCard(org)).join('');
        this._bindCardButtons(grid);
      }
    };

    searchEl?.addEventListener('input', refreshList);
    deptEl?.addEventListener('change', refreshList);
    muniEl?.addEventListener('change', refreshList);
    typeEl?.addEventListener('change', refreshList);

    this._bindCardButtons(container);
  }

  _bindCardButtons(scope) {
    scope.querySelectorAll('.btn-dir-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        const org = this.entries.find(e => e.id === btn.dataset.orgId);
        if (org) this._openProfileModal(org);
      });
    });

    scope.querySelectorAll('.btn-dir-contact').forEach(btn => {
      btn.addEventListener('click', () => {
        const org = this.entries.find(e => e.id === btn.dataset.orgId);
        if (org) this._openContactModal(org);
      });
    });
  }

  _openProfileModal(org) {
    const areas = Array.isArray(org.workAreas) && org.workAreas.length > 0
      ? org.workAreas.join(', ')
      : 'Monitoreo Hídrico Comunitario';

    modal.open({
      title: `Perfil Institucional — ${org.name}`,
      size: 'md',
      content: `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-3); font-size: var(--font-size-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span class="badge badge-success">${escapeHtml(org.organizationType || 'Organización Comunitaria')}</span>
            <span class="badge badge-info">${escapeHtml(org.municipality || '—')}, ${escapeHtml(org.department || '—')}</span>
          </div>
          <div>
            <strong>Nombre completo:</strong>
            <p style="margin: 2px 0 0; color: var(--color-neutral-700);">${escapeHtml(org.name)}</p>
          </div>
          ${org.shortName ? `
            <div>
              <strong>Nombre corto / Sigla:</strong>
              <p style="margin: 2px 0 0; color: var(--color-neutral-700);">${escapeHtml(org.shortName)}</p>
            </div>
          ` : ''}
          <div>
            <strong>Descripción institucional:</strong>
            <p style="margin: 2px 0 0; color: var(--color-neutral-700); line-height: 1.55;">${escapeHtml(org.description || '—')}</p>
          </div>
          <div>
            <strong>Áreas de trabajo en el territorio:</strong>
            <p style="margin: 2px 0 0; color: var(--color-neutral-700);">${escapeHtml(areas)}</p>
          </div>
          ${org.contactName ? `
            <div>
              <strong>Representante / Enlace público autorizado:</strong>
              <p style="margin: 2px 0 0; color: var(--color-neutral-700);">${escapeHtml(org.contactName)} ${org.contactRole ? `(${escapeHtml(org.contactRole)})` : ''}</p>
            </div>
          ` : ''}
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-primary" data-modal-close>Cerrar</button>
      `
    });
  }

  _openContactModal(org) {
    const hasPublicContact = Boolean(
      org.publicEmail || org.publicPhone || org.publicWhatsapp || org.publicWebsite || org.publicSocialLinks || org.contactName
    );

    modal.open({
      title: `Contacto Institucional — ${org.name}`,
      size: 'md',
      content: `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-3); font-size: var(--font-size-sm);">
          <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
            Canales de contacto autorizados explícitamente por <strong>${escapeHtml(org.name)}</strong> conforme a su configuración de visibilidad pública:
          </p>

          ${!hasPublicContact ? `
            <div style="padding: var(--spacing-4); background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);">
              Esta organización aún no ha habilitado canales de contacto público directo (correo o teléfono) en su configuración de privacidad.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px; padding: var(--spacing-3); background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);">
              ${org.contactName ? `<div><strong>Contacto / Representante:</strong> ${escapeHtml(org.contactName)} ${org.contactRole ? `— ${escapeHtml(org.contactRole)}` : ''}</div>` : ''}
              ${org.publicEmail ? `<div><strong>Correo institucional público:</strong> <span class="allow-copy" data-allow-copy="true">${escapeHtml(org.publicEmail)}</span></div>` : '<div><strong>Correo público:</strong> <em>No publicado por preferencia de privacidad</em></div>'}
              ${org.publicPhone ? `<div><strong>Teléfono:</strong> <span class="allow-copy" data-allow-copy="true">${escapeHtml(org.publicPhone)}</span></div>` : ''}
              ${org.publicWhatsapp ? `<div><strong>WhatsApp:</strong> <span class="allow-copy" data-allow-copy="true">${escapeHtml(org.publicWhatsapp)}</span></div>` : ''}
              ${org.publicWebsite ? `<div><strong>Página web:</strong> <a href="${escapeHtml(org.publicWebsite)}" target="_blank" rel="noopener">${escapeHtml(org.publicWebsite)}</a></div>` : ''}
              ${org.publicSocialLinks ? `<div><strong>Redes sociales:</strong> ${escapeHtml(org.publicSocialLinks)}</div>` : ''}
            </div>
          `}
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-primary" data-modal-close>Cerrar</button>
      `
    });
  }
}

