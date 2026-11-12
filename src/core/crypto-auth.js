/**
 * Módulo Criptográfico para Hashing y Verificación de Contraseñas — HIDROTERRA
 *
 * Implementa derivación de claves mediante Web Crypto API (PBKDF2 con SHA-256),
 * sal aleatoria individual por usuario generada con crypto.getRandomValues()
 * y 120,000 iteraciones.
 *
 * IMPORTANTE (Alcance Demostrativo y Académico):
 * - Nunca almacena contraseñas en texto plano ni utiliza algoritmos obsoletos (MD5 / SHA-1).
 * - Solo almacena: passwordHash, passwordSalt, passwordAlgorithm y passwordIterations.
 * - La verificación se ejecuta localmente en el navegador como parte de la demostración académica.
 */

export const PASSWORD_HASH_CONFIG = {
  algorithm: 'PBKDF2-SHA256',
  hashName: 'SHA-256',
  iterations: 120000,
  saltByteLength: 16,
  keyBitLength: 256
};

/**
 * Convierte un Uint8Array a cadena hexadecimal
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convierte una cadena hexadecimal a Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (clean.length % 2 !== 0) {
    throw new Error('Formato de sal o hash hexadecimal inválido.');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Comparación en tiempo constante para evitar ataques de temporización básicos
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  if (strA.length !== strB.length || strA.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Genera una sal criptográfica aleatoria de 16 bytes (128 bits)
 * @returns {string} Sal en formato hexadecimal
 */
export function generateRandomSalt() {
  const saltBytes = new Uint8Array(PASSWORD_HASH_CONFIG.saltByteLength);
  window.crypto.getRandomValues(saltBytes);
  return bytesToHex(saltBytes);
}

/**
 * Deriva un hash PBKDF2-SHA256 a partir de una contraseña, sal e iteraciones
 * @param {string} plainPassword
 * @param {string} saltHex
 * @param {number} iterations
 * @returns {Promise<string>} Hash en formato hexadecimal
 */
export async function derivePasswordHash(
  plainPassword,
  saltHex,
  iterations = PASSWORD_HASH_CONFIG.iterations
) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Se requiere una contraseña válida para derivar el hash.');
  }

  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(plainPassword);
  const saltBuffer = hexToBytes(saltHex);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: Number(iterations) || PASSWORD_HASH_CONFIG.iterations,
      hash: PASSWORD_HASH_CONFIG.hashName
    },
    baseKey,
    PASSWORD_HASH_CONFIG.keyBitLength
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Crea el paquete de credenciales seguras para almacenar en Firestore (sin texto plano)
 * @param {string} plainPassword
 * @returns {Promise<{passwordHash: string, passwordSalt: string, passwordAlgorithm: string, passwordIterations: number}>}
 */
export async function createPasswordCredential(plainPassword) {
  const passwordSalt = generateRandomSalt();
  const passwordIterations = PASSWORD_HASH_CONFIG.iterations;
  const passwordHash = await derivePasswordHash(plainPassword, passwordSalt, passwordIterations);

  return {
    passwordHash,
    passwordSalt,
    passwordAlgorithm: PASSWORD_HASH_CONFIG.algorithm,
    passwordIterations
  };
}

/**
 * Verifica si una contraseña en texto plano coincide con las credenciales almacenadas del usuario
 * @param {string} plainPassword
 * @param {object} userRecord
 * @returns {Promise<boolean>}
 */
export async function verifyPasswordCredential(plainPassword, userRecord) {
  if (!plainPassword || !userRecord || !userRecord.passwordHash || !userRecord.passwordSalt) {
    return false;
  }

  try {
    const iterations = Number(userRecord.passwordIterations) || PASSWORD_HASH_CONFIG.iterations;
    const derived = await derivePasswordHash(plainPassword, userRecord.passwordSalt, iterations);
    return constantTimeEqual(derived, userRecord.passwordHash);
  } catch {
    return false;
  }
}

/**
 * Evalúa la fortaleza de una contraseña para orientar al usuario
 * @param {string} password
 * @returns {{valid: boolean, score: number, label: string, errors: string[]}}
 */
export function validatePasswordStrength(password) {
  const pwd = String(password || '');
  const errors = [];
  let score = 0;

  if (pwd.length >= 8) {
    score += 1;
  } else {
    errors.push('Debe tener al menos 8 caracteres.');
  }

  if (/[A-ZÁÉÍÓÚÑ]/.test(pwd) && /[a-záéíóúñ]/.test(pwd)) {
    score += 1;
  } else {
    errors.push('Debe combinar letras mayúsculas y minúsculas.');
  }

  if (/\d/.test(pwd)) {
    score += 1;
  } else {
    errors.push('Debe incluir al menos un número.');
  }

  if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) {
    score += 1;
  }

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
  return {
    valid: pwd.length >= 8 && errors.length <= 1,
    score,
    label: labels[Math.min(score, 4)],
    errors
  };
}

