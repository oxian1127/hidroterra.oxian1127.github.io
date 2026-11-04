/**
 * Mini ejecutor de pruebas unitarias (Test Runner) en navegador
 */

class TestSuite {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run(outputElement) {
    this.passed = 0;
    this.failed = 0;
    outputElement.innerHTML = '<p>Ejecutando suite de pruebas automatizadas...</p>';

    const results = [];

    for (const t of this.tests) {
      const assert = {
        strictEqual(actual, expected, msg = '') {
          if (actual !== expected) {
            throw new Error(`${msg} | Esperado: [${expected}], Recibido: [${actual}]`);
          }
        },
        notStrictEqual(actual, expected, msg = '') {
          if (actual === expected) {
            throw new Error(`${msg} | No se esperaba: [${expected}]`);
          }
        },
        ok(value, msg = '') {
          if (!value) {
            throw new Error(`${msg} | Se esperaba valor verdadero pero fue [${value}]`);
          }
        },
        throws(fn, regex = null, msg = '') {
          let threw = false;
          let error = null;
          try {
            fn();
          } catch (e) {
            threw = true;
            error = e;
          }
          if (!threw) {
            throw new Error(`${msg} | Se esperaba que lanzara una excepción pero no ocurrió.`);
          }
          if (regex && !regex.test(error.message)) {
            throw new Error(`${msg} | Mensaje "${error.message}" no coincide con patrón ${regex}`);
          }
        },
        doesNotThrow(fn, msg = '') {
          try {
            fn();
          } catch (e) {
            throw new Error(`${msg} | Lanzó excepción inesperada: "${e.message}"`);
          }
        }
      };

      try {
        await t.fn(assert);
        this.passed++;
        results.push({ name: t.name, status: 'pass' });
      } catch (err) {
        this.failed++;
        results.push({ name: t.name, status: 'fail', error: err.message });
      }
    }

    // Renderizar resultados
    outputElement.innerHTML = `
      <div style="margin-bottom: 20px; padding: 16px; border-radius: 8px; background-color: ${this.failed === 0 ? '#dcfce7' : '#fee2e2'}; color: ${this.failed === 0 ? '#15803d' : '#b91c1c'}; font-weight: bold;">
        ${this.failed === 0 ? '[ÉXITO] TODAS LAS PRUEBAS SUPERADAS' : '[ERROR] SE ENCONTRARON FALLOS'} (${this.passed} aprobadas, ${this.failed} fallidas de ${this.tests.length} totales)
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${results.map(r => `
          <div style="padding: 10px 14px; border-radius: 6px; border: 1px solid ${r.status === 'pass' ? '#bbf7d0' : '#fca5a5'}; background: #ffffff;">
            <span style="font-weight: bold; color: ${r.status === 'pass' ? '#16a34a' : '#dc2626'};">${r.status === 'pass' ? '[PASS]' : '[FAIL]'}</span>
            <strong>${r.name}</strong>
            ${r.error ? `<div style="color: #dc2626; font-size: 0.85rem; margin-top: 4px; font-family: monospace;">${r.error}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    return { passed: this.passed, failed: this.failed, total: this.tests.length };
  }
}

export const suite = new TestSuite();
