/**
 * Componente: Diálogo Modal Accesible (Modal)
 */

class ModalManager {
  constructor() {
    this.overlay = null;
    this.activeCloseCallback = null;
  }

  _getOverlay() {
    if (!this.overlay) {
      this.overlay = document.querySelector('.modal-overlay');
      if (!this.overlay) {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        document.body.appendChild(this.overlay);

        // Cerrar al presionar Escape o clic fuera
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
            this.close();
          }
        });

        this.overlay.addEventListener('click', (e) => {
          if (e.target === this.overlay) {
            this.close();
          }
        });
      }
    }
    return this.overlay;
  }

  open({ title = 'Diálogo', contentHtml = '', content = '', footerHtml = '', footer = '', size = '', onMount = null, onOpen = null, onClose = null }) {
    const overlay = this._getOverlay();
    this.activeCloseCallback = onClose;
    const bodyContent = contentHtml || content || '';
    const footContent = footerHtml || footer || '';

    overlay.innerHTML = `
      <div class="modal-dialog ${size === 'lg' ? 'modal-lg' : ''}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close-btn" aria-label="Cerrar modal">&times;</button>
        </div>
        <div class="modal-body">
          ${bodyContent}
        </div>
        ${footContent ? `
          <div class="modal-footer">
            ${footContent}
          </div>
        ` : ''}
      </div>
    `;

    const closeBtn = overlay.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => this.close());

    overlay.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const dialogEl = overlay.querySelector('.modal-dialog');
    if (typeof onMount === 'function') {
      onMount(dialogEl);
    }
    if (typeof onOpen === 'function') {
      onOpen(dialogEl);
    }
  }

  close() {
    if (this.overlay && this.overlay.classList.contains('active')) {
      this.overlay.classList.remove('active');
      document.body.style.overflow = '';
      if (typeof this.activeCloseCallback === 'function') {
        this.activeCloseCallback();
        this.activeCloseCallback = null;
      }
    }
  }

  /**
   * Ventana de confirmación modal basada en Promesa
   */
  async confirm({ title = '¿Confirmar operación?', message = '¿Está seguro de continuar?', confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false }) {
    return new Promise((resolve) => {
      let resolved = false;
      const doResolve = (value) => {
        if (!resolved) {
          resolved = true;
          resolve(value);
        }
      };

      this.open({
        title,
        contentHtml: `<p style="font-size: var(--font-size-base); line-height: 1.5;">${message}</p>`,
        footerHtml: `
          <button class="btn btn-outline" id="modal-cancel-btn">${cancelText}</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
        `,
        onMount: (dialog) => {
          const confirmBtn = dialog.querySelector('#modal-confirm-btn');
          const cancelBtn = dialog.querySelector('#modal-cancel-btn');

          confirmBtn.addEventListener('click', () => {
            doResolve(true);
            this.close();
          });

          cancelBtn.addEventListener('click', () => {
            doResolve(false);
            this.close();
          });
        },
        onClose: () => {
          doResolve(false);
        }
      });
    });
  }
}

export const modal = new ModalManager();
