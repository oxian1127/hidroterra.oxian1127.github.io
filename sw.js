/**
 * Service Worker para HIDROTERRA
 * Garantiza autonomía y funcionamiento 100% offline tras la instalación inicial.
 */

const CACHE_NAME = 'hidroterra-cache-v1.5.2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.svg',
  './assets/fonts/open-sans-latin.woff2',
  './assets/fonts/open-sans-italic-latin.woff2',
  './assets/vendor/leaflet/leaflet.css',
  './assets/vendor/leaflet/leaflet.js',
  './assets/vendor/leaflet/marker-icon.png',
  './assets/vendor/leaflet/marker-icon-2x.png',
  './assets/vendor/leaflet/marker-shadow.png',
  './assets/vendor/chartjs/chart.umd.min.js',
  './assets/vendor/fontawesome/css/all.min.css',
  './assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './assets/vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './src/styles/reset.css',
  './src/styles/variables.css',
  './src/styles/global.css',
  './src/styles/layout.css',
  './src/styles/components.css',
  './src/styles/forms.css',
  './src/styles/tables.css',
  './src/styles/dashboard.css',
  './src/styles/maps.css',
  './src/modules/climate/styles/climate.css',
  './src/styles/responsive.css',
  './src/styles/bootstrap-theme.css',
  './src/main.js',
  './src/app.js',
  './src/router.js',
  './src/config/app.config.js',
  './src/config/database.config.js',
  './src/config/modules.config.js',
  './src/core/events.js',
  './src/core/theme.js',
  './src/core/errors.js',
  './src/core/logger.js',
  './src/core/validators.js',
  './src/core/date-utils.js',
  './src/domain/models/WaterSource.js',
  './src/domain/models/Pluviometer.js',
  './src/domain/models/RainfallRecord.js',
  './src/domain/models/Site.js',
  './src/domain/models/Parcel.js',
  './src/domain/models/Crop.js',
  './src/domain/models/WaterObservation.js',
  './src/domain/models/UserProfile.js',
  './src/domain/rules/rainfall.rules.js',
  './src/domain/rules/coordinates.rules.js',
  './src/domain/rules/data-integrity.rules.js',
  './src/application/dashboard.service.js',
  './src/application/water-sources.service.js',
  './src/application/pluviometers.service.js',
  './src/application/rainfall.service.js',
  './src/application/sites.service.js',
  './src/application/parcels.service.js',
  './src/application/observations.service.js',
  './src/application/reports.service.js',
  './src/application/backup.service.js',
  './src/application/future-sync.service.js',
  './src/infrastructure/database/indexeddb.js',
  './src/infrastructure/database/migrations.js',
  './src/infrastructure/database/repositories/base.repository.js',
  './src/infrastructure/database/repositories/water-source.repository.js',
  './src/infrastructure/database/repositories/pluviometer.repository.js',
  './src/infrastructure/database/repositories/rainfall.repository.js',
  './src/infrastructure/database/repositories/site.repository.js',
  './src/infrastructure/database/repositories/parcel.repository.js',
  './src/infrastructure/database/repositories/crop.repository.js',
  './src/infrastructure/database/repositories/observation.repository.js',
  './src/infrastructure/geo/geolocation.js',
  './src/infrastructure/geo/map.service.js',
  './src/infrastructure/files/file-validation.js',
  './src/infrastructure/files/json-export.js',
  './src/infrastructure/files/json-import.js',
  './src/infrastructure/sync/sync-adapter.js',
  './src/ui/components/notification.js',
  './src/ui/components/status-badge.js',
  './src/ui/components/empty-state.js',
  './src/ui/components/modal.js',
  './src/ui/components/data-table.js',
  './src/ui/components/form-field.js',
  './src/ui/components/sidebar.js',
  './src/ui/components/header.js',
  './src/ui/layouts/app-layout.js',
  './src/ui/views/dashboard.view.js',
  './src/ui/views/water-sources.view.js',
  './src/ui/views/pluviometers.view.js',
  './src/ui/views/rainfall.view.js',
  './src/ui/views/climate.view.js',
  './src/ui/views/map.view.js',
  './src/ui/views/sites.view.js',
  './src/ui/views/parcels.view.js',
  './src/ui/views/observations.view.js',
  './src/ui/views/reports.view.js',
  './src/ui/views/settings.view.js',
  './src/ui/views/about.view.js',
  './src/modules/climate/config/weatherConfig.js',
  './src/modules/climate/utils/weatherValidators.js',
  './src/modules/climate/utils/weatherFormatters.js',
  './src/modules/climate/services/weatherCache.js',
  './src/modules/climate/services/weatherApi.js',
  './src/modules/climate/services/weatherAnalysis.js',
  './src/modules/climate/components/CurrentWeather.js',
  './src/modules/climate/components/AgroclimaticIndicators.js',
  './src/modules/climate/components/ClimateAlerts.js',
  './src/modules/climate/components/WeatherForecast.js',
  './src/modules/climate/components/PrecipitationChart.js',
  './src/modules/climate/components/WeatherMap.js',
  './data/examples/sample-data.js',
  './data/examples/muestra-montes-de-maria.json'
];

// Instalación: Precargar todos los recursos de la PWA
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Almacenando en caché recursos estáticos locales...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpiar cachés obsoletas de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones (Fetch)
self.addEventListener('fetch', (event) => {
  // Ignorar esquemas no soportados (extensiones, etc.)
  if (!event.request.url.startsWith('http')) return;

  const requestUrl = new URL(event.request.url);

  // Para recursos locales de la app: Estrategia Cache First, con fallback de Red
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Para recursos externos (por ejemplo teselas de OpenStreetMap):
  // Estrategia Network First con fallback silencioso para no bloquear la app
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cached) => {
        return cached || new Response('Recurso no disponible sin conexión', {
          status: 503,
          statusText: 'Service Unavailable (Offline)'
        });
      });
    })
  );
});
