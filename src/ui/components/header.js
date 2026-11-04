/**
 * Componente: Encabezado Superior (Header)
 */

import { escapeHtml } from '../../core/validators.js';
import { ThemeService } from '../../core/theme.js';
import { events } from '../../core/events.js';

export class Header {
  constructor({ onToggleMenu, onQuickBackup }) {
    this.onToggleMenu = onToggleMenu;
    this.onQuickBackup = onQuickBackup;
    this.currentTitle = 'Panel de Control';
    this.currentBreadcrumb = 'Inicio';
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.backupWarning = false;
  }

  setTitle(title, breadcrumb = 'Inicio') {
    this.currentTitle = title;
    this.currentBreadcrumb = breadcrumb;
    const titleEl = document.querySelector('#header-page-title');
    const breadcrumbEl = document.querySelector('#header-breadcrumb');
    if (titleEl) titleEl.textContent = title;
    if (breadcrumbEl) breadcrumbEl.textContent = breadcrumb;
  }

  setOnlineStatus(online) {
    this.isOnline = online;
    const badge = document.querySelector('#header-conn-badge');
    if (badge) {
      if (online) {
        badge.className = 'connectivity-badge online';
        badge.title = 'Estado: Conectado';
        badge.innerHTML = '<span class="status-dot online"></span> <i class="fa-solid fa-wifi"></i> <span class="header-label-text">Conectado</span>';
      } else {
        badge.className = 'connectivity-badge offline';
        badge.title = 'Estado: Sin Conexión (Offline)';
        badge.innerHTML = '<span class="status-dot offline"></span> <i class="fa-solid fa-plane"></i> <span class="header-label-text">Sin Conexión (Offline)</span>';
      }
    }
  }

  setBackupWarning(showWarning, daysSince = null) {
    this.backupWarning = showWarning;
    const banner = document.querySelector('#header-backup-alert');
    if (banner) {
      if (showWarning) {
        banner.style.display = 'flex';
        const msgEl = banner.querySelector('.alert-message');
        if (msgEl) {
          msgEl.textContent = daysSince !== null
            ? `Han transcurrido ${daysSince} días desde el último respaldo. Se recomienda exportar una copia JSON para asegurar sus datos locales.`
            : 'Hay datos registrados sin respaldo. Recuerde exportar una copia JSON para evitar pérdidas si borra la memoria del navegador.';
        }
      } else {
        banner.style.display = 'none';
      }
    }
  }

  render() {
    const isDark = ThemeService.isDark();

    return `
      <header class="app-header">
        <div class="header-left">
          <button class="menu-toggle-btn" id="btn-toggle-sidebar" aria-label="Abrir menú de navegación">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="header-title-wrapper">
            <h2 id="header-page-title">${escapeHtml(this.currentTitle)}</h2>
            <div class="header-breadcrumb" id="header-breadcrumb">${escapeHtml(this.currentBreadcrumb)}</div>
          </div>
        </div>

        <div class="header-right">
          <!-- Conmutador rápido de Modo Oscuro / Claro -->
          <button class="btn-theme-toggle" id="btn-header-theme" 
                  title="${isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}" 
                  aria-label="Cambiar tema de color">
            <i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
          </button>

          <div class="connectivity-badge ${this.isOnline ? 'online' : 'offline'}" id="header-conn-badge" title="${this.isOnline ? 'Estado: Conectado' : 'Estado: Sin Conexión (Offline)'}">
            <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
            ${this.isOnline ? '<i class="fa-solid fa-wifi"></i> <span class="header-label-text">Conectado</span>' : '<i class="fa-solid fa-plane"></i> <span class="header-label-text">Sin Conexión (Offline)</span>'}
          </div>

          <button class="btn btn-outline btn-sm" id="btn-header-backup" title="Exportar copia de seguridad en JSON">
            <i class="fa-solid fa-floppy-disk"></i> <span class="header-label-text">Respaldo JSON</span>
          </button>
        </div>
      </header>

      <div class="global-alert-banner" id="header-backup-alert" style="display: ${this.backupWarning ? 'flex' : 'none'};">
        <div>
          <strong>Aviso de seguridad territorial:</strong>
          <span class="alert-message">
            Hay información registrada en el dispositivo sin respaldo reciente.
          </span>
        </div>
        <button class="btn btn-sm btn-primary" id="btn-alert-backup-now">Exportar Ahora</button>
      </div>
    `;
  }

  bindEvents(container) {
    const toggleBtn = container.querySelector('#btn-toggle-sidebar');
    const backupBtn = container.querySelector('#btn-header-backup');
    const alertBackupBtn = container.querySelector('#btn-alert-backup-now');
    const themeBtn = container.querySelector('#btn-header-theme');

    if (toggleBtn && typeof this.onToggleMenu === 'function') {
      toggleBtn.addEventListener('click', this.onToggleMenu);
    }

    if (backupBtn && typeof this.onQuickBackup === 'function') {
      backupBtn.addEventListener('click', this.onQuickBackup);
    }

    if (alertBackupBtn && typeof this.onQuickBackup === 'function') {
      alertBackupBtn.addEventListener('click', this.onQuickBackup);
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        ThemeService.toggleTheme();
      });
    }

    events.on('theme:changed', ({ isDark }) => {
      const btn = document.querySelector('#btn-header-theme');
      if (btn) {
        btn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
        btn.title = isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro';
      }
    });
  }
}
