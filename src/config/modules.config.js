/**
 * Configuración de módulos y navegación de PAnA V2 AGUA
 */

export const MODULES_CONFIG = [
  {
    id: 'dashboard',
    label: 'Inicio / Panel',
    icon: 'dashboard',
    description: 'Indicadores principales, precipitación acumulada y accesos rápidos'
  },
  {
    id: 'water-sources',
    label: 'Fuentes de Agua',
    icon: 'water_drop',
    description: 'Inventario de pozos, arroyos, ríos, manantiales y reservorios'
  },
  {
    id: 'pluviometers',
    label: 'Pluviómetros',
    icon: 'ruler',
    description: 'Fichas técnicas y georreferenciación de equipos'
  },
  {
    id: 'rainfall',
    label: 'Registro de Lluvias',
    icon: 'rain',
    description: 'Captura de precipitaciones en mm, acumulados y gráficos'
  },
  {
    id: 'map',
    label: 'Mapa Territorial',
    icon: 'map',
    description: 'Visualización geográfica de fuentes, equipos y sitios'
  },
  {
    id: 'sites',
    label: 'Sitios y Comunidades',
    icon: 'location',
    description: 'Poblaciones, corregimientos, veredas y sectores'
  },
  {
    id: 'parcels',
    label: 'Parcelas y Cultivos',
    icon: 'agriculture',
    description: 'Condiciones productivas territoriales vinculadas al agua'
  },
  {
    id: 'observations',
    label: 'Observaciones Hídricas',
    icon: 'notes',
    description: 'Notas de campo sobre sequía, disponibilidad y suelos'
  },
  {
    id: 'reports',
    label: 'Reportes y Exportación',
    icon: 'bar_chart',
    description: 'Balances acumulados, comparativas, CSV y formatos imprimibles'
  },
  {
    id: 'settings',
    label: 'Respaldo y Datos',
    icon: 'settings',
    description: 'Exportar/Importar JSON, integridad y estado del almacenamiento'
  },
  {
    id: 'about',
    label: 'Acerca de y Manual',
    icon: 'info',
    description: 'Información del proyecto, descripción de la plataforma y manual de uso'
  }
];
