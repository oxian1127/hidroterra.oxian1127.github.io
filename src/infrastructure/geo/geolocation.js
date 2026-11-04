/**
 * Servicio de Geolocalización Nativa del Navegador
 * Captura segura de coordenadas GPS con manejo de permisos y errores
 */

import { logger } from '../../core/logger.js';

export class GeolocationService {
  /**
   * Verifica si la API de geolocalización está disponible en el navegador
   */
  static isSupported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  /**
   * Obtiene la posición actual del dispositivo con alta precisión cuando sea posible
   * @param {Object} options
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number, altitude: number|null}>}
   */
  static async getCurrentPosition(options = {}) {
    if (!this.isSupported()) {
      throw new Error('La geolocalización no está soportada por este navegador o dispositivo.');
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
      ...options
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy),
            altitude: position.coords.altitude !== null ? Math.round(position.coords.altitude) : null
          };
          logger.info('Coordenadas GPS capturadas con éxito', coords);
          resolve(coords);
        },
        (error) => {
          let message = 'Error desconocido al obtener la ubicación GPS.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permiso denegado por el usuario para acceder a la ubicación. Puede ingresar las coordenadas manualmente.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Señal de ubicación no disponible en este momento. Verifique el GPS de su dispositivo o ingrese los valores manualmente.';
              break;
            case error.TIMEOUT:
              message = 'Tiempo de espera agotado al consultar el GPS. Intente nuevamente en un espacio abierto o ingrese las coordenadas manualmente.';
              break;
          }
          logger.warn(`Fallo de geolocalización: ${message}`, error);
          reject(new Error(message));
        },
        defaultOptions
      );
    });
  }
}
