/**
 * Jerarquía de errores del sistema PAnA V2 AGUA
 */

export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = {}) {
    super(message, 'VALIDATION_ERROR', errors);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class StorageError extends AppError {
  constructor(message, originalError = null) {
    super(message, 'STORAGE_ERROR', originalError);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

export class IntegrityError extends AppError {
  constructor(message, details = null) {
    super(message, 'INTEGRITY_ERROR', details);
    this.name = 'IntegrityError';
  }
}

export class NotFoundError extends AppError {
  constructor(entityName, id) {
    super(`No se encontró el registro de "${entityName}" con ID: ${id}`, 'NOT_FOUND', { entityName, id });
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'No cuenta con los permisos necesarios para realizar esta acción.') {
    super(message, 'PERMISSION_DENIED');
    this.name = 'PermissionError';
  }
}
