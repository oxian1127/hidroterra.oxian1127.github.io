/**
 * Servicio de Gestión de Tema Visual (Modo Claro / Modo Oscuro)
 * Permite conmutar la apariencia y persistir la preferencia en el navegador.
 */

import { events } from './events.js';

const THEME_STORAGE_KEY = 'hidroterra_theme';

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
   * Inicializa el tema al arranque de la aplicación
   */
  static init() {
    const currentTheme = this.getTheme();
    this.setTheme(currentTheme);

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
