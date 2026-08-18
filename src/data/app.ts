import type { Article, Category, ItemCategory } from '../types'

export function getAppName(): string {
  return 'LendIt UJAP'
}

export function getAppTagline(): string {
  return 'Como Airbnb, pero para prestar cosas entre estudiantes por tiempo limitado.'
}

export function getItemCategories(): ItemCategory[] {
  return [
    { id: 'calculadoras', label: 'Calculadoras' },
    { id: 'cargadores', label: 'Cargadores' },
    { id: 'equipo', label: 'Equipo' },
  ]
}

export function getArticles(): Article[] {
  return [
    {
      id: 'article-1',
      code: '#UJAP-0142',
      title: 'Calculadora HP 50g',
      category: 'Ingeniería',
      duration: '2 días',
      status: 'lent',
      returnTime: 'Vie · 4:00 pm',
    },
    {
      id: 'article-2',
      code: '#UJAP-0098',
      title: 'Cargador USB-C 65W',
      category: 'Derecho',
      duration: '4 horas',
      status: 'available',
    },
  ]
}

export function getCategories(): Category[] {
  return [
    {
      id: 'calculadoras',
      label: 'Calculadoras',
      icon: '⌗',
      blurb: 'Financiera, científica o de ingeniería para ese parcial de última hora.',
    },
    {
      id: 'cargadores',
      label: 'Cargadores',
      icon: '⚡',
      blurb: 'Cables y adaptadores para no quedarte sin batería entre clase y clase.',
    },
    {
      id: 'equipo',
      label: 'Equipo',
      icon: '◈',
      blurb: 'Audífonos, mouse, trípodes y demás herramientas de laboratorio o taller.',
    },
  ]
}
