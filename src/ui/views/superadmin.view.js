/**
 * Vista: Panel Administrativo Central del Superadministrador — HIDROTERRA (Sección 10)
 *
 * Permite al SUPERADMINISTRADOR:
 * - Visualizar indicadores globales (organizaciones registradas/activas, usuarios, eventos de lluvia,
 *   pluviómetros, fuentes hídricas y mediciones).
 * - Analizar gráficas comparativas por organización y módulo.
 * - Administrar todas las organizaciones (Crear, Ver, Editar, Consultar datos, Administrar usuarios,
 *   Suspender y Reactivar).
 * - Consultar, filtrar, modificar y eliminar registros de cualquier organización con auditoría completa.
 */

import { sessionService } from '../../core/session.service.js';
import { waterSourceRepository } from '../../infrastructure/database/repositories/water-source.repository.js';
import { waterMeasurementRepository } from '../../infrastructure/database/repositories/water-measurement.repository.js';
import { pluviometerRepository } from '../../infrastructure/database/repositories/pluviometer.repository.js';
import { rainfallRepository } from '../../infrastructure/database/repositories/rainfall.repository.js';
import { siteRepository } from '../../infrastructure/database/repositories/site.repository.js';
import { parcelRepository } from '../../infrastructure/database/repositories/parcel.repository.js';
import { observationRepository } from '../../infrastructure/database/repositories/observation.repository.js';
import { escapeHtml } from '../../core/validators.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';

export class SuperAdminView {
  constructor(router) {
    this.router = router;
    this.organizations = [];
    this.users = [];
    this.rawRecords = {};
    this.chartInstance = null;
    this.filters = {
      organizationId: 'all',
      department: 'all',
      municipality: 'all',
      recordType: 'all'
    };
  }

  async render(container) {
    if (!sessionService.isSuperAdmin()) {
      container.innerHTML = `
        <div class="card" style="padding: var(--spacing-6); text-align: center;">
          <h3>Acceso Restringido</h3>
          <p class="text-muted">Esta sección está reservada exclusivamente para el rol de Superadministrador.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <p class="text-muted">Consolidando indicadores multiinstitucionales desde Firestore e IndexedDB...</p>
      </div>
    `;

    await this._loadData();
    this._renderDashboard(container);
  }

  async _loadData() {
    const [
      organizations,
      users,
      water_sources,
      water_measurements,
      pluviometers,
      rainfall_records,
      sites,
      parcels,
      observations
    ] = await Promise.all([
      sessionService.getOrganizations(true),
      sessionService.getUsers('all'),
      waterSourceRepository.getAllRaw(),
      waterMeasurementRepository.getAllRaw(),
      pluviometerRepository.getAllRaw(),
      rainfallRepository.getAllRaw(),
      siteRepository.getAllRaw(),
      parcelRepository.getAllRaw(),
      observationRepository.getAllRaw()
    ]);

    this.organizations = organizations;
    this.users = users;
    this.rawRecords = {
      water_sources,
      water_measurements,
      pluviometers,
      rainfall_records,
      sites,
      parcels,
      observations
    };
  }

  _getOrgStatsMap() {
    const stats = new Map();
    this.organizations.forEach(org => {
      stats.set(org.id, {
        usersCount: 0,
        rainCount: 0,
        pluvCount: 0,
        sourcesCount: 0,
        measurementsCount: 0,
        otherCount: 0,
        totalRecords: 0
      });
    });

    this.users.forEach(u => {
      if (stats.has(u.organizationId)) {
        stats.get(u.organizationId).usersCount++;
      }
    });

    const addCount = (list, field) => {
      (list || []).forEach(rec => {
        const orgId = rec.organizationId;
        if (orgId && stats.has(orgId)) {
          const st = stats.get(orgId);
          st[field] = (st[field] || 0) + 1;
          st.totalRecords++;
        }
      });
    };

    addCount(this.rawRecords.rainfall_records, 'rainCount');
    addCount(this.rawRecords.pluviometers, 'pluvCount');
    addCount(this.rawRecords.water_sources, 'sourcesCount');
    addCount(this.rawRecords.water_measurements, 'measurementsCount');
    addCount(this.rawRecords.sites, 'otherCount');
    addCount(this.rawRecords.parcels, 'otherCount');
    addCount(this.rawRecords.observations, 'otherCount');

    return stats;
  }

  _renderDashboard(container) {
    const activeOrgsCount = this.organizations.filter(o => o.status !== 'suspendida').length;
    const orgStatsMap = this._getOrgStatsMap();
    const activeOrgFilter = sessionService.getSuperadminOrganizationFilter();

    const departments = [...new Set(this.organizations.map(o => o.department).filter(Boolean))].sort();
    const municipalities = [...new Set(this.organizations.map(o => o.municipality).filter(Boolean))].sort();

    const filteredOrgs = this.organizations.filter(org => {
      if (this.filters.organizationId !== 'all' && org.id !== this.filters.organizationId) return false;
      if (this.filters.department !== 'all' && org.department !== this.filters.department) return false;
      if (this.filters.municipality !== 'all' && org.municipality !== this.filters.municipality) return false;
      return true;
    });

    const unifiedRecords = this._buildFilteredGlobalRecords();

    container.innerHTML = `
      <div class="superadmin-view">
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Panel Administrativo Central — Superadministrador</h2>
            <p class="text-muted">
              Supervisión global de organizaciones participantes, usuarios, registros territoriales y sincronización con Firebase Firestore.
            </p>
          </div>
          <div class="d-flex gap-2" style="flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-sa-new-org">
              <span>Nueva Organización</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-sa-go-sync">
              <span>Sincronizar Datos con Firebase</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-sa-go-audit">
              <span>Ver Auditoría Global</span>
            </button>
          </div>
        </div>

        <!-- Selector de contexto activo de visualización global -->
        <div class="card mb-4" style="border-left: 4px solid var(--color-blue-700);">
          <div class="card-body" style="padding: var(--spacing-3) var(--spacing-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <strong>Filtro de Contexto Global en los Módulos de HIDROTERRA:</strong>
              <span style="font-size: var(--font-size-xs); color: var(--color-neutral-600); display: block;">
                Como Superadministrador puede inspeccionar todos los módulos combinados o enfocar toda la plataforma en una organización específica.
              </span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <select id="sa-context-org-switcher" class="form-control" style="min-width: 260px;">
                <option value="all" ${activeOrgFilter === 'all' ? 'selected' : ''}>Vista Global (Todas las Organizaciones)</option>
                ${this.organizations.map(o => `<option value="${escapeHtml(o.id)}" ${activeOrgFilter === o.id ? 'selected' : ''}>Solo: ${escapeHtml(o.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- 7 Indicadores Globales Solicitados (Sección 10) -->
        <div class="dashboard-metrics-grid mb-4">
          <div class="metric-card">
            <div>
              <div class="metric-label">Organizaciones Registradas</div>
              <div class="metric-value">${this.organizations.length}</div>
              <div class="metric-subtext">En Montes de María</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Organizaciones Activas</div>
              <div class="metric-value">${activeOrgsCount}</div>
              <div class="metric-subtext">${this.organizations.length - activeOrgsCount} suspendidas</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Usuarios Registrados</div>
              <div class="metric-value">${this.users.length}</div>
              <div class="metric-subtext">Con roles asignados</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Total Eventos de Lluvia</div>
              <div class="metric-value">${this.rawRecords.rainfall_records.length}</div>
              <div class="metric-subtext">Colección rain_events</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Total Pluviómetros</div>
              <div class="metric-value">${this.rawRecords.pluviometers.length}</div>
              <div class="metric-subtext">Colección pluviometers</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Total Fuentes Hídricas</div>
              <div class="metric-value">${this.rawRecords.water_sources.length}</div>
              <div class="metric-subtext">Colección water_sources</div>
            </div>
          </div>
          <div class="metric-card">
            <div>
              <div class="metric-label">Total Mediciones de Agua</div>
              <div class="metric-value">${this.rawRecords.water_measurements.length}</div>
              <div class="metric-subtext">Colección water_measurements</div>
            </div>
          </div>
        </div>

        <!-- Gráfico comparativo por organización -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Estadísticas Generales por Organización</h3>
              <p class="card-subtitle">Distribución de fuentes hídricas, pluviómetros, eventos de lluvia y mediciones por organización</p>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-wrapper" style="height: 270px;">
              <canvas id="sa-orgs-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Filtros de Organizaciones y Registros -->
        <div class="filter-bar mb-4" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--spacing-3); padding: var(--spacing-3);">
          <div>
            <label class="form-label">Filtrar por Organización</label>
            <select id="sa-filter-org" class="form-control">
              <option value="all">Todas las organizaciones</option>
              ${this.organizations.map(o => `<option value="${escapeHtml(o.id)}" ${this.filters.organizationId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Departamento</label>
            <select id="sa-filter-dept" class="form-control">
              <option value="all">Todos los departamentos</option>
              ${departments.map(d => `<option value="${escapeHtml(d)}" ${this.filters.department === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Municipio</label>
            <select id="sa-filter-muni" class="form-control">
              <option value="all">Todos los municipios</option>
              ${municipalities.map(m => `<option value="${escapeHtml(m)}" ${this.filters.municipality === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Tipo de Registro</label>
            <select id="sa-filter-rectype" class="form-control">
              <option value="all" ${this.filters.recordType === 'all' ? 'selected' : ''}>Todos los tipos</option>
              <option value="rainfall_records" ${this.filters.recordType === 'rainfall_records' ? 'selected' : ''}>Eventos de lluvia</option>
              <option value="pluviometers" ${this.filters.recordType === 'pluviometers' ? 'selected' : ''}>Pluviómetros</option>
              <option value="water_sources" ${this.filters.recordType === 'water_sources' ? 'selected' : ''}>Fuentes hídricas</option>
              <option value="water_measurements" ${this.filters.recordType === 'water_measurements' ? 'selected' : ''}>Mediciones de agua</option>
            </select>
          </div>
        </div>

        <!-- Tabla de Organizaciones (Sección 10) -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Directorio Administrativo de Organizaciones (${filteredOrgs.length})</h3>
              <p class="card-subtitle">Gestione el estado institucional, responsables, usuarios y datos de cada organización</p>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Municipio</th>
                  <th>Departamento</th>
                  <th>Responsable</th>
                  <th>Correo</th>
                  <th>Usuarios</th>
                  <th>Registros</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredOrgs.map(org => {
                  const st = orgStatsMap.get(org.id) || { usersCount: 0, totalRecords: 0 };
                  const isSuspended = org.status === 'suspendida';
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(org.name)}</strong>
                        <div style="font-size: 0.72rem; color: var(--color-neutral-500);">${escapeHtml(org.organizationType || '')}</div>
                      </td>
                      <td>${escapeHtml(org.municipality || '—')}</td>
                      <td>${escapeHtml(org.department || '—')}</td>
                      <td>${escapeHtml(org.representativeName || '—')}</td>
                      <td>${org.institutionalEmail ? escapeHtml(org.institutionalEmail) : '<em class="text-muted">Pendiente</em>'}</td>
                      <td><span class="badge badge-info">${st.usersCount}</span></td>
                      <td><span class="badge badge-success">${st.totalRecords}</span></td>
                      <td>
                        <span class="badge ${isSuspended ? 'badge-danger' : 'badge-success'}">
                          ${isSuspended ? 'Suspendida' : 'Activa'}
                        </span>
                      </td>
                      <td>
                        <div class="d-flex gap-1" style="flex-wrap: wrap;">
                          <button type="button" class="btn btn-outline btn-sm btn-sa-view-org" data-org-id="${escapeHtml(org.id)}">Ver</button>
                          <button type="button" class="btn btn-outline btn-sm btn-sa-edit-org" data-org-id="${escapeHtml(org.id)}">Editar</button>
                          <button type="button" class="btn btn-primary btn-sm btn-sa-inspect-data" data-org-id="${escapeHtml(org.id)}">Consultar datos</button>
                          <button type="button" class="btn btn-outline btn-sm btn-sa-manage-users" data-org-id="${escapeHtml(org.id)}">Usuarios</button>
                          <button type="button" class="btn ${isSuspended ? 'btn-primary' : 'btn-danger'} btn-sm btn-sa-toggle-status" data-org-id="${escapeHtml(org.id)}">
                            ${isSuspended ? 'Reactivar' : 'Suspender'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Explorador y Editor Global de Registros Multiinstitucionales -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Registros Territoriales Globales (${unifiedRecords.length})</h3>
              <p class="card-subtitle">Consulta, reasignación de organización, edición y eliminación transversal con registro automático en auditoría</p>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Identificador / Nombre</th>
                  <th>Organización Asociada</th>
                  <th>Municipio</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${unifiedRecords.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 24px;" class="text-muted">No hay registros para los filtros seleccionados.</td>
                  </tr>
                ` : unifiedRecords.slice(0, 80).map(rec => `
                  <tr>
                    <td><span class="badge badge-info">${escapeHtml(rec.moduleLabel)}</span></td>
                    <td><strong>${escapeHtml(rec.title)}</strong></td>
                    <td>${escapeHtml(rec.organizationName)}</td>
                    <td>${escapeHtml(rec.municipality)}</td>
                    <td>${escapeHtml(rec.responsible || '—')}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <button type="button" class="btn btn-outline btn-sm btn-sa-reassign-rec" data-store="${escapeHtml(rec.storeName)}" data-id="${escapeHtml(rec.id)}">
                          Editar / Reasignar
                        </button>
                        <button type="button" class="btn btn-danger btn-sm btn-sa-delete-rec" data-store="${escapeHtml(rec.storeName)}" data-id="${escapeHtml(rec.id)}">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this._renderChart(container, orgStatsMap);
    this._bindEvents(container);
  }

  _buildFilteredGlobalRecords() {
    const orgMap = new Map(this.organizations.map(o => [o.id, o]));
    const list = [];

    const pushFromStore = (storeName, moduleLabel, records) => {
      if (this.filters.recordType !== 'all' && this.filters.recordType !== storeName) return;
      (records || []).forEach(r => {
        const org = r.organizationId ? orgMap.get(r.organizationId) : null;
        if (this.filters.organizationId !== 'all' && r.organizationId !== this.filters.organizationId) return;
        if (this.filters.department !== 'all' && org?.department !== this.filters.department) return;
        if (this.filters.municipality !== 'all' && org?.municipality !== this.filters.municipality) return;

        list.push({
          id: r.id,
          storeName,
          moduleLabel,
          title: r.name || r.code || r.sourceCode || (r.precipitationMm !== undefined ? `Lluvia: ${r.precipitationMm} mm` : r.id),
          organizationId: r.organizationId || '',
          organizationName: org ? org.name : 'Pendiente de asignación',
          municipality: org?.municipality || r.municipality || '—',
          responsible: r.responsible || '—',
          raw: r
        });
      });
    };

    pushFromStore('water_sources', 'Fuente Hídrica', this.rawRecords.water_sources);
    pushFromStore('water_measurements', 'Medición de Agua', this.rawRecords.water_measurements);
    pushFromStore('pluviometers', 'Pluviómetro', this.rawRecords.pluviometers);
    pushFromStore('rainfall_records', 'Evento de Lluvia', this.rawRecords.rainfall_records);

    return list;
  }

  _renderChart(container, orgStatsMap) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    const canvas = container.querySelector('#sa-orgs-chart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    const labels = this.organizations.map(o => o.shortName || o.name);
    const rainData = this.organizations.map(o => orgStatsMap.get(o.id)?.rainCount || 0);
    const sourcesData = this.organizations.map(o => orgStatsMap.get(o.id)?.sourcesCount || 0);
    const measData = this.organizations.map(o => orgStatsMap.get(o.id)?.measurementsCount || 0);
    const pluvData = this.organizations.map(o => orgStatsMap.get(o.id)?.pluvCount || 0);

    this.chartInstance = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Eventos de lluvia', data: rainData, backgroundColor: '#0077b6' },
          { label: 'Fuentes hídricas', data: sourcesData, backgroundColor: '#367d5d' },
          { label: 'Mediciones de agua', data: measData, backgroundColor: '#00b4d8' },
          { label: 'Pluviómetros', data: pluvData, backgroundColor: '#5db38c' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  _bindEvents(container) {
    container.querySelector('#sa-context-org-switcher')?.addEventListener('change', (e) => {
      sessionService.setSuperadminOrganizationFilter(e.target.value);
      notification.info(
        'Contexto actualizado',
        e.target.value === 'all'
          ? 'Mostrando datos globales de todas las organizaciones.'
          : 'Filtro de organización activado en todos los módulos.'
      );
    });

    container.querySelector('#btn-sa-new-org')?.addEventListener('click', () => {
      this._openOrganizationModal(null, container);
    });

    container.querySelector('#btn-sa-go-sync')?.addEventListener('click', () => {
      this.router.navigate('settings', { tab: 'sync' });
    });

    container.querySelector('#btn-sa-go-audit')?.addEventListener('click', () => {
      this.router.navigate('audit');
    });

    const onFilterChange = () => {
      this.filters.organizationId = container.querySelector('#sa-filter-org')?.value || 'all';
      this.filters.department = container.querySelector('#sa-filter-dept')?.value || 'all';
      this.filters.municipality = container.querySelector('#sa-filter-muni')?.value || 'all';
      this.filters.recordType = container.querySelector('#sa-filter-rectype')?.value || 'all';
      this._renderDashboard(container);
    };

    container.querySelector('#sa-filter-org')?.addEventListener('change', onFilterChange);
    container.querySelector('#sa-filter-dept')?.addEventListener('change', onFilterChange);
    container.querySelector('#sa-filter-muni')?.addEventListener('change', onFilterChange);
    container.querySelector('#sa-filter-rectype')?.addEventListener('change', onFilterChange);

    container.querySelectorAll('.btn-sa-view-org').forEach(btn => {
      btn.addEventListener('click', () => {
        const org = this.organizations.find(o => o.id === btn.dataset.orgId);
        if (org) this._openViewOrganizationModal(org);
      });
    });

    container.querySelectorAll('.btn-sa-edit-org').forEach(btn => {
      btn.addEventListener('click', () => {
        const org = this.organizations.find(o => o.id === btn.dataset.orgId);
        if (org) this._openOrganizationModal(org, container);
      });
    });

    container.querySelectorAll('.btn-sa-inspect-data').forEach(btn => {
      btn.addEventListener('click', () => {
        const orgId = btn.dataset.orgId;
        sessionService.setSuperadminOrganizationFilter(orgId);
        notification.success('Consultando datos de organización', 'Se ha filtrado el tablero para la organización seleccionada.');
        this.router.navigate('dashboard');
      });
    });

    container.querySelectorAll('.btn-sa-manage-users').forEach(btn => {
      btn.addEventListener('click', () => {
        this.router.navigate('settings', { tab: 'users', orgId: btn.dataset.orgId });
      });
    });

    container.querySelectorAll('.btn-sa-toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const org = this.organizations.find(o => o.id === btn.dataset.orgId);
        if (!org) return;
        const newStatus = org.status === 'suspendida' ? 'activa' : 'suspendida';
        await sessionService.saveOrganization({ ...org, status: newStatus }, false);
        notification.success('Estado actualizado', `La organización "${org.name}" ahora está ${newStatus}.`);
        await this._loadData();
        this._renderDashboard(container);
      });
    });

    container.querySelectorAll('.btn-sa-reassign-rec').forEach(btn => {
      btn.addEventListener('click', () => {
        const storeName = btn.dataset.store;
        const recId = btn.dataset.id;
        const rec = (this.rawRecords[storeName] || []).find(r => r.id === recId);
        if (rec) this._openEditGlobalRecordModal(storeName, rec, container);
      });
    });

    container.querySelectorAll('.btn-sa-delete-rec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeName = btn.dataset.store;
        const recId = btn.dataset.id;
        const confirmed = await modal.confirm({
          title: 'Confirmar eliminación administrativa',
          message: '¿Está seguro de eliminar este registro de Firestore e IndexedDB? Esta acción quedará registrada en la bitácora de auditoría.',
          confirmText: 'Sí, Eliminar',
          cancelText: 'Cancelar'
        });
        if (!confirmed) return;

        const repoMap = {
          water_sources: waterSourceRepository,
          water_measurements: waterMeasurementRepository,
          pluviometers: pluviometerRepository,
          rainfall_records: rainfallRepository,
          sites: siteRepository,
          parcels: parcelRepository,
          observations: observationRepository
        };
        const repo = repoMap[storeName];
        if (repo) {
          await repo.delete(recId);
          notification.success('Registro eliminado', 'El registro fue eliminado y auditado.');
          await this._loadData();
          this._renderDashboard(container);
        }
      });
    });
  }

  _openViewOrganizationModal(org) {
    modal.open({
      title: `Ficha Institucional — ${org.name}`,
      size: 'md',
      content: `
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: var(--font-size-sm);">
          <div><strong>ID Organización:</strong> <code>${escapeHtml(org.id)}</code></div>
          <div><strong>Nombre completo:</strong> ${escapeHtml(org.name)}</div>
          <div><strong>Nombre corto:</strong> ${escapeHtml(org.shortName || '—')}</div>
          <div><strong>NIT:</strong> ${escapeHtml(org.nit || 'No registrado')}</div>
          <div><strong>Tipo:</strong> ${escapeHtml(org.organizationType || '—')}</div>
          <div><strong>Ubicación:</strong> ${escapeHtml(org.municipality || '—')}, ${escapeHtml(org.department || '—')} (${escapeHtml(org.address || '—')})</div>
          <div><strong>Representante:</strong> ${escapeHtml(org.representativeName || '—')} (${escapeHtml(org.representativeRole || '—')})</div>
          <div><strong>Correo institucional:</strong> ${escapeHtml(org.institutionalEmail || 'Pendiente de completar')}</div>
          <div><strong>Teléfono / WhatsApp:</strong> ${escapeHtml(org.phone || '—')} / ${escapeHtml(org.whatsapp || '—')}</div>
          <div><strong>Descripción:</strong> ${escapeHtml(org.description || '—')}</div>
        </div>
      `,
      footer: `<button type="button" class="btn btn-primary" data-modal-close>Cerrar</button>`
    });
  }

  _openOrganizationModal(org, container) {
    const isNew = !org;
    modal.open({
      title: isNew ? 'Crear Nueva Organización' : `Editar Organización — ${org.name}`,
      size: 'lg',
      content: `
        <form id="form-sa-org">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Nombre completo *</label>
              <input type="text" id="sa-org-name" class="form-control" value="${escapeHtml(org?.name || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Nombre corto / Sigla</label>
              <input type="text" id="sa-org-short" class="form-control" value="${escapeHtml(org?.shortName || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de organización</label>
              <input type="text" id="sa-org-type" class="form-control" value="${escapeHtml(org?.organizationType || 'Comité Comunitario de Agua')}" />
            </div>
            <div class="form-group">
              <label class="form-label">NIT (opcional)</label>
              <input type="text" id="sa-org-nit" class="form-control" value="${escapeHtml(org?.nit || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Departamento *</label>
              <input type="text" id="sa-org-dept" class="form-control" value="${escapeHtml(org?.department || 'Bolívar')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Municipio *</label>
              <input type="text" id="sa-org-muni" class="form-control" value="${escapeHtml(org?.municipality || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Dirección / Vereda / Corregimiento</label>
              <input type="text" id="sa-org-addr" class="form-control" value="${escapeHtml(org?.address || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Nombre del representante</label>
              <input type="text" id="sa-org-rep" class="form-control" value="${escapeHtml(org?.representativeName || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Cargo del representante</label>
              <input type="text" id="sa-org-reprole" class="form-control" value="${escapeHtml(org?.representativeRole || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Correo electrónico institucional</label>
              <input type="email" id="sa-org-email" class="form-control" value="${escapeHtml(org?.institutionalEmail || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" id="sa-org-phone" class="form-control" value="${escapeHtml(org?.phone || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input type="text" id="sa-org-wa" class="form-control" value="${escapeHtml(org?.whatsapp || '')}" />
            </div>
          </div>
          <div class="form-group mt-2">
            <label class="form-label">Descripción institucional</label>
            <textarea id="sa-org-desc" class="form-control" rows="2">${escapeHtml(org?.description || '')}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-outline" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-sa-save-org">Guardar en Firestore</button>
      `,
      onOpen: (modalEl) => {
        modalEl.querySelector('#btn-sa-save-org')?.addEventListener('click', async () => {
          try {
            const payload = {
              ...(org || {}),
              name: modalEl.querySelector('#sa-org-name')?.value || '',
              shortName: modalEl.querySelector('#sa-org-short')?.value || '',
              organizationType: modalEl.querySelector('#sa-org-type')?.value || '',
              nit: modalEl.querySelector('#sa-org-nit')?.value || '',
              department: modalEl.querySelector('#sa-org-dept')?.value || '',
              municipality: modalEl.querySelector('#sa-org-muni')?.value || '',
              address: modalEl.querySelector('#sa-org-addr')?.value || '',
              representativeName: modalEl.querySelector('#sa-org-rep')?.value || '',
              representativeRole: modalEl.querySelector('#sa-org-reprole')?.value || '',
              institutionalEmail: modalEl.querySelector('#sa-org-email')?.value || '',
              phone: modalEl.querySelector('#sa-org-phone')?.value || '',
              whatsapp: modalEl.querySelector('#sa-org-wa')?.value || '',
              description: modalEl.querySelector('#sa-org-desc')?.value || ''
            };
            await sessionService.saveOrganization(payload, isNew);
            modal.close();
            notification.success('Organización guardada', 'Los datos institucionales fueron actualizados en Firestore.');
            await this._loadData();
            this._renderDashboard(container);
          } catch (err) {
            notification.error('Error al guardar', err.message);
          }
        });
      }
    });
  }

  _openEditGlobalRecordModal(storeName, rec, container) {
    modal.open({
      title: `Edición Administrativa Transversal — ${rec.name || rec.code || rec.id}`,
      size: 'md',
      content: `
        <div style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-3);">
          Cualquier modificación realizada por el Superadministrador sobre registros de una organización registra automáticamente los valores anteriores y nuevos en <code>audit_logs</code>.
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Organización propietaria del registro *</label>
          <select id="sa-rec-org" class="form-control">
            <option value="">-- Sin asignar --</option>
            ${this.organizations.map(o => `<option value="${escapeHtml(o.id)}" ${rec.organizationId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
          </select>
        </div>
        ${rec.name !== undefined ? `
          <div class="form-group mb-3">
            <label class="form-label">Nombre</label>
            <input type="text" id="sa-rec-name" class="form-control" value="${escapeHtml(rec.name || '')}" />
          </div>
        ` : ''}
        <div class="form-group mb-3">
          <label class="form-label">Responsable</label>
          <input type="text" id="sa-rec-resp" class="form-control" value="${escapeHtml(rec.responsible || '')}" />
        </div>
        <div class="form-group mb-2">
          <label class="form-label">Notas / Observaciones</label>
          <textarea id="sa-rec-notes" class="form-control" rows="2">${escapeHtml(rec.notes || '')}</textarea>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-outline" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-sa-save-rec">Guardar y Auditar</button>
      `,
      onOpen: (modalEl) => {
        modalEl.querySelector('#btn-sa-save-rec')?.addEventListener('click', async () => {
          const repoMap = {
            water_sources: waterSourceRepository,
            water_measurements: waterMeasurementRepository,
            pluviometers: pluviometerRepository,
            rainfall_records: rainfallRepository,
            sites: siteRepository,
            parcels: parcelRepository,
            observations: observationRepository
          };
          const repo = repoMap[storeName];
          if (!repo) return;

          const newOrgId = modalEl.querySelector('#sa-rec-org')?.value || null;
          const nameInput = modalEl.querySelector('#sa-rec-name');
          const respInput = modalEl.querySelector('#sa-rec-resp');
          const notesInput = modalEl.querySelector('#sa-rec-notes');

          const changes = {
            organizationId: newOrgId,
            responsible: respInput ? respInput.value.trim() : rec.responsible,
            notes: notesInput ? notesInput.value.trim() : rec.notes
          };
          if (nameInput) {
            changes.name = nameInput.value.trim();
          }

          await repo.update(rec.id, changes);
          modal.close();
          notification.success('Registro actualizado', 'Los cambios y valores previos quedaron registrados en Auditoría.');
          await this._loadData();
          this._renderDashboard(container);
        });
      }
    });
  }
}

