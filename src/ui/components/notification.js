/**
 * Componente: Sistema de Notificaciones Toast (Notification)
 */

class NotificationManager {
  constructor() {
    this.container = null;
  }

  _getContainer() {
    if (!this.container) {
      this.container = document.querySelector('.toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(title, message, type = 'info', durationMs = 4500) {
    const container = this._getContainer();

    const toast = document.createElement('div');
    toast.className = `toast show toast-${type}`;

    let icon = '<i class="fa-solid fa-circle-info" style="color: var(--color-info);"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i>';
    else if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i>';
    else if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i>';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Cerrar">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    if (durationMs > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, durationMs);
    }

    return toast;
  }

  success(title, message) {
    return this.show(title, message, 'success');
  }

  error(title, message) {
    return this.show(title, message, 'error', 6000);
  }

  warning(title, message) {
    return this.show(title, message, 'warning', 5500);
  }

  info(title, message) {
    return this.show(title, message, 'info');
  }
}

export const notification = new NotificationManager();
