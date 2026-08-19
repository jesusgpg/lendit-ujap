# LendIt UJAP 🤝

**LendIt UJAP** es una red de préstamos temporales de objetos entre estudiantes de la **Universidad José Antonio Páez (UJAP)**. El concepto es similar al de Airbnb, pero adaptado a la comunidad universitaria: permite a los estudiantes prestar y pedir prestados artículos útiles en el campus como calculadoras, cargadores, laptops, batas de laboratorio, y más, por un tiempo limitado y de forma segura.

Este proyecto ha sido desarrollado en el marco del curso **Electiva Profesional III – Tópicos Especiales en Programación Web**.

---

## 🚀 Stack Tecnológico

El proyecto está construido usando prácticas modernas de desarrollo web:

- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) con [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: Vanilla CSS con un sistema premium de diseño adaptable y soporte nativo para **Modo Oscuro** (Theme auto-detectado).
- **Manejador de Estado**: [Pinia](https://pinia.vuejs.org/) (para persistencia local del estado de autenticación y lista de artículos).
- **Enrutado**: [Vue Router](https://router.vuejs.org/)
- **Herramientas de Construcción**: [Vite](https://vite.dev/)
- **Pruebas**: [Vitest](https://vitest.dev/) para pruebas unitarias.

---

## 📁 Estructura del Proyecto

El código fuente está estructurado de manera modular y desacoplada, facilitando futuras integraciones de APIs:

```text
src/
├── types/         # Interfaces de TypeScript puras (Article, Category, AuthUser, etc.)
├── data/          # Datos simulados (mocks) y funciones auxiliares (independientes para fácil reemplazo por API)
├── stores/        # Stores de Pinia (auth.ts y articles.ts con persistencia en localStorage)
├── router/        # Configuración de rutas (Vue Router)
├── components/    # Componentes de presentación reutilizables:
│   ├── ArticleCard.vue         # Tarjeta de visualización de artículo disponible/prestado
│   ├── CategoryCard.vue        # Tarjetas de categorías
│   ├── StepCard.vue            # Tarjeta de pasos explicativos
│   ├── ModalDialog.vue         # Diálogo modal premium adaptable
│   ├── LoginForm.vue           # Formulario para inicio de sesión
│   └── PublishArticleForm.vue  # Formulario para publicar nuevos objetos
├── views/         # Vistas principales de la aplicación:
│   └── LandingView.vue         # Vista principal (Landing page con todas las secciones)
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
   - **Búsqueda y Peticiones**: Los estudiantes pueden ver objetos disponibles, solicitar préstamos (que genera una alerta simulada a su correo UJAP) o preguntar por artículos prestados.
   - **Publicación Inteligente**: Si un usuario no autenticado intenta hacer clic en *"Publicar un objeto"*, la aplicación abre automáticamente el modal de inicio de sesión y, tras un ingreso exitoso, transiciona directamente al formulario de publicación sin perder la intención inicial.

3. **Validación y Persistencia**:
   - Validación local de correo institucional (`@ujap.edu.ve`) y contraseñas de al menos 6 caracteres.
   - Creación y persistencia de artículos nuevos usando el almacenamiento local (`localStorage`) para mantener la lista actualizada al recargar la página.
   - Pasos informativos marcables como "Leído" con persistencia reactiva.

---

## 🛠️ Comandos Disponibles

En el directorio del proyecto, puedes ejecutar:

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Compilar el proyecto para producción (Type-check con vue-tsc + build)
npm run build

# Previsualizar la versión compilada de producción locally
npm run preview

# Ejecutar pruebas unitarias de Vitest
npm run test
```

---

## 🔮 Próximos Avances

- **Unidad 4**: Integración de API HTTP real y base de datos para sustituir las funciones mock de la carpeta `src/data/`.
- **Unidad 6**: Configuración formal de formateadores y linters (ESLint/Prettier) para estandarización de la calidad del código.