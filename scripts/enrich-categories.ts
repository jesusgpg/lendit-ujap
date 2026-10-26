import 'dotenv/config'
import { prisma } from '../api/_lib/prisma.ts'
import { categoryPhotoData, searchCategoryPhotos, unsplashRequest, UnsplashError } from '../api/categories.ts'

// Explicit opt-in. Preview performs reads/search only; --apply writes categories and tracks selections.
const apply = process.argv.includes('--apply')
const existingPhotoQueries: Record<string, string> = {
  'utiles-escolares': 'school stationery supplies',
  electronicos: 'headphones computer accessories',
  laptops: 'laptop computer desk',
  cargadores: 'phone charger cable',
  videobeam: 'projector presentation',
  marcadores: 'whiteboard markers',
  libros: 'university textbooks books',
  laboratorio: 'laboratory microscope equipment',
}
const definitions = [
  { key: 'calculadoras', label: 'Calculadoras', blurb: 'Calculadoras científicas y gráficas para tus asignaturas.', query: 'scientific calculator' },
  { key: 'dibujo-tecnico', label: 'Dibujo técnico', blurb: 'Reglas, escuadras, compases y equipo de dibujo técnico.', query: 'technical drawing drafting tools' },
  { key: 'fotografia', label: 'Fotografía', blurb: 'Cámaras, lentes, trípodes y accesorios de fotografía.', query: 'camera photography equipment' },
  { key: 'audio', label: 'Audio', blurb: 'Micrófonos, grabadoras y equipo de sonido.', query: 'microphone audio equipment' },
  { key: 'tablets', label: 'Tablets', blurb: 'Tablets y accesorios para estudiar y crear.', query: 'tablet stylus desk' },
  { key: 'herramientas', label: 'Herramientas', blurb: 'Herramientas manuales para proyectos universitarios.', query: 'hand tools workbench' },
  { key: 'batas-proteccion-laboratorio', label: 'Batas y protección de laboratorio', blurb: 'Batas, gafas y protección personal para prácticas supervisadas.', query: 'laboratory safety goggles lab coat' },
  { key: 'material-laboratorio', label: 'Material de laboratorio', blurb: 'Instrumental y material de laboratorio; no incluye sustancias químicas.', query: 'empty laboratory glassware' },
  { key: 'electronica-prototipado', label: 'Electrónica y prototipado', blurb: 'Placas, sensores y equipo para proyectos de electrónica.', query: 'electronics breadboard circuit' },
  { key: 'arquitectura-maquetas', label: 'Arquitectura y maquetas', blurb: 'Equipo y materiales para diseño arquitectónico y maquetas.', query: 'architectural scale model' },
  { key: 'instrumentos-musicales', label: 'Instrumentos musicales', blurb: 'Instrumentos y accesorios para ensayos y actividades del campus.', query: 'musical instruments guitar piano' },
  { key: 'deportes', label: 'Deportes', blurb: 'Equipo y accesorios para actividades deportivas.', query: 'sports equipment basketball' },
]

// Optional reviewed photo overrides, e.g. --photo=calculadoras:PHOTO_ID.
const overrides = new Map<string, string>()
for (const argument of process.argv.slice(2)) {
  if (argument === '--apply') continue
  const match = /^--photo=([a-z0-9-]+):([\w-]{1,100})$/.exec(argument)
  if (!match) throw new Error('Argumento inválido. Usa --apply o --photo=clave:ID_UNSPLASH.')
  overrides.set(match[1]!, match[2]!)
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

async function main() {
  console.log(apply ? 'Aplicando categorías y fotos representativas.' : 'Vista previa: no se modifica la base ni se registran descargas.')
  // Do not rename existing categories; match both stable keys and accent-insensitive labels.
  const existingCategories = await prisma.category.findMany()
  const work = [
    ...definitions,
    ...existingCategories.filter((category) => !definitions.some((definition) => definition.key === category.key || normalize(definition.label) === normalize(category.label)))
      .map((category) => ({ key: category.key, label: category.label, blurb: category.blurb ?? '', query: existingPhotoQueries[category.key] ?? category.label })),
  ]
  for (const definition of work) {
    const existing = existingCategories.find((category) => category.key === definition.key || normalize(category.label) === normalize(definition.label))
    if (existing?.imagenUrl) {
      // Preserve all existing metadata and photos, even when an override is supplied.
      console.log(`Conservada: ${existing.label}${existing.imagenUrl ? ' (con imagen)' : ' (sin imagen; editable desde administración)'}`)
      continue
    }
    // Only one search per missing category. Stop on upstream failures; no automatic request retries.
    const override = overrides.get(definition.key)
    const photo = override
      ? categoryPhotoData(await unsplashRequest(`https://api.unsplash.com/photos/${override}`))
      : (await searchCategoryPhotos(definition.query, 1))[0]
    if (!photo) {
      console.log(`Sin resultados: ${definition.label}; se creará sin imagen.`)
    } else {
      console.log(`${definition.label}: ${photo.unsplashPhotoId} · ${photo.photographerName} · ${photo.unsplashUrl}`)
      console.log(`  Alternativa: ${photo.imagenAlt}`)
    }
    if (!apply) continue
    // Fill only absent images. Existing keys, labels, icons and descriptions never change.
    let selected = false
    if (existing) {
      if (photo) {
        const updated = await prisma.category.updateMany({ where: { id: existing.id, imagenUrl: null }, data: photo })
        selected = updated.count > 0
      }
    } else {
      const created = await prisma.category.createMany({
        data: [{ key: definition.key, label: definition.label, blurb: definition.blurb, ...(photo ?? {}) }],
        skipDuplicates: true,
      })
      selected = created.count > 0
    }
    if (!selected || !photo) continue
    // Persist intent before the remote side effect so a later rerun never triggers a second download.
    // Ambiguous upstream failures require manual reconciliation (see docs/category-images.md).
    const reserved = await prisma.category.updateMany({
      where: { key: existing?.key ?? definition.key, unsplashPhotoId: photo.unsplashPhotoId, unsplashDownloadTrackedAt: null },
      data: { unsplashDownloadTrackedAt: new Date() },
    })
    if (reserved.count) await unsplashRequest(photo.unsplashDownloadLocation)
  }
}

main().catch((error: unknown) => {
  // Never print request headers, keys, connection strings, or raw upstream errors.
  console.error(error instanceof UnsplashError ? error.code : 'No se completó el enriquecimiento; revisa la configuración y la base de datos.')
  process.exitCode = 1
}).finally(async () => { await prisma.$disconnect() })
