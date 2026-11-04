/**
 * Configuración de módulos y navegación de HIDROTERRA
 */

export const MODULES_CONFIG = [
  {
    id: 'dashboard',
    label: 'Inicio / Panel',
    icon: 'dashboard',
    description: 'Indicadores principales, disponibilidad hídrica, alertas y accesos rápidos'
  },
  {
    id: 'water-sources',
    label: 'Fuentes de Agua',
    icon: 'water_drop',
    description: 'Inventario de pozos, arroyos, ríos, manantiales, reservorios y tanques'
  },
  {
    id: 'water-availability',
    label: 'Disponibilidad Hídrica',
    icon: 'water_level',
    description: 'Monitoreo periódico de niveles, volúmenes, capacidad y fichas técnicas de disponibilidad'
  },
  {
    id: 'water-tools',
    label: 'Herramientas Hídricas',
    icon: 'calculator',
    description: 'Calculadoras de captación de agua lluvia, geometrías de almacenamiento, balance hídrico y autonomía'
  },
  {
    id: 'water-alerts',
    label: 'Alertas Hídricas',
    icon: 'alerts',
    description: 'Sistema de alertas tempranas configurables por niveles críticos, déficit y pronóstico'
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
    id: 'climate',
    label: 'Clima y Meteorología',
    icon: 'climate',
    description: 'Monitoreo meteorológico en tiempo real, pronóstico 7 días y análisis agroclimático'
  },
  {
    id: 'map',
    label: 'Mapa Territorial',
    icon: 'map',
    description: 'Visualización geográfica de fuentes, reservorios, mediciones, equipos y sitios'
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
    description: 'Balances acumulados, disponibilidad territorial, CSV y formatos imprimibles'
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
