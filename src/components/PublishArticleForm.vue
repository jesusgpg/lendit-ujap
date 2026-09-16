<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { useArticlesStore } from '../stores/articles'
import { useCatalogStore } from '../stores/catalog'

const emit = defineEmits<{
  (e: 'published'): void
}>()

const articlesStore = useArticlesStore()
const catalog = useCatalogStore()

// Audiencia: vacío = visible para todos. 'STUDENT' / 'PROFESSOR' restringe quién puede pedirlo.
const restrictedToRoles = ref<string[]>([])
const errorMessage = ref('')
const { defineField, errors, handleSubmit, isSubmitting, setFieldValue } = useForm({
  initialValues: { title: '', categoryKey: '', duration: '' },
  validationSchema: {
    title: (value: string) => value.trim().length >= 3 || 'Escribe un nombre de al menos 3 caracteres.',
    categoryKey: (value: string) => !!value || 'Selecciona una categoría.',
    duration: (value: string) => value.trim().length >= 2 || 'Indica el tiempo de préstamo.',
  },
})
const [title, titleAttrs] = defineField('title')
const [categoryKey, categoryKeyAttrs] = defineField('categoryKey')
const [duration, durationAttrs] = defineField('duration')

onMounted(async () => {
  await catalog.initialize()
  if (!categoryKey.value) {
    setFieldValue('categoryKey', catalog.categories[0]?.key ?? '')
  }
})

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''

  try {
    await articlesStore.publish({
      title: values.title.trim(),
      categoryKey: values.categoryKey,
      duration: values.duration.trim(),
      restrictedToRoles: restrictedToRoles.value,
    })

    setFieldValue('title', '')
    setFieldValue('duration', '')
    restrictedToRoles.value = []
    emit('published')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo publicar el objeto.'
    push.error({ title: 'No se publicó el objeto', message: errorMessage.value })
  }
})
</script>

<template>
  <form class="publish-form" novalidate @submit="onSubmit">
    <p class="publish-form__hint">Cuéntale al campus qué tienes disponible para prestar. Se publica de inmediato.</p>

    <label class="field">
      <span>Nombre del objeto</span>
      <input v-model="title" v-bind="titleAttrs" type="text" placeholder="Ej: Calculadora HP 50g" required />
      <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
    </label>

    <label class="field">
      <span>Categoría</span>
      <select v-model="categoryKey" v-bind="categoryKeyAttrs" required>
        <option v-for="cat in catalog.categories" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
      </select>
      <span v-if="errors.categoryKey" class="field__error">{{ errors.categoryKey }}</span>
    </label>

    <label class="field">
      <span>Tiempo de préstamo</span>
      <input v-model="duration" v-bind="durationAttrs" type="text" placeholder="Ej: 4 horas, 2 días" required />
      <span v-if="errors.duration" class="field__error">{{ errors.duration }}</span>
    </label>

    <fieldset class="field field--audience">
      <legend>¿Quién puede pedirlo?</legend>
      <label class="field__checkbox">
        <input type="checkbox" value="STUDENT" v-model="restrictedToRoles" />
        <span>Solo estudiantes</span>
      </label>
      <label class="field__checkbox">
        <input type="checkbox" value="PROFESSOR" v-model="restrictedToRoles" />
        <span>Solo profesores</span>
      </label>
      <p class="field__hint">Deja ambas sin marcar para que lo vea todo el campus.</p>
    </fieldset>

    <p v-if="errorMessage" class="publish-form__error">{{ errorMessage }}</p>

    <button class="btn btn--primary publish-form__submit" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Publicando…' : 'Publicar objeto' }}
    </button>
  </form>
</template>

<style scoped>
.publish-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.publish-form__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.field input,
.field select {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--crimson);
}

.field--audience {
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  padding: 10px 14px;
  gap: 8px;
}

.field--audience legend {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
  padding: 0 4px;
}

.field__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}

.field__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-faint);
  margin: 2px 0 0 0;
}

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.publish-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.publish-form__submit {
  margin-top: 4px;
  width: 100%;
}

.publish-form__submit:disabled {
  cursor: wait;
  opacity: 0.7;
}
</style>
