/**
 * Componente: Encabezado Superior (Header)
 * Incluye estado de sesión multiorganización (Usuario, Organización, Rol),
 * estado de conexión con Firebase Firestore, menú de perfil y cierre de sesión,
 * optimizado para pantallas de escritorio y dispositivos móviles.
 */

import { escapeHtml } from '../../core/validators.js';
import { ThemeService } from '../../core/theme.js';
import { events } from '../../core/events.js';
import { sessionService, ROLE_LABELS } from '../../core/session.service.js';
import { firebaseService } from '../../../js/firebase-service.js';
import { notification } from './notification.js';

export class Header {
  constructor({ onToggleMenu, onQuickBackup }) {
    this.onToggleMenu = onToggleMenu;
    this.onQuickBackup = onQuickBackup;
    this.currentTitle = 'Panel de Control';
    this.currentBreadcrumb = 'Inicio';
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.firebaseConnected = Boolean(firebaseService.status === 'connected');
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
    this._refreshConnectivityBadge();
  }

  setFirebaseStatus(connected) {
    this.firebaseConnected = Boolean(connected);
    this._refreshConnectivityBadge();
  }

  _refreshConnectivityBadge() {
    const badge = document.querySelector('#header-conn-badge');
    if (!badge) return;
    if (this.isOnline && this.firebaseConnected) {
      badge.className = 'connectivity-badge online';
      badge.title = 'Conectado a Firebase Firestore (hidroterra-32ce7 · nam5)';
      badge.innerHTML = '<span class="status-dot online"></span> <span class="header-label-text">Firebase Conectado</span>';
    } else if (this.isOnline) {
      badge.className = 'connectivity-badge online';
      badge.title = 'Red activa · Persistencia local y cola de sincronización lista';
      badge.innerHTML = '<span class="status-dot online"></span> <span class="header-label-text">En línea (Local/Sync)</span>';
    } else {
      badge.className = 'connectivity-badge offline';
      badge.title = 'Estado: Sin Conexión (Offline-First IndexedDB)';
      badge.innerHTML = '<span class="status-dot offline"></span> <span class="header-label-text">Sin Conexión (Offline)</span>';
    }
  }

  setBackupWarning(showWarning, daysSince = null) {
    this.backupWarning = showWarning;
    const banner = document.querySelector('#header-backup-alert');
    if (banner) {
      if (showWarning && sessionService.isAuthenticated()) {
        banner.style.display = 'flex';
        const msgEl = banner.querySelector('.alert-message');
        if (msgEl) {
          msgEl.textContent = daysSince !== null
            ? `Han transcurrido ${daysSince} días desde el último respaldo. Se recomienda exportar una copia JSON o sincronizar con Firebase.`
            : 'Hay datos registrados localmente. Recuerde sincronizar con Firebase o exportar una copia JSON.';
        }
      } else {
        banner.style.display = 'none';
      }
    }
  }

  _renderSessionBar() {
    const user = sessionService.getCurrentUser();
    const org = sessionService.getCurrentOrganization();
    if (!user) {
      return `
        <div class="header-session-pill unauthenticated" id="header-session-container">
          <span class="badge badge-info header-public-badge">Vista Pública</span>
          <button type="button" class="btn btn-primary btn-sm header-login-btn" id="btn-header-go-login">
            <span>Iniciar sesión</span>
          </button>
        </div>
      `;
    }

    const fullName = user.name || `${user.firstName || user.nombre || ''} ${user.lastName || user.apellidos || ''}`.trim() || user.email;
    const orgName = org?.shortName || org?.name || org?.nombre || user.organizationName || user.organizationId;
    const roleLabel = ROLE_LABELS[user.role] || user.role;

    return `
      <div class="header-session-pill authenticated" id="header-session-container">
        <button type="button" class="btn btn-outline btn-sm header-profile-btn" id="btn-header-profile" title="Mi Perfil (${escapeHtml(fullName)} · ${escapeHtml(orgName)} · ${escapeHtml(roleLabel)})">
          <span class="header-profile-info">
            <strong class="header-profile-name">${escapeHtml(fullName)}</strong>
            <small class="header-profile-meta">${escapeHtml(orgName)} · ${escapeHtml(roleLabel)}</small>
          </span>
        </button>
        <button type="button" class="btn btn-outline btn-sm header-logout-btn" id="btn-header-logout" title="Cerrar sesión activa">
          <span>Cerrar sesión</span>
        </button>
      </div>
    `;
  }

  refreshSessionUI() {
    const slot = document.querySelector('#header-session-slot');
    if (slot) {
      slot.innerHTML = this._renderSessionBar();
      this._bindSessionButtons(slot);
    }
    this.setBackupWarning(this.backupWarning);
  }

  render() {
    const isDark = ThemeService.isDark();

    return `
      <header class="app-header">
        <div class="header-left">
          <button class="menu-toggle-btn" id="btn-toggle-sidebar" aria-label="Abrir menú de navegación">
            <span>Menú</span>
          </button>
          <div class="header-title-wrapper">
            <h2 id="header-page-title">${escapeHtml(this.currentTitle)}</h2>
            <div class="header-breadcrumb" id="header-breadcrumb">${escapeHtml(this.currentBreadcrumb)}</div>
          </div>
        </div>

        <div class="header-right">
          <div id="header-session-slot" class="header-session-slot">
            ${this._renderSessionBar()}
          </div>

          <!-- Conmutador rápido de Modo Oscuro / Claro -->
          <button class="btn-theme-toggle" id="btn-header-theme" 
                  title="${isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}" 
                  aria-label="Cambiar tema de color">
            <span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>

          <div class="connectivity-badge ${this.isOnline ? 'online' : 'offline'}" id="header-conn-badge" title="${this.isOnline ? 'Estado: Conectado' : 'Estado: Sin Conexión (Offline)'}">
            <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
            <span class="header-label-text">${this.isOnline ? (this.firebaseConnected ? 'Firebase Conectado' : 'En línea (Local/Sync)') : 'Sin Conexión (Offline)'}</span>
          </div>

          <button class="btn btn-outline btn-sm" id="btn-header-backup" title="Exportar copia de seguridad en JSON">
            <span>Respaldo JSON</span>
          </button>
        </div>
      </header>

      <div class="global-alert-banner" id="header-backup-alert" style="display: ${this.backupWarning && sessionService.isAuthenticated() ? 'flex' : 'none'};">
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

  _bindSessionButtons(scope) {
    const profileBtn = scope.querySelector('#btn-header-profile');
    const logoutBtn = scope.querySelector('#btn-header-logout');
    const loginBtn = scope.querySelector('#btn-header-go-login');

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.location.hash = '#settings?tab=profile';
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await sessionService.logout();
        notification.info('Sesión cerrada', 'Ha cerrado su sesión en HIDROTERRA.');
        window.location.hash = '#login';
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        window.location.hash = '#login';
      });
    }
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

    this._bindSessionButtons(container);

    events.on('theme:changed', ({ isDark }) => {
      const btn = document.querySelector('#btn-header-theme');
      if (btn) {
        btn.innerHTML = `<span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>`;
        btn.title = isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro';
      }
    });

    events.on('session:changed', () => {
      this.refreshSessionUI();
    });

    events.on('firebase:status', ({ status, connected }) => {
      this.setFirebaseStatus(connected !== undefined ? connected : status === 'connected');
    });
  }
}
