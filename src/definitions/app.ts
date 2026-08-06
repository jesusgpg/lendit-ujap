export function getAppName(): string {
  return 'LendIt UJAP'
}

export function getAppTagline(): string {
  return 'Como Airbnb, pero para prestar cosas entre estudiantes por tiempo limitado.'
}

export interface ItemCategory {
  id: string
  label: string
}

export function getItemCategories(): ItemCategory[] {
  return [
    { id: 'calculadoras', label: 'Calculadoras' },
    { id: 'cargadores', label: 'Cargadores' },
    { id: 'equipo', label: 'Equipo' },
  ]
}
