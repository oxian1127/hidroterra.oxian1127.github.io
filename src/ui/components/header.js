/**
 * Componente: Encabezado Superior (Header)
 * Concentra toda la información de sesión (Usuario, Organización, Rol), estado de conexión
 * con Firebase Firestore, centro de Notificaciones/Alertas y acciones rápidas en un menú
 * compacto desplegable ubicado en la parte superior derecha de la barra superior,
 * tanto en escritorio como en dispositivos móviles.
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
    this.backupDaysSince = null;
    this.activeWaterAlerts = [];
    this.isQuickMenuOpen = false;
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

  _getConnectivityLabel() {
    if (this.isOnline && this.firebaseConnected) {
      return 'Firebase Conectado (nam5)';
    }
    if (this.isOnline) {
      return 'En línea (Local / Sync)';
    }
    return 'Sin Conexión (Offline)';
  }

  _refreshConnectivityBadge() {
    const badge = document.querySelector('#header-conn-badge');
    const triggerDot = document.querySelector('#header-trigger-status-dot');
    const labelText = this._getConnectivityLabel();

    if (triggerDot) {
      triggerDot.className = `status-dot ${this.isOnline ? 'online' : 'offline'}`;
      triggerDot.title = labelText;
    }

    if (badge) {
      badge.className = `connectivity-badge ${this.isOnline ? 'online' : 'offline'}`;
      badge.title = labelText;
      badge.innerHTML = `
        <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
        <span class="header-label-text">${escapeHtml(labelText)}</span>
      `;
    }
  }

  setBackupWarning(showWarning, daysSince = null, activeAlerts = null) {
    this.backupWarning = Boolean(showWarning);
    this.backupDaysSince = daysSince;
    if (Array.isArray(activeAlerts)) {
      this.activeWaterAlerts = activeAlerts;
    }
    this._refreshNotificationsUI();
  }

  setNotifications({ showBackupWarning = false, daysSince = null, activeAlerts = [] } = {}) {
    this.backupWarning = Boolean(showBackupWarning);
    this.backupDaysSince = daysSince;
    this.activeWaterAlerts = Array.isArray(activeAlerts) ? activeAlerts : [];
    this._refreshNotificationsUI();
  }

  _getNotificationsCount() {
    if (!sessionService.isAuthenticated()) return 0;
    let count = 0;
    if (this.backupWarning) count += 1;
    if (Array.isArray(this.activeWaterAlerts)) {
      count += this.activeWaterAlerts.length;
    }
    return count;
  }

  _renderNotificationsSection() {
    const isAuth = sessionService.isAuthenticated();
    if (!isAuth) {
      return `
        <div class="header-dropdown-section">
          <div class="header-dropdown-label">Notificaciones</div>
          <div class="header-notif-empty">Inicie sesión para consultar avisos y alertas territoriales.</div>
        </div>
      `;
    }

    const totalNotifs = this._getNotificationsCount();
    const backupMessage = this.backupDaysSince !== null
      ? `Han transcurrido ${this.backupDaysSince} días desde el último respaldo. Se recomienda exportar una copia JSON o sincronizar con Firebase.`
      : 'Hay datos registrados localmente sin respaldo reciente. Recuerde sincronizar con Firebase o exportar una copia JSON.';

    const topAlerts = (this.activeWaterAlerts || []).slice(0, 3);

    return `
      <div class="header-dropdown-section" id="header-dropdown-notifications">
        <div class="header-dropdown-label" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Notificaciones y Alertas</span>
          <span class="badge ${totalNotifs > 0 ? 'badge-warning' : 'badge-success'}">${totalNotifs}</span>
        </div>

        ${totalNotifs === 0 ? `
          <div class="header-notif-empty">
            Sin notificaciones ni alertas pendientes en este momento.
          </div>
        ` : `
          <div class="header-notif-list">
            ${this.backupWarning ? `
              <div class="header-notif-card warning">
                <div class="header-notif-title">Aviso de seguridad territorial</div>
                <p class="header-notif-text">${escapeHtml(backupMessage)}</p>
                <button type="button" class="btn btn-primary btn-sm header-notif-action" id="btn-alert-backup-now">
                  <span>Exportar Ahora</span>
                </button>
              </div>
            ` : ''}

            ${topAlerts.map(alert => `
              <div class="header-notif-card ${alert.priority === 'alta' ? 'danger' : 'warning'}">
                <div class="header-notif-title">
                  Alerta Hídrica (${escapeHtml((alert.priority || 'media').toUpperCase())})
                </div>
                <p class="header-notif-text">${escapeHtml(alert.description || alert.relatedEntityName || 'Alerta activa en fuente hídrica')}</p>
              </div>
            `).join('')}

            ${this.activeWaterAlerts.length > 0 ? `
              <button type="button" class="header-dropdown-item" id="btn-dropdown-go-alerts">
                <span>Ver Alertas Hídricas (${this.activeWaterAlerts.length})</span>
              </button>
            ` : ''}
          </div>
        `}
      </div>
    `;
  }

  _refreshNotificationsUI() {
    const count = this._getNotificationsCount();
    const badgeEl = document.querySelector('#header-notif-badge');
    if (badgeEl) {
      if (count > 0) {
        badgeEl.textContent = count > 99 ? '99+' : String(count);
        badgeEl.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    const dropdown = document.querySelector('#header-quick-dropdown');
    if (dropdown) {
      dropdown.innerHTML = this._renderQuickDropdownContent();
      this._bindDropdownActions(dropdown);
    }
  }

  _getTriggerSummary() {
    const user = sessionService.getCurrentUser();
    if (!user) {
      return 'Cuenta / Opciones';
    }
    const shortName = (user.firstName || user.name || user.email || 'Usuario').split(' ')[0];
    return shortName;
  }

  _renderQuickDropdownContent() {
    const user = sessionService.getCurrentUser();
    const org = sessionService.getCurrentOrganization();
    const isDark = ThemeService.isDark();
    const connLabel = this._getConnectivityLabel();

    if (!user) {
      return `
        <div class="header-dropdown-section">
          <div class="header-dropdown-label">Estado de Sesión</div>
          <div class="header-dropdown-user-box">
            <strong class="header-dropdown-user-name">Vista Pública</strong>
            <span class="header-dropdown-user-org">Acceso de consulta al Directorio de Organizaciones</span>
          </div>
        </div>

        <div class="header-dropdown-section">
          <div class="header-dropdown-label">Conexión y Base de Datos</div>
          <div class="connectivity-badge ${this.isOnline ? 'online' : 'offline'}" id="header-conn-badge">
            <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
            <span class="header-label-text">${escapeHtml(connLabel)}</span>
          </div>
        </div>

        ${this._renderNotificationsSection()}

        <div class="header-dropdown-actions">
          <button type="button" class="btn-theme-toggle header-dropdown-item" id="btn-header-theme">
            <span>${isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm header-dropdown-btn" id="btn-header-go-login">
            <span>Iniciar sesión</span>
          </button>
        </div>
      `;
    }

    const fullName = user.name || `${user.firstName || user.nombre || ''} ${user.lastName || user.apellidos || ''}`.trim() || user.email;
    const orgName = org?.name || org?.nombre || user.organizationName || user.organizationId;
    const roleLabel = ROLE_LABELS[user.role] || user.role;

    return `
      <div class="header-dropdown-section">
        <div class="header-dropdown-label">Sesión Activa</div>
        <div class="header-dropdown-user-box">
          <strong class="header-dropdown-user-name">${escapeHtml(fullName)}</strong>
          <span class="header-dropdown-user-org">${escapeHtml(orgName)}</span>
          <span class="badge badge-info header-dropdown-role-badge">${escapeHtml(roleLabel)}</span>
        </div>
      </div>

      <div class="header-dropdown-section">
        <div class="header-dropdown-label">Estado de Conexión</div>
        <div class="connectivity-badge ${this.isOnline ? 'online' : 'offline'}" id="header-conn-badge">
          <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
          <span class="header-label-text">${escapeHtml(connLabel)}</span>
        </div>
      </div>

      ${this._renderNotificationsSection()}

      <div class="header-dropdown-actions">
        <button type="button" class="header-dropdown-item" id="btn-header-profile">
          <span>Mi Perfil y Organización</span>
        </button>

        <button type="button" class="btn-theme-toggle header-dropdown-item" id="btn-header-theme">
          <span>${isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}</span>
        </button>

        <button type="button" class="header-dropdown-item" id="btn-header-backup">
          <span>Exportar Respaldo JSON</span>
        </button>

        <button type="button" class="header-dropdown-item danger" id="btn-header-logout">
          <span>Cerrar sesión</span>
        </button>
      </div>
    `;
  }

  refreshSessionUI() {
    const triggerText = document.querySelector('#header-trigger-label');
    if (triggerText) {
      triggerText.textContent = this._getTriggerSummary();
    }
    this._refreshNotificationsUI();
  }

  render() {
    const triggerLabel = this._getTriggerSummary();
    const notifCount = this._getNotificationsCount();

    return `
      <header class="app-header">
        <div class="header-left">
          <button class="menu-toggle-btn" id="btn-toggle-sidebar" aria-label="Abrir menú lateral de navegación">
            <span>Menú</span>
          </button>

          <div class="header-title-wrapper">
            <h2 id="header-page-title">${escapeHtml(this.currentTitle)}</h2>
            <div class="header-breadcrumb" id="header-breadcrumb">${escapeHtml(this.currentBreadcrumb)}</div>
          </div>
        </div>

        <div class="header-right">
          <!-- Pequeño menú desplegable en la parte superior derecha de la barra superior -->
          <div class="header-quick-menu-wrapper" id="header-quick-menu-wrapper">
            <button type="button"
                    class="header-quick-menu-trigger"
                    id="btn-header-quick-menu"
                    aria-expanded="false"
                    aria-haspopup="true"
                    title="Abrir menú de cuenta, estado de conexión y notificaciones">
              <span class="status-dot ${this.isOnline ? 'online' : 'offline'}" id="header-trigger-status-dot"></span>
              <span id="header-trigger-label">${escapeHtml(triggerLabel)}</span>
              <span class="header-notif-pill" id="header-notif-badge" style="display: ${notifCount > 0 ? 'inline-flex' : 'none'};">
                ${notifCount}
              </span>
              <span class="header-trigger-caret">▾</span>
            </button>

            <div class="header-quick-dropdown" id="header-quick-dropdown" role="menu" aria-hidden="true">
              ${this._renderQuickDropdownContent()}
            </div>
          </div>
        </div>
      </header>
    `;
  }

  _closeQuickMenu() {
    this.isQuickMenuOpen = false;
    const dropdown = document.querySelector('#header-quick-dropdown');
    const trigger = document.querySelector('#btn-header-quick-menu');
    if (dropdown) {
      dropdown.classList.remove('open');
      dropdown.setAttribute('aria-hidden', 'true');
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('active');
    }
  }

  _toggleQuickMenu() {
    this.isQuickMenuOpen = !this.isQuickMenuOpen;
    const dropdown = document.querySelector('#header-quick-dropdown');
    const trigger = document.querySelector('#btn-header-quick-menu');
    if (dropdown) {
      dropdown.classList.toggle('open', this.isQuickMenuOpen);
      dropdown.setAttribute('aria-hidden', this.isQuickMenuOpen ? 'false' : 'true');
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', this.isQuickMenuOpen ? 'true' : 'false');
      trigger.classList.toggle('active', this.isQuickMenuOpen);
    }
  }

  _bindDropdownActions(scope) {
    const profileBtn = scope.querySelector('#btn-header-profile');
    const logoutBtn = scope.querySelector('#btn-header-logout');
    const loginBtn = scope.querySelector('#btn-header-go-login');
    const backupBtn = scope.querySelector('#btn-header-backup');
    const alertBackupBtn = scope.querySelector('#btn-alert-backup-now');
    const goAlertsBtn = scope.querySelector('#btn-dropdown-go-alerts');
    const themeBtn = scope.querySelector('#btn-header-theme');

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        window.location.hash = '#settings?tab=profile';
      });
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        ThemeService.toggleTheme();
        this._closeQuickMenu();
      });
    }

    if (backupBtn && typeof this.onQuickBackup === 'function') {
      backupBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        this.onQuickBackup();
      });
    }

    if (alertBackupBtn && typeof this.onQuickBackup === 'function') {
      alertBackupBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        this.onQuickBackup();
      });
    }

    if (goAlertsBtn) {
      goAlertsBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        window.location.hash = '#water-alerts';
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        this._closeQuickMenu();
        await sessionService.logout();
        notification.info('Sesión cerrada', 'Ha cerrado su sesión en HIDROTERRA.');
        window.location.hash = '#login';
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        window.location.hash = '#login';
      });
    }
  }

  bindEvents(container) {
    const toggleBtn = container.querySelector('#btn-toggle-sidebar');
    const quickMenuBtn = container.querySelector('#btn-header-quick-menu');
    const quickMenuWrapper = container.querySelector('#header-quick-menu-wrapper');
    const dropdown = container.querySelector('#header-quick-dropdown');

    if (toggleBtn && typeof this.onToggleMenu === 'function') {
      toggleBtn.addEventListener('click', () => {
        this._closeQuickMenu();
        this.onToggleMenu();
      });
    }

    if (quickMenuBtn) {
      quickMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleQuickMenu();
      });
    }

    if (dropdown) {
      this._bindDropdownActions(dropdown);
    }

    document.addEventListener('click', (e) => {
      if (this.isQuickMenuOpen && quickMenuWrapper && !quickMenuWrapper.contains(e.target)) {
        this._closeQuickMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isQuickMenuOpen) {
        this._closeQuickMenu();
      }
    });

    events.on('route:changed', () => {
      this._closeQuickMenu();
    });

    events.on('theme:changed', ({ isDark }) => {
      const btn = document.querySelector('#btn-header-theme');
      if (btn) {
        btn.innerHTML = `<span>${isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}</span>`;
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
