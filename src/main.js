/**
 * Punto de entrada principal (Entry Point) para PAnA V2 AGUA
 */

import { App } from './app.js';

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('app');
  if (!root) {
    console.error('Elemento raíz #app no encontrado en el DOM.');
    return;
  }

  const app = new App(root);
  await app.start();
});
