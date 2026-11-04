/**
 * Registrador de eventos local y diagnóstico (Logger)
 */

import { events } from './events.js';

class Logger {
  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
    this.logs = [];
  }

  _record(level, message, details = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details, this._replacer)) : details) : null
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.pop();
    }

    if (level === 'ERROR') {
      console.error(`[PAnA AGUA] ${message}`, details || '');
      events.emit('system:error', entry);
    } else if (level === 'WARN') {
      console.warn(`[PAnA AGUA] ${message}`, details || '');
    } else {
      console.log(`[PAnA AGUA] ${message}`, details || '');
    }

    return entry;
  }

  _replacer(key, value) {
    // Protección contra fuga de campos sensibles si existieran
    if (['password', 'token', 'secret', 'auth'].includes(key.toLowerCase())) {
      return '***REDACTED***';
    }
    return value;
  }

  info(message, details = null) {
    return this._record('INFO', message, details);
  }

  warn(message, details = null) {
    return this._record('WARN', message, details);
  }

  error(message, details = null) {
    return this._record('ERROR', message, details);
  }

  getEntries() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
