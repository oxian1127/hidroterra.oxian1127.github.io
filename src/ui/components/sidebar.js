/**
 * Componente: Menú Lateral de Navegación (Sidebar)
 */

import { MODULES_CONFIG, SIDEBAR_GROUPS_CONFIG } from '../../config/modules.config.js';
import { APP_CONFIG } from '../../config/app.config.js';

export class Sidebar {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this.activeRoute = 'dashboard';
    this.storageSummaryText = 'IndexedDB Local';
  }

  setActiveRoute(route) {
    this.activeRoute = route;
    const items = document.querySelectorAll('.nav-item');
    items.forEach(el => {
      if (el.dataset.route === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    const groups = document.querySelectorAll('.nav-group');
    groups.forEach(groupEl => {
      const hasActiveChild = Boolean(groupEl.querySelector(`.nav-item[data-route="${route}"]`));
      const toggleBtn = groupEl.querySelector('.nav-group-toggle');
      groupEl.classList.toggle('has-active', hasActiveChild);
      if (hasActiveChild) {
        groupEl.classList.add('open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  setStorageSummary(text) {
    this.storageSummaryText = text;
    const el = document.querySelector('#sidebar-storage-stat');
    if (el) el.textContent = text;
  }

  _renderNavItem(mod, isSubItem = false) {
    const isActive = this.activeRoute === mod.id;
    const iconHtml = isSubItem ? '' : `<span class="nav-icon"><i class="${mod.icon}"></i></span>`;
    return `
      <a class="nav-item ${isSubItem ? 'nav-subitem' : ''} ${isActive ? 'active' : ''}" 
         data-route="${mod.id}" 
         title="${mod.description}">
        ${iconHtml}
        <span class="nav-item-label">${mod.label}</span>
      </a>
    `;
  }

  render() {
    const topLevelModules = MODULES_CONFIG.filter(mod => !mod.group);

    const groupsHtml = SIDEBAR_GROUPS_CONFIG.map(group => {
      const groupModules = MODULES_CONFIG.filter(mod => mod.group === group.id);
      const hasActive = groupModules.some(mod => mod.id === this.activeRoute);
      const isOpen = hasActive;

      return `
        <div class="nav-group ${isOpen ? 'open' : ''} ${hasActive ? 'has-active' : ''}" data-group-id="${group.id}">
          <button type="button" class="nav-group-toggle" aria-expanded="${isOpen ? 'true' : 'false'}">
            <span class="nav-icon"><i class="${group.icon}"></i></span>
            <span class="nav-group-label">${group.label}</span>
            <span class="nav-group-caret"><i class="fa-solid fa-chevron-down"></i></span>
          </button>
          <div class="nav-group-items">
            ${groupModules.map(mod => this._renderNavItem(mod, true)).join('')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <img src="./assets/icons/icon-192.svg" alt="HIDROTERRA" class="sidebar-logo" />
          <div class="sidebar-title-group">
            <h1>${APP_CONFIG.name}</h1>
            <p>Montes de María</p>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title">Menú Principal</div>
          ${topLevelModules.map(mod => this._renderNavItem(mod, false)).join('')}
          ${groupsHtml}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-storage-indicator">
            <span>Almacenamiento:</span>
            <strong id="sidebar-storage-stat">${this.storageSummaryText}</strong>
          </div>
          <div>Versión PWA ${APP_CONFIG.version} (Offline-First)</div>
          <div class="sidebar-developer-credit">
            Software desarrollado por <strong>José Félix Ibáñez Romero. Ing. de Sistemas</strong>
          </div>
        </div>
      </aside>
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    `;
  }

  bindEvents(container) {
    const navItems = container.querySelectorAll('.nav-item');
    const groupToggles = container.querySelectorAll('.nav-group-toggle');
    const sidebar = container.querySelector('#app-sidebar');
    const backdrop = container.querySelector('#sidebar-backdrop');

    groupToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const groupEl = toggle.closest('.nav-group');
        if (!groupEl) return;
        const willOpen = !groupEl.classList.contains('open');

        // Cerrar otros grupos desplegados para mantener el menú minimalista
        container.querySelectorAll('.nav-group.open').forEach(otherGroup => {
          if (otherGroup !== groupEl) {
            otherGroup.classList.remove('open');
            const otherBtn = otherGroup.querySelector('.nav-group-toggle');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        groupEl.classList.toggle('open', willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.dataset.route;
        if (route && typeof this.onNavigate === 'function') {
          this.onNavigate(route);
        }
        // Cerrar sidebar en móvil al seleccionar
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          if (backdrop) backdrop.classList.remove('active');
        }
      });
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
        backdrop.classList.remove('active');
      });
    }
  }
}
