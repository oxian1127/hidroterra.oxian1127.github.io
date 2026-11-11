/**
 * Componente: Menú Lateral de Navegación (Sidebar)
 */

import { MODULES_CONFIG } from '../../config/modules.config.js';
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
  }

  setStorageSummary(text) {
    this.storageSummaryText = text;
    const el = document.querySelector('#sidebar-storage-stat');
    if (el) el.textContent = text;
  }

  render() {
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
          <div class="nav-section-title">Monitoreo Territorial</div>
          ${MODULES_CONFIG.map(mod => `
            <a class="nav-item ${this.activeRoute === mod.id ? 'active' : ''}" 
               data-route="${mod.id}" 
               title="${mod.description}">
              <span>${mod.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-storage-indicator">
            <span>Almacenamiento:</span>
            <strong id="sidebar-storage-stat">${this.storageSummaryText}</strong>
          </div>
          <div>Versión PWA ${APP_CONFIG.version} (Offline-First)</div>
        </div>
      </aside>
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    `;
  }

  bindEvents(container) {
    const navItems = container.querySelectorAll('.nav-item');
    const sidebar = container.querySelector('#app-sidebar');
    const backdrop = container.querySelector('#sidebar-backdrop');

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
