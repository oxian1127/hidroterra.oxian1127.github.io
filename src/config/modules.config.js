/**
 * Configuración de módulos y navegación de HIDROTERRA
 */

export const SIDEBAR_GROUPS_CONFIG = [
  {
    id: 'water',
    label: 'Gestión Hídrica',
    icon: 'fa-solid fa-droplet',
    items: ['water-sources', 'water-availability', 'water-tools', 'water-alerts']
  },
  {
    id: 'climate',
    label: 'Lluvias y Clima',
    icon: 'fa-solid fa-cloud-sun-rain',
    items: ['pluviometers', 'rainfall', 'climate']
  },
  {
    id: 'territory',
    label: 'Territorio y Campo',
    icon: 'fa-solid fa-map-location-dot',
    items: ['map', 'sites', 'parcels', 'observations']
  },
  {
    id: 'system',
    label: 'Reportes y Sistema',
    icon: 'fa-solid fa-sliders',
    items: ['reports', 'settings', 'about']
  }
];

export const MODULES_CONFIG = [
  {
    id: 'dashboard',
    label: 'Inicio / Panel',
    icon: 'fa-solid fa-gauge-high',
    description: 'Indicadores principales, disponibilidad hídrica, alertas y accesos rápidos'
  },
  {
    id: 'water-sources',
    label: 'Fuentes de Agua',
    icon: 'fa-solid fa-faucet-drip',
    group: 'water',
    description: 'Inventario de pozos, arroyos, ríos, manantiales, reservorios y tanques'
  },
  {
    id: 'water-availability',
    label: 'Disponibilidad Hídrica',
    icon: 'fa-solid fa-water',
    group: 'water',
    description: 'Monitoreo periódico de niveles, volúmenes, capacidad y fichas técnicas de disponibilidad'
  },
  {
    id: 'water-tools',
    label: 'Herramientas Hídricas',
    icon: 'fa-solid fa-calculator',
    group: 'water',
    description: 'Calculadoras de captación de agua lluvia, geometrías de almacenamiento, balance hídrico y autonomía'
  },
  {
    id: 'water-alerts',
    label: 'Alertas Hídricas',
    icon: 'fa-solid fa-bell',
    group: 'water',
    description: 'Sistema de alertas tempranas configurables por niveles críticos, déficit y pronóstico'
  },
  {
    id: 'pluviometers',
    label: 'Pluviómetros',
    icon: 'fa-solid fa-cloud-showers-heavy',
    group: 'climate',
    description: 'Fichas técnicas y georreferenciación de equipos'
  },
  {
    id: 'rainfall',
    label: 'Registro de Lluvias',
    icon: 'fa-solid fa-cloud-rain',
    group: 'climate',
    description: 'Captura de precipitaciones en mm, acumulados y gráficos'
  },
  {
    id: 'climate',
    label: 'Clima y Meteorología',
    icon: 'fa-solid fa-temperature-half',
    group: 'climate',
    description: 'Monitoreo meteorológico en tiempo real, pronóstico 7 días y análisis agroclimático'
  },
  {
    id: 'map',
    label: 'Mapa Territorial',
    icon: 'fa-solid fa-compass',
    group: 'territory',
    description: 'Visualización geográfica de fuentes, reservorios, mediciones, equipos y sitios'
  },
  {
    id: 'sites',
    label: 'Sitios y Comunidades',
    icon: 'fa-solid fa-mountain-sun',
    group: 'territory',
    description: 'Poblaciones, corregimientos, veredas y sectores'
  },
  {
    id: 'parcels',
    label: 'Parcelas y Cultivos',
    icon: 'fa-solid fa-seedling',
    group: 'territory',
    description: 'Condiciones productivas territoriales vinculadas al agua'
  },
  {
    id: 'observations',
    label: 'Observaciones Hídricas',
    icon: 'fa-solid fa-clipboard-list',
    group: 'territory',
    description: 'Notas de campo sobre sequía, disponibilidad y suelos'
  },
  {
    id: 'reports',
    label: 'Reportes y Exportación',
    icon: 'fa-solid fa-chart-column',
    group: 'system',
    description: 'Balances acumulados, disponibilidad territorial, CSV y formatos imprimibles'
  },
  {
    id: 'settings',
    label: 'Configuración y Respaldos',
    icon: 'fa-solid fa-gear',
    group: 'system',
    description: 'Apariencia, opciones de visualización, copias de seguridad JSON y estado del almacenamiento'
  },
  {
    id: 'about',
    label: 'Acerca de y Manual',
    icon: 'fa-solid fa-circle-info',
    group: 'system',
    description: 'Información del proyecto, descripción de la plataforma y manual de uso'
  }
];
