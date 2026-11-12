/**
 * Configuración centralizada de Firebase para HIDROTERRA
 * Inicializa Firebase una única vez utilizando el SDK modular (firebase/app y firebase/firestore).
 *
 * NOTA TÉCNICA Y ACADÉMICA:
 * Esta configuración corresponde a una versión demostrativa y académica de HIDROTERRA.
 * No utiliza Firebase Authentication; la validación de sesiones y aislamiento por organización
 * se gestionan a nivel de aplicación y consultas demostrativas sobre Firestore.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDH3CoSJCfc37_a2yV7YP2bbYOTzyFUGLc",
  authDomain: "hidroterra-32ce7.firebaseapp.com",
  projectId: "hidroterra-32ce7",
  storageBucket: "hidroterra-32ce7.firebasestorage.app",
  messagingSenderId: "343758968407",
  appId: "1:343758968407:web:ea4bcd57c509a6db84f512",
  measurementId: "G-LQLJ9RS7DV",
  databaseLocation: "nam5"
};

export const FIRESTORE_DB_LOCATION = "nam5";

/**
 * Colecciones oficiales en Firestore adaptadas a los módulos reales de HIDROTERRA
 */
export const FIRESTORE_COLLECTIONS = {
  organizations: 'organizations',
  users: 'users',
  rain_events: 'rain_events',
  pluviometers: 'pluviometers',
  water_sources: 'water_sources',
  water_measurements: 'water_measurements',
  water_alerts: 'water_alerts',
  sites: 'sites',
  parcels: 'parcels',
  crops: 'crops',
  observations: 'observations',
  audit_logs: 'audit_logs',
  public_directory: 'public_directory',
  app_settings: 'app_settings'
};

/**
 * Mapeo entre los almacenes locales de IndexedDB y las colecciones de Firestore
 */
export const STORE_TO_FIRESTORE_COLLECTION = {
  rainfall_records: FIRESTORE_COLLECTIONS.rain_events,
  pluviometers: FIRESTORE_COLLECTIONS.pluviometers,
  water_sources: FIRESTORE_COLLECTIONS.water_sources,
  water_measurements: FIRESTORE_COLLECTIONS.water_measurements,
  water_alerts: FIRESTORE_COLLECTIONS.water_alerts,
  sites: FIRESTORE_COLLECTIONS.sites,
  parcels: FIRESTORE_COLLECTIONS.parcels,
  crops: FIRESTORE_COLLECTIONS.crops,
  observations: FIRESTORE_COLLECTIONS.observations
};

let firebaseAppInstance = null;
let firestoreDbInstance = null;
let firestoreSdkModule = null;
let initPromise = null;

/**
 * Inicializa Firebase y Firestore una sola vez en toda la aplicación.
 * @returns {Promise<{app: any, db: any, sdk: any, available: boolean, error?: Error}>}
 */
export async function getFirebaseInstance() {
  if (firebaseAppInstance && firestoreDbInstance && firestoreSdkModule) {
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      sdk: firestoreSdkModule,
      available: true
    };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const appModule = await import('firebase/app');
      const firestoreModule = await import('firebase/firestore');

      const existingApps = appModule.getApps ? appModule.getApps() : [];
      firebaseAppInstance = existingApps.length > 0
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);

      firestoreDbInstance = firestoreModule.getFirestore(firebaseAppInstance);
      firestoreSdkModule = firestoreModule;

      return {
        app: firebaseAppInstance,
        db: firestoreDbInstance,
        sdk: firestoreSdkModule,
        available: true
      };
    } catch (error) {
      initPromise = null;
      return {
        app: null,
        db: null,
        sdk: null,
        available: false,
        error
      };
    }
  })();

  return initPromise;
}

