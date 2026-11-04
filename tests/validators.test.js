/**
 * Pruebas unitarias: Validadores e integridad de datos
 */

import {
  isValidLatitude,
  isValidLongitude,
  isValidPrecipitation,
  escapeHtml,
  generateId,
  isRequired,
  isValidDate
} from '../src/core/validators.js';

export function runValidatorsTests(suite) {
  suite.test('Validación de Latitud: acepta coordenadas válidas y rechaza fuera de rango (-90 a 90)', (assert) => {
    assert.strictEqual(isValidLatitude(9.717), true, 'Latitud positiva válida');
    assert.strictEqual(isValidLatitude(-4.5), true, 'Latitud negativa válida');
    assert.strictEqual(isValidLatitude(0), true, 'Latitud ecuatorial 0');
    assert.strictEqual(isValidLatitude(90), true, 'Límite máximo 90');
    assert.strictEqual(isValidLatitude(-90), true, 'Límite mínimo -90');
    assert.strictEqual(isValidLatitude(90.1), false, 'Latitud mayor a 90 rechazada');
    assert.strictEqual(isValidLatitude(-95), false, 'Latitud menor a -90 rechazada');
    assert.strictEqual(isValidLatitude('invalido'), false, 'Texto no numérico rechazado');
  });

  suite.test('Validación de Longitud: acepta coordenadas válidas y rechaza fuera de rango (-180 a 180)', (assert) => {
    assert.strictEqual(isValidLongitude(-75.12), true, 'Longitud occidental válida');
    assert.strictEqual(isValidLongitude(120.5), true, 'Longitud oriental válida');
    assert.strictEqual(isValidLongitude(180), true, 'Límite 180');
    assert.strictEqual(isValidLongitude(-180), true, 'Límite -180');
    assert.strictEqual(isValidLongitude(-180.5), false, 'Longitud menor a -180 rechazada');
    assert.strictEqual(isValidLongitude(181), false, 'Longitud mayor a 180 rechazada');
  });

  suite.test('Validación de Precipitación (mm): solo admite números finitos mayores o iguales a cero', (assert) => {
    assert.strictEqual(isValidPrecipitation(0), true, '0 mm es válido (sin lluvia)');
    assert.strictEqual(isValidPrecipitation('0'), true, '"0" como cadena es válido');
    assert.strictEqual(isValidPrecipitation(15.5), true, '15.5 mm válido');
    assert.strictEqual(isValidPrecipitation(120), true, '120 mm válido');
    assert.strictEqual(isValidPrecipitation(-1), false, 'Valores negativos rechazados');
    assert.strictEqual(isValidPrecipitation(-0.1), false, 'Valor negativo decimal rechazado');
    assert.strictEqual(isValidPrecipitation(''), false, 'Cadena vacía rechazada');
    assert.strictEqual(isValidPrecipitation(null), false, 'Null rechazado');
    assert.strictEqual(isValidPrecipitation(undefined), false, 'Undefined rechazado');
    assert.strictEqual(isValidPrecipitation(NaN), false, 'NaN rechazado');
  });

  suite.test('Seguridad XSS: escapeHtml previene inyección de etiquetas HTML no confiables', (assert) => {
    const malicious = '<script>alert("hack")</script>';
    const escaped = escapeHtml(malicious);
    assert.strictEqual(escaped.includes('<script>'), false, 'Etiqueta script neutralizada');
    assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;', 'Escape correcto');
  });

  suite.test('Generador de Identificadores UUID v4', (assert) => {
    const id1 = generateId();
    const id2 = generateId();
    assert.ok(id1 && id1.length >= 32, 'ID generado con longitud esperada');
    assert.notStrictEqual(id1, id2, 'Identificadores únicos consecutivos');
  });
}
