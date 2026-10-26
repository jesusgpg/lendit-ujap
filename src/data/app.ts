// Categorías, carreras y artículos ya vienen de la API real (ver stores/catalog.ts y
// stores/articles.ts) — aquí solo queda el contenido puramente estático de la landing.

export function getAppName(): string {
  return 'LendIt UJAP'
}

export function getAppTagline(): string {
  return 'Préstamos temporales de libros, equipos y herramientas entre estudiantes, con plazos claros y entrega directa en el campus.'
}
