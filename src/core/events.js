/**
 * Sistema centralizado de eventos (Event Bus) para PAnA V2 AGUA
 * Permite comunicación desacoplada entre capas (datos, interfaz, sincronización).
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Suscribe una función manejadora a un evento.
   * @param {string} event - Nombre del evento.
   * @param {Function} handler - Función que se ejecuta cuando se dispara el evento.
   * @returns {Function} Función para cancelar la suscripción.
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Desuscribe una función de un evento.
   */
  off(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).delete(handler);
    if (this.listeners.get(event).size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emite un evento a todos los suscriptores.
   * @param {string} event - Nombre del evento.
   * @param {*} data - Carga útil asociada al evento.
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error en manejador del evento "${event}":`, err);
      }
    });
  }

  /**
   * Escucha un evento solo una vez.
   */
  once(event, handler) {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      handler(data);
    });
    return unsubscribe;
  }
}

export const events = new EventBus();
