/**
 * Modelo de Dominio: Perfil Local de Usuario (UserProfile)
 * Configuración de conveniencia para autocompletar el campo "Responsable"
 */

export class UserProfile {
  constructor(data = {}) {
    this.name = (data.name || '').trim();
    this.role = (data.role || 'Monitor Comunitario').trim();
    this.organization = (data.organization || 'Comité de Agua / Asociación Comunitaria').trim();
    this.defaultMunicipality = (data.defaultMunicipality || 'El Carmen de Bolívar').trim();
  }

  toJSON() {
    return {
      name: this.name,
      role: this.role,
      organization: this.organization,
      defaultMunicipality: this.defaultMunicipality
    };
  }
}
