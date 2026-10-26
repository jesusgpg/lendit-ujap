# Imágenes de categorías — LendIt UJAP

## Resultado de integración del coordinador

El 25 de octubre de 2026 se aplicó la migración aditiva, se generó Prisma y se ejecutó `pnpm exec tsx scripts/enrich-categories.ts --apply` con la clave del servidor. Se agregaron doce categorías y se completaron fotos de las ocho originales: veinte categorías con imágenes y crédito, conservando los nombres, claves y descripciones existentes. Las veinte imágenes cargaron al recorrer `/categorias` en Orca Browser; se revisó el encuadre de la primera fila y la fotografía de material de laboratorio. No se crearon publicaciones ficticias ni se expuso la clave en el cliente.

La compilación de frontend y API pasó durante la integración. La búsqueda/selección dentro de una sesión administrativa todavía no se ha revisado visualmente; su comprobación estática no equivale a una prueba funcional de ese flujo.

## Alcance y datos

Las fotos son representativas de categorías, no publicaciones ni disponibilidad real. Se conservan los tokens y tipografías UJAP; las tarjetas usan proporción 3:2, texto alternativo, carga diferida y fallback con el nombre de la categoría cuando no hay foto o falla su carga. Por decisión del producto, los créditos se retiraron de las tarjetas y se recopilaron en `docs/image-credits.md` para las futuras FAQ y políticas. Los metadatos originales permanecen en la base de datos. Antes de publicar debe resolverse la atribución visible exigida por la API de Unsplash; un documento interno no sustituye esa atribución.

`Category` incorpora campos nullable: `imagenUrl`, `imagenAlt`, `unsplashPhotoId`, `photographerName`, `photographerUrl`, `unsplashUrl`, `unsplashDownloadLocation`, `unsplashDownloadTrackedAt`. La migración `20261025030000_category_images` solo agrega columnas; no cambia datos existentes ni otros modelos. El DTO público excluye la URL de tracking y su fecha.

## Contrato API

- `GET /api/categories`: público; mantiene key/label/icon/blurb y añade los seis campos públicos de foto, con null para categorías sin foto.
- `GET /api/categories?action=photos&q=...`: sesión autenticada y permiso `roles.manage`; query de 2–100 caracteres; devuelve `{ok:true, photos:[{imagenUrl,imagenAlt,unsplashPhotoId,photographerName,photographerUrl,unsplashUrl}]}`. Hasta ocho resultados, landscape y content_filter=high; sin tracking al buscar.
- `POST /api/categories`: contrato existente de creación; opcional `unsplashPhotoId` y `imagenAlt`.
- `PATCH /api/categories/:key`: contrato existente; omitir `unsplashPhotoId` conserva la foto, un ID selecciona otra y null la quita junto con su crédito. `imagenAlt` permite corregir el texto alternativo (2–500 caracteres).
- Crear/editar/borrar conserva `categories.manage`. Incluir una selección o eliminación de foto exige además `roles.manage`; el panel solo muestra el selector a ese permiso. El backend recupera la foto por ID y deriva URLs/créditos de Unsplash; no confía en URLs enviadas por el navegador.
- Errores: 400 entrada inválida, 401 sin sesión, 403 sin permiso, 404 categoría inexistente, 409 clave repetida/categoría en uso, 429 límite de Unsplash, 502 fallo/respuesta inválida de Unsplash y 503 clave de Unsplash sin configurar. Las respuestas no contienen headers ni claves.

`UNSPLASH_ACCESS_KEY` solo se lee en servidor; nunca usar prefijo VITE. Se envía mediante Authorization y no en URL. Se usa Accept-Version: v1, timeout de 10 segundos y no se siguen redirects. Las llamadas externas se restringen a api.unsplash.com; los hotlinks a images.unsplash.com y los créditos a unsplash.com.

## Enriquecimiento (revisión antes de ejecutar)

El worker no ejecutó estos comandos ni modificó `.env`. El coordinador administra migraciones y generación de Prisma.

```powershell
# Vista previa opcional: consulta BD y busca fotos, sin escrituras ni tracking.
pnpm exec tsx scripts/enrich-categories.ts
# Aplicar después de revisar el código y preparar Prisma/BD:
pnpm exec tsx scripts/enrich-categories.ts --apply
# Elegir un ID revisado en lugar del primer resultado de una búsqueda:
pnpm exec tsx scripts/enrich-categories.ts --apply --photo=calculadoras:ID_UNSPLASH
```

El script usa Prisma y la configuración existente de dotenv. Agrega las doce categorías universitarias solicitadas; no crea artículos, sustancias químicas ni métricas ficticias. Para una categoría ya existente conserva key, label, icon y blurb; solo rellena metadatos de imagen cuando imagenUrl es null. Una imagen existente se conserva incluso si se pasa un override. También cubre las ocho categorías originales (útiles escolares, electrónicos, laptops, cargadores, videobeam, marcadores, libros y laboratorio); categorías personalizadas sin foto usan su etiqueta como búsqueda.

Se busca una sola candidata por categoría pendiente, de forma secuencial, sin bucles de reintento. Cada selección registra el hotlink de photo.urls.regular, el alt proporcionado y los créditos de la respuesta; el administrador debe revisar relevancia y traducir/corregir el alt cuando corresponda. `--photo=clave:ID` permite revisar una selección explícita antes de aplicarla. La vista previa consume búsquedas: para ahorrar cuota se puede revisar el código y ejecutar directamente --apply. Para veinte categorías sin foto son aproximadamente cuarenta llamadas (búsqueda y tracking), sujetas al plan y uso previo de Unsplash.

La creación usa skipDuplicates y el relleno de imágenes usa updateMany con imagenUrl:null para no pisar cambios concurrentes. Las reejecuciones omiten categorías con imagen y no repiten búsquedas ni downloads de selecciones previas. Una categoría nueva sin resultados se crea sin imagen, lista para editar; una existente sin resultados se conserva.

## Tracking y fallos parciales

La app usa exactamente photo.links.download_location con sus parámetros originales; no descarga ni aloja el archivo. Solo se llama al seleccionar y guardar una foto, no al mostrar tarjetas o resultados. Guardar nuevamente el mismo ID con tracking confirmado no registra otra descarga.

El script reserva `unsplashDownloadTrackedAt` antes de invocar el tracking para impedir que dos ejecuciones registren la misma selección; en el script esta fecha es una marca de intento, no prueba de confirmación remota. Si hay timeout, fallo o interrupción entre persistencia y tracking, se detiene y conserva la foto y sus créditos; la reejecución no vuelve a descargar. Hay que revisar manualmente ese intento antes de reconciliarlo: Unsplash no ofrece una clave de idempotencia para garantizar exactamente una llamada entre BD y servicio externo.

En el administrador se persiste primero la foto y luego se registra el tracking; si falla, devuelve un error y la foto puede haber quedado guardada. Reintentar un PATCH del mismo ID vuelve a intentar tracking pendiente, pero un timeout de respuesta puede ser ambiguo; no hay garantía de exactamente una llamada ante fallos de red o ediciones concurrentes. La búsqueda y selección requieren servicio y cuota disponibles.

## Fuentes primarias consultadas (25 octubre 2026)

- [Documentación Unsplash: autenticación, búsqueda y tracking](https://unsplash.com/documentation).
- [Guías de la API](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).
- [Hotlinking](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images).
- [Atribución](https://help.unsplash.com/en/articles/2511315-guideline-attribution).
- [Tracking al seleccionar](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download).

Las URLs de atribución del fotógrafo y de Unsplash incluyen utm_source=lendit_ujap y utm_medium=referral. Se siguió la guía Postman api-engineer/api-discovery; el CLI instalado no expone Orbit como comando, por lo que el contrato del proveedor se contrastó con su documentación primaria. No se publicaron recursos de Postman ni se añadieron dependencias.

## Verificación y límites

Se revisó el código existente antes de modificar las vistas; se preservaron rutas, formularios, permisos y enlaces al catálogo. Se aplicó la búsqueda UX `image alt text` (alternativas descriptivas e imágenes responsivas); la primera búsqueda específica de Vue no dio resultados verificados y no se persistió ninguna recomendación. Se corrigieron los tipos de API según erasableSyntaxOnly y se efectuó comprobación estática de frontend y backend, sin pruebas automáticas funcionales ni llamadas reales a Unsplash desde el worker.

No se ejecutaron enriquecimiento, migraciones, prisma generate, commits ni pushes. La revisión visual en Orca Browser y la comprobación autenticada en vivo quedan a cargo del coordinador; no se afirma QA visual ni validación de relevancia de fotos aún no seleccionadas. Las fotografías representativas y su texto alternativo deben revisarse en administración antes de publicación definitiva.
