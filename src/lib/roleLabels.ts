// Los roles base viven en la BD con su nombre técnico (en inglés, usado también por el
// trigger de alta de usuarios); esto solo traduce lo que se muestra en pantalla.
const BUILT_IN_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  STUDENT: 'Estudiante',
  PROFESSOR: 'Profesor',
}

export const PROTECTED_ROLE_NAMES = ['ADMIN', 'STUDENT', 'PROFESSOR']

export function roleLabel(name: string): string {
  return BUILT_IN_ROLE_LABELS[name] ?? name
}

export function isProtectedRole(name: string): boolean {
  return PROTECTED_ROLE_NAMES.includes(name)
}
