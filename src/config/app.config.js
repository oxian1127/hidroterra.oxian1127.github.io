/**
 * Configuración general de la aplicación HIDROTERRA
 * Plataforma de monitoreo hídrico rural, gestión territorial y análisis agroclimático
 */

export const APP_CONFIG = {
  name: 'HIDROTERRA',
  fullName: 'Plataforma de Monitoreo Hídrico Rural y Gestión Territorial — Montes de María',
  version: '2.0.0',
  schemaVersion: '3.0',
  description: 'Plataforma HIDROTERRA para registro, seguimiento y gestión del recurso hídrico, disponibilidad, alertas y precipitaciones.',

  // Contexto geográfico: Montes de María, Colombia
  geo: {
    regionName: 'Montes de María',
    defaultCenter: [9.62, -75.18], // Zona central aproximada (Carmen de Bolívar / San Jacinto)
    defaultZoom: 10,
    minZoom: 6,
    maxZoom: 18,
    // Límites de advertencia para coordenadas regionales
    boundsMontesDeMaria: {
      minLat: 8.50,
      maxLat: 10.50,
      minLon: -76.20,
      maxLon: -74.40
    },
    // Proveedor de mapa base
    tileLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileLayerAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> colaboradores'
  },

  // Parámetros de lluvia
  rainfall: {
    unit: 'mm',
    maxReasonableDailyMm: 350, // Lluvia extrema tropical de advertencia
    duplicateThresholdMinutes: 60 // Alerta si hay dos mediciones para el mismo pluviómetro en menos de 1h
  },

  // Almacenamiento y respaldos
  storage: {
    metaKey: 'pana_v2_system_meta',
    lastBackupKey: 'pana_v2_last_backup_timestamp',
    backupWarningDays: 7 // Avisar si han pasado más de 7 días sin exportar respaldo
  }
};
