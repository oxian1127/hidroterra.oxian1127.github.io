/**
 * Componente: Tabla de Datos Paginada y Reutilizable (DataTable)
 */

import { renderEmptyState } from './empty-state.js';

export class DataTable {
  /**
   * @param {Object} options
   * @param {Array} options.columns - [{ key, label, sortable, render(item) }]
   * @param {Array} options.items - Registros a mostrar
   * @param {number} options.pageSize - Elementos por página
   * @param {string} options.emptyTitle
   * @param {string} options.emptyDescription
   */
  constructor(options = {}) {
    this.columns = options.columns || [];
    this.items = options.items || [];
    this.pageSize = options.pageSize || 15;
    this.currentPage = 1;
    this.emptyTitle = options.emptyTitle || 'No se encontraron registros';
    this.emptyDescription = options.emptyDescription || 'No hay elementos para mostrar con los filtros aplicados.';
  }

  setItems(items) {
    this.items = items;
    this.currentPage = 1;
  }

  render() {
    if (!this.items || this.items.length === 0) {
      return renderEmptyState({
        icon: '<i class="fa-solid fa-chart-simple"></i>',
        title: this.emptyTitle,
        description: this.emptyDescription
      });
    }

    const totalPages = Math.ceil(this.items.length / this.pageSize);
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.items.slice(startIndex, startIndex + this.pageSize);

    let html = `
      <div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead>
            <tr>
              ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${pageItems.map(item => `
              <tr>
                ${this.columns.map(col => {
                  const content = typeof col.render === 'function' ? col.render(item) : (item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '—');
                  return `<td data-label="${col.label}">${content}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `
          <div class="table-pagination">
            <span>Mostrando ${startIndex + 1} a ${Math.min(startIndex + this.pageSize, this.items.length)} de ${this.items.length} registros</span>
            <div class="pagination-controls">
              <button class="btn btn-outline btn-sm dt-prev-btn" ${this.currentPage === 1 ? 'disabled' : ''}>Anterior</button>
              <span>Página ${this.currentPage} de ${totalPages}</span>
              <button class="btn btn-outline btn-sm dt-next-btn" ${this.currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
          </div>
        ` : `
          <div class="table-pagination">
            <span>Total: ${this.items.length} registros</span>
          </div>
        `}
      </div>
    `;

    return html;
  }

  bindEvents(containerElement, onPageChange = null) {
    if (!containerElement) return;

    const prevBtn = containerElement.querySelector('.dt-prev-btn');
    const nextBtn = containerElement.querySelector('.dt-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          if (onPageChange) onPageChange(this.currentPage);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.items.length / this.pageSize);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          if (onPageChange) onPageChange(this.currentPage);
        }
      });
    }
  }
}
