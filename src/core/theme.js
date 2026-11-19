/**
 * Servicio de Gestión de Tema Visual (Modo Claro / Modo Oscuro)
 * Permite conmutar la apariencia y persistir la preferencia en el navegador.
 */

import { events } from './events.js';

const THEME_STORAGE_KEY = 'hidroterra_theme';
const OVERFLOW_TOOLTIP_STORAGE_KEY = 'hidroterra_overflow_tooltip';
const BADGE_MARQUEE_STORAGE_KEY = 'hidroterra_badge_marquee';
const USER_PREFS_STORAGE_KEY = 'hidroterra_user_preferences';

export const DEFAULT_USER_PREFERENCES = {
  fontSizeScale: 'normal',       // 'normal' | 'large' | 'xlarge'
  tableDensity: 'comfortable',   // 'compact' | 'comfortable' | 'spacious'
  defaultPageSize: 15,           // 10 | 15 | 25 | 50
  waterLowAlertPct: 40,          // % umbral alerta preventiva/baja
  waterCriticalAlertPct: 20,     // % umbral alerta crítica
  droughtDryDaysAlert: 4,        // días secos consecutivos para alerta climática
  backupWarningDays: 7,          // 3 | 7 | 15 | 30 días
  autoBackupOnLogout: false,     // true | false
  volumeUnit: 'L',               // 'L' | 'm3'
  coordinateFormat: 'decimal',   // 'decimal' | 'dms'
  autoFirestoreSync: true,       // true (tiempo real) | false (ahorro de datos / manual)
  sessionTimeoutMinutes: 0       // 0 (Nunca) | 15 | 30 | 60
};

export class ThemeService {
  /**
   * Obtiene el tema activo ('light' o 'dark')
   */
  static getTheme() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Ignorar restricciones en entornos sin acceso a localStorage
    }

    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  /**
   * Establece un tema específico ('light' o 'dark')
   */
  static setTheme(theme) {
    const validTheme = theme === 'dark' ? 'dark' : 'light';

    try {
      localStorage.setItem(THEME_STORAGE_KEY, validTheme);
    } catch {
      // Ignorar fallback
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', validTheme);
      document.documentElement.setAttribute('data-bs-theme', validTheme);
    }

    this._updateChartDefaults(validTheme === 'dark');
    events.emit('theme:changed', { theme: validTheme, isDark: validTheme === 'dark' });

    return validTheme;
  }

  /**
   * Alterna entre modo claro y modo oscuro
   */
  static toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    return this.setTheme(next);
  }

  /**
   * Indica si el modo oscuro está activo
   */
  static isDark() {
    return this.getTheme() === 'dark';
  }

  /**
   * Indica si la visualización emergente de textos completos (botones/textos con ...) está habilitada.
   * Por defecto está desactivada (false) para no resultar intrusiva a menos que el usuario la active en Configuración.
   */
  static isOverflowTooltipEnabled() {
    try {
      return localStorage.getItem(OVERFLOW_TOOLTIP_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Activa o desactiva la opción de mostrar el texto completo de botones y textos recortados
   */
  static setOverflowTooltipEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    try {
      localStorage.setItem(OVERFLOW_TOOLTIP_STORAGE_KEY, isEnabled ? 'true' : 'false');
    } catch {
      // Ignorar fallback
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-overflow-tooltip', isEnabled ? 'true' : 'false');
    }

    events.emit('preferences:overflow-tooltip', { enabled: isEnabled });
    return isEnabled;
  }

  /**
   * Indica si el desplazamiento horizontal automático (marquee) en etiquetas (.badge) con texto largo está activo.
   * Por defecto está activado (true) y puede activarse o desactivarse desde Configuración.
   */
  static isBadgeMarqueeEnabled() {
    try {
      const val = localStorage.getItem(BADGE_MARQUEE_STORAGE_KEY);
      if (val === 'false') return false;
      if (val === 'true') return true;
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Activa o desactiva el desplazamiento horizontal de texto en etiquetas (.badge) recortadas
   */
  static setBadgeMarqueeEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    try {
      localStorage.setItem(BADGE_MARQUEE_STORAGE_KEY, isEnabled ? 'true' : 'false');
    } catch {
      // Ignorar fallback
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-badge-marquee', isEnabled ? 'true' : 'false');
    }

    events.emit('preferences:badge-marquee', { enabled: isEnabled });
    return isEnabled;
  }

  /**
   * Obtiene todas las preferencias adicionales de visualización, alertas, respaldos, unidades y sincronización
   */
  static getPreferences() {
    try {
      const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_USER_PREFERENCES, ...(parsed || {}) };
      }
    } catch {
      // Ignorar
    }
    return { ...DEFAULT_USER_PREFERENCES };
  }

  /**
   * Actualiza y persiste una o varias preferencias del usuario y aplica los atributos visuales al DOM
   */
  static updatePreferences(partial = {}) {
    const current = this.getPreferences();
    const updated = { ...current, ...(partial || {}) };

    // Validaciones de coherencia
    if (!['normal', 'large', 'xlarge'].includes(updated.fontSizeScale)) {
      updated.fontSizeScale = 'normal';
    }
    if (!['compact', 'comfortable', 'spacious'].includes(updated.tableDensity)) {
      updated.tableDensity = 'comfortable';
    }
    updated.defaultPageSize = Number(updated.defaultPageSize) || 15;
    updated.waterLowAlertPct = Math.min(70, Math.max(15, Number(updated.waterLowAlertPct) || 40));
    updated.waterCriticalAlertPct = Math.min(updated.waterLowAlertPct - 5, Math.max(5, Number(updated.waterCriticalAlertPct) || 20));
    updated.droughtDryDaysAlert = Math.min(10, Math.max(2, Number(updated.droughtDryDaysAlert) || 4));
    updated.backupWarningDays = Number(updated.backupWarningDays) || 7;
    updated.autoBackupOnLogout = Boolean(updated.autoBackupOnLogout);
    updated.volumeUnit = updated.volumeUnit === 'm3' ? 'm3' : 'L';
    updated.coordinateFormat = updated.coordinateFormat === 'dms' ? 'dms' : 'decimal';
    updated.autoFirestoreSync = updated.autoFirestoreSync !== false;
    updated.sessionTimeoutMinutes = Number(updated.sessionTimeoutMinutes) || 0;

    try {
      localStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar fallback
    }

    this._applyPreferencesToDocument(updated);
    events.emit('preferences:updated', updated);
    return updated;
  }

  static _applyPreferencesToDocument(prefs) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-font-scale', prefs.fontSizeScale || 'normal');
    document.documentElement.setAttribute('data-table-density', prefs.tableDensity || 'comfortable');
  }

  static getDefaultPageSize() {
    return this.getPreferences().defaultPageSize || 15;
  }

  static isAutoFirestoreSyncEnabled() {
    return this.getPreferences().autoFirestoreSync !== false;
  }

  static getCoordinateFormat() {
    return this.getPreferences().coordinateFormat || 'decimal';
  }

  static getVolumeUnit() {
    return this.getPreferences().volumeUnit || 'L';
  }

  static formatVolume(litersValue) {
    if (litersValue === null || litersValue === undefined || litersValue === '' || !Number.isFinite(Number(litersValue))) {
      return '—';
    }
    const numL = Number(litersValue);
    if (this.getVolumeUnit() === 'm3') {
      const m3 = numL / 1000;
      return `${m3.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m³`;
    }
    return `${numL.toLocaleString('es-CO')} L`;
  }

  /**
   * Inicializa el tema al arranque de la aplicación
   */
  static init() {
    const currentTheme = this.getTheme();
    this.setTheme(currentTheme);
    this.setOverflowTooltipEnabled(this.isOverflowTooltipEnabled());
    this.setBadgeMarqueeEnabled(this.isBadgeMarqueeEnabled());
    this._applyPreferencesToDocument(this.getPreferences());

    // Escuchar cambios de preferencia del sistema si el usuario no ha forzado una elección
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            this.setTheme(e.matches ? 'dark' : 'light');
          }
        });
      } catch {
        // Ignorar si addEventListener no está disponible
      }
    }
  }

  /**
   * Adapta la paleta de Chart.js al tema activo
   */
  static _updateChartDefaults(isDark) {
    if (typeof window !== 'undefined' && window.Chart) {
      window.Chart.defaults.color = isDark ? '#cbd5e1' : '#475569';
      window.Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    }
  }
}
