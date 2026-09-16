# LendIt UJAP 🤝

**LendIt UJAP** es una red de préstamos temporales de objetos entre estudiantes de la **Universidad José Antonio Páez (UJAP)**. El concepto es similar al de Airbnb, pero adaptado a la comunidad universitaria: permite a los estudiantes prestar y pedir prestados artículos útiles en el campus como calculadoras, cargadores, laptops, batas de laboratorio, y más, por un tiempo limitado y de forma segura.

Este proyecto ha sido desarrollado en el marco del curso **Electiva Profesional III – Tópicos Especiales en Programación Web**.

---

## 🚀 Stack Tecnológico

El proyecto está construido usando prácticas modernas de desarrollo web:

- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) con [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: Vanilla CSS con un sistema premium de diseño adaptable y soporte nativo para **Modo Oscuro** (Theme auto-detectado).
- **Manejador de Estado**: [Pinia](https://pinia.vuejs.org/) para coordinar la sesión y datos remotos.
- **Enrutado**: [Vue Router](https://router.vuejs.org/)
- **Herramientas de Construcción**: [Vite](https://vite.dev/)
- **Pruebas**: [Vitest](https://vitest.dev/) para pruebas unitarias.
- **Backend**: funciones API de Vercel, [Supabase Auth](https://supabase.com/docs/guides/auth) y PostgreSQL con [Prisma](https://www.prisma.io/).

---

## 📁 Estructura del Proyecto

El código fuente está estructurado de manera modular y desacoplada, facilitando futuras integraciones de APIs:

```text
src/
├── types/         # Interfaces de TypeScript puras (Article, Category, AuthUser, etc.)
├── data/          # Datos simulados (mocks) y funciones auxiliares (independientes para fácil reemplazo por API)
├── stores/        # Stores de Pinia conectados a Supabase y a la API
├── lib/           # Cliente Supabase y cliente HTTP del frontend
├── router/        # Configuración de rutas (Vue Router)
├── components/    # Componentes de presentación reutilizables:
│   ├── ArticleCard.vue         # Tarjeta de visualización de artículo disponible/prestado
│   ├── CategoryCard.vue        # Tarjetas de categorías
│   ├── StepCard.vue            # Tarjeta de pasos explicativos
│   ├── ModalDialog.vue         # Diálogo modal premium adaptable
│   ├── AuthPageShell.vue       # Plantilla visual para las páginas de autenticación
│   ├── LoginForm.vue           # Acceso institucional y administrativo reutilizable
│   ├── RegisterForm.vue        # Registro con elección de rol (Estudiante/Profesor)
│   ├── PhotoDropzone.vue       # Carga y optimización de fotos por arrastre
│   ├── RequestLoanForm.vue     # Solicitud con fechas y pago simulado
│   ├── LoadingState.vue         # Loader visual reutilizable para paneles
│   ├── PublishArticleForm.vue  # Formulario para publicar nuevos objetos (con audiencia por rol)
│   └── RoleManagerPanel.vue    # Panel de administración de roles/permisos (solo ADMIN)
├── views/         # Vistas principales de la aplicación:
│   ├── LandingView.vue         # Vista principal (Landing page con todas las secciones)
│   ├── CatalogView.vue         # Catálogo con búsqueda y filtros
│   ├── PublishView.vue         # Publicación y edición de objetos
│   ├── MyPublicationsView.vue  # Estante del propietario
│   ├── RequestsView.vue        # Solicitudes, aprobaciones y devoluciones
│   ├── AdminLoginView.vue      # Acceso separado para administradores
│   ├── LoginView.vue           # Página de inicio de sesión comunitario
│   └── RegisterView.vue        # Página de registro comunitario
├── App.vue        # Componente raíz
└── main.ts        # Punto de entrada de la aplicación
```

---

## ⚡ Características Implementadas

1. **Diseño Responsivo y Premium**:
   - Cabecera sticky optimizada para móviles (con ocultación automática de links de escritorio).
   - Animaciones y transiciones premium en modales, cargas y banners de notificaciones.
   - Soporte automático para **Modo Oscuro** en base a las preferencias del sistema del usuario.

2. **Flujo de Usuario Integrado**:
    - **Catálogo y peticiones**: Los estudiantes pueden explorar, filtrar y solicitar objetos indicando inicio, devolución y un mensaje para el propietario.
    - **Ciclo del préstamo**: El propietario puede aprobar o rechazar solicitudes; solicitante y propietario pueden registrar la devolución.
    - **Publicación inteligente**: Se pueden crear, editar, pausar, reactivar y eliminar publicaciones. Las fotos se guardan en Supabase Storage.
    - **Alquiler demostrativo**: Una publicación puede definir precio y moneda (USD, EUR o VES). La solicitud registra un pago simulado, sin cobro real.
    - **Publicación autenticada**: Si un usuario no autenticado intenta publicar o pedir, la aplicación lo lleva a `/login` y conserva la ruta pendiente.

3. **Validación y Persistencia**:
   - Acceso institucional para estudiantes/profesores con validación `@ujap.edu.ve` y acceso administrativo separado que acepta Gmail, siempre que la cuenta tenga permisos de administrador.
    - Creación, edición, eliminación y consulta de artículos mediante `GET/POST/PATCH/DELETE /api/items`; los datos ya no dependen de `localStorage`.
    - Solicitudes y préstamos mediante `GET /api/items?view=requests` y mutaciones con `resource: "request"`, sin superar el límite de funciones de Vercel.
   - Registro e inicio de sesión con Supabase Auth y sincronización del perfil mediante `GET/PATCH /api/me`.
    - Fotos de perfil optimizadas en el navegador y fotos de objetos almacenadas en el bucket `item-photos` de Supabase Storage.
   - Panel administrativo dividido por rutas: `/admin/roles`, `/admin/users`, `/admin/categories` y `/admin/careers`.
   - Pasos informativos marcables como "Leído" con persistencia reactiva.

---

## 🛠️ Comandos Disponibles

En el directorio del proyecto, puedes ejecutar:

```bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo
pnpm dev

# Frontend + API local (server/dev-api.ts) juntos, sin depender de una cuenta de Vercel
pnpm dev:full

# Compilar el proyecto para producción (Type-check con vue-tsc + build)
pnpm build

# Previsualizar la versión compilada de producción locally
pnpm preview

# Ejecutar pruebas unitarias de Vitest
pnpm test

# Cambiar el rol de un usuario ya registrado
pnpm db:promote admin@gmail.com ADMIN
```

### Despliegue en Vercel

El proyecto incluye `vercel.json` para compilar la aplicación Vite, servir `dist` y permitir recargar directamente cualquier ruta de Vue Router. Las funciones de `api/` son detectadas automáticamente por Vercel. Para respetar el límite de 12 funciones del plan Hobby, las operaciones de detalle de categorías y carreras se enrutan hacia sus handlers principales.

1. Importa el repositorio en Vercel usando la raíz del proyecto. El comando de build es `pnpm build`.
2. Configura en Vercel, para Preview y Production, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL` y `APP_URL`.
3. Deja `VITE_API_BASE_URL` vacío o sin definir: en Vercel el frontend y las funciones API comparten el mismo dominio.
4. Mantén `ALLOW_TEST_EMAILS` y `VITE_ALLOW_TEST_EMAILS` en `false`. El build puede ejecutar `prisma generate` sin `DIRECT_URL`; esta variable sí es obligatoria cuando ejecutes migraciones.
5. Ejecuta una vez `pnpm db:migrate:deploy` usando las credenciales de la base de datos de producción antes de probar la API. La migración crea modalidad/precio, vínculo de pagos y el bucket/policies de `item-photos`.
6. En Supabase Auth, establece la URL del sitio y las URLs de redirección con el dominio de Vercel o el dominio personalizado; `APP_URL` debe apuntar a ese mismo origen.
7. Comprueba `/`, `/login`, `/register`, `/admin/login` y `/api/health` después del primer despliegue.

### Roles y permisos

Los roles y permisos son datos, no un enum fijo: viven en las tablas `Role`, `Permission` y `RolePermission`. Un `ADMIN` puede crear roles nuevos y activar/desactivar permisos por rol desde el panel "Roles y permisos" que aparece en la landing al iniciar sesión como admin (requiere el permiso `roles.manage`).

- **STUDENT** y **PROFESSOR** (elegido al registrarse): `profile.update`, `items.publish`, `items.rent`, `reviews.create`.
- **ADMIN**: todos los permisos, incluyendo `roles.manage`, `categories.manage`, `careers.manage`, `users.manage`. Puede entrar desde `/admin/login` con un correo como Gmail.
- Las publicaciones quedan **disponibles de inmediato** al publicarse — no hay cola de revisión.
    - Al publicar un objeto se puede restringir su audiencia a uno o más roles (ej. "solo para profesores"); sin restricción, lo ve todo el campus.
    - El pago de alquiler es **simulado** (`SIMULATED_PAID`); no se conecta todavía a una pasarela real.
- Calificar a otro usuario (`reviews.create`) solo es posible después de que un préstamo (`Loan`) quede marcado como finalizado.

Para probar con un admin: registra o crea su usuario en Supabase, asígnale el perfil correspondiente y ejecuta `pnpm db:promote admin@gmail.com ADMIN`. Luego entra desde `/admin/login`.

---

## 🔮 Próximos Avances

- **Unidad 6**: Integración de una pasarela real si el proyecto requiere cobros.
- **Unidad 6**: Reputación, QR de un solo uso y moderación de objetos.
- **Unidad 6**: Configuración formal de formateadores y linters (ESLint/Prettier) para estandarización de la calidad del código.
